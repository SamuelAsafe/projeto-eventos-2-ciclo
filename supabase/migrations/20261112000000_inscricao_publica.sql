-- =============================================================================
-- Inscrição pública em eventos (usada por inscricao.html)
-- Executar no Supabase: SQL Editor → colar tudo → Run. Idempotente.
-- Requer a migration 20261111000000_rls_e_vagas.sql (trigger de vagas).
--
-- Por que uma função (RPC) e não inserts diretos do navegador?
--   - Com RLS, o visitante (anon) não pode LER participantes (dados pessoais).
--     Então ele não teria como descobrir o id de um participante que já existe
--     (e-mail é único) para criar a inscrição.
--   - A função valida tudo no servidor, reaproveita o participante pelo e-mail
--     SEM sobrescrever os dados dele, impede inscrição duplicada e encerrada,
--     e as vagas são controladas pelo trigger. Tudo numa transação.
-- =============================================================================

create or replace function public.inscrever_participante(
  p_id_evento       bigint,
  p_nome            text,
  p_email           text,
  p_documento       text,
  p_data_nascimento date,
  p_whatsapp        text
)
returns table (inscricao_id bigint, codigo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome            text := btrim(coalesce(p_nome, ''));
  v_email           text := lower(btrim(coalesce(p_email, '')));
  v_documento       text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_whatsapp        text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_data_evento     date;
  v_participante_id bigint;
  v_inscricao_id    bigint;
begin
  -- 1. Validação (o front também valida, mas o servidor não confia nele)
  if length(v_nome) < 3 or length(v_nome) > 120 then
    raise exception 'Nome inválido' using errcode = '22023', hint = 'nome_invalido';
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    raise exception 'E-mail inválido' using errcode = '22023', hint = 'email_invalido';
  end if;

  if length(v_documento) <> 11 then
    raise exception 'CPF inválido' using errcode = '22023', hint = 'documento_invalido';
  end if;

  if length(v_whatsapp) not between 10 and 13 then
    raise exception 'WhatsApp inválido' using errcode = '22023', hint = 'whatsapp_invalido';
  end if;

  if p_data_nascimento is null
     or p_data_nascimento >= current_date
     or p_data_nascimento < current_date - interval '120 years' then
    raise exception 'Data de nascimento inválida' using errcode = '22023', hint = 'data_nascimento_invalida';
  end if;

  -- 2. Evento existe e ainda aceita inscrições
  select data into v_data_evento from eventos where id = p_id_evento;

  if not found then
    raise exception 'Evento não encontrado' using errcode = 'P0002', hint = 'evento_nao_encontrado';
  end if;

  -- "Hoje" no fuso de Brasília: o current_date do banco é UTC (após 21h já seria amanhã).
  if v_data_evento < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Inscrições encerradas' using errcode = 'P0001', hint = 'inscricoes_encerradas';
  end if;

  -- 3. Participante: reaproveita pelo e-mail (sem sobrescrever dados existentes)
  insert into participantes (nome, email, documento, data_nascimento, whatsapp)
  values (v_nome, v_email, v_documento, p_data_nascimento, v_whatsapp)
  on conflict (email) do nothing
  returning id into v_participante_id;

  if v_participante_id is null then
    select id into v_participante_id from participantes where lower(email) = v_email;
  end if;

  -- 4. Inscrição única por evento
  if exists (
    select 1 from eventos_participantes
     where id_evento = p_id_evento and id_participante = v_participante_id
  ) then
    raise exception 'Participante já inscrito neste evento' using errcode = 'P0001', hint = 'ja_inscrito';
  end if;

  -- 5. Cria a inscrição (trigger desconta a vaga ou falha com hint 'vagas_esgotadas')
  insert into eventos_participantes (id_evento, id_participante)
  values (p_id_evento, v_participante_id)
  returning id into v_inscricao_id;

  return query select v_inscricao_id, 'INSC-' || lpad(v_inscricao_id::text, 6, '0');
end;
$$;

-- Só esta função é exposta ao público; nada além dela.
revoke all on function public.inscrever_participante(bigint, text, text, text, date, text) from public;
grant execute on function public.inscrever_participante(bigint, text, text, text, date, text) to anon, authenticated;

-- Com a função, o visitante não precisa mais inserir direto nas tabelas.
-- Remove as políticas de INSERT público (menos superfície de ataque).
drop policy if exists "participantes_insert_public"         on public.participantes;
drop policy if exists "eventos_participantes_insert_public" on public.eventos_participantes;
