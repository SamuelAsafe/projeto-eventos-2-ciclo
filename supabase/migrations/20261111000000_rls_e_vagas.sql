-- =============================================================================
-- RLS + controle automático de vagas
-- Executar no Supabase: SQL Editor → colar tudo → Run. Idempotente (pode rodar de novo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Row Level Security
--    A anon key é pública; quem protege os dados são estas políticas.
-- -----------------------------------------------------------------------------
alter table public.categorias            enable row level security;
alter table public.eventos               enable row level security;
alter table public.participantes         enable row level security;
alter table public.eventos_participantes enable row level security;

-- categorias / eventos: leitura pública (site), escrita só usuários logados (painel)
drop policy if exists "categorias_select_public" on public.categorias;
drop policy if exists "categorias_write_admin"   on public.categorias;
create policy "categorias_select_public" on public.categorias
  for select to anon, authenticated using (true);
create policy "categorias_write_admin" on public.categorias
  for all to authenticated using (true) with check (true);

drop policy if exists "eventos_select_public" on public.eventos;
drop policy if exists "eventos_write_admin"   on public.eventos;
create policy "eventos_select_public" on public.eventos
  for select to anon, authenticated using (true);
create policy "eventos_write_admin" on public.eventos
  for all to authenticated using (true) with check (true);

-- participantes: dado pessoal (documento, nascimento, whatsapp).
-- Público só cria (formulário de inscrição); leitura/edição só no painel.
drop policy if exists "participantes_insert_public" on public.participantes;
drop policy if exists "participantes_admin"         on public.participantes;
create policy "participantes_insert_public" on public.participantes
  for insert to anon with check (true);
create policy "participantes_admin" on public.participantes
  for all to authenticated using (true) with check (true);

-- eventos_participantes (inscrições): mesmo padrão
drop policy if exists "eventos_participantes_insert_public" on public.eventos_participantes;
drop policy if exists "eventos_participantes_admin"         on public.eventos_participantes;
create policy "eventos_participantes_insert_public" on public.eventos_participantes
  for insert to anon with check (true);
create policy "eventos_participantes_admin" on public.eventos_participantes
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 2. Vagas: desconta ao inscrever, devolve ao remover inscrição.
--    Feito no banco (não no navegador) para que ninguém altere vagas pela API
--    e para manter consistência venha a operação de onde vier.
-- -----------------------------------------------------------------------------
create or replace function public.ajustar_vagas_evento()
returns trigger
language plpgsql
security definer            -- roda com permissão do dono: anon não precisa de UPDATE em eventos
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.eventos
       set vagas_restantes = vagas_restantes - 1
     where id = new.id_evento
       and vagas_restantes > 0;

    if not found then
      raise exception 'Evento sem vagas disponíveis'
        using errcode = 'P0001', hint = 'vagas_esgotadas';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.eventos
       set vagas_restantes = least(vagas_restantes + 1, vagas_totais)
     where id = old.id_evento;

    return old;
  end if;

  return null;
end;
$$;

-- Função de trigger não deve ser chamável via API (/rpc).
revoke all on function public.ajustar_vagas_evento() from public, anon, authenticated;

drop trigger if exists trg_inscricao_desconta_vaga on public.eventos_participantes;
create trigger trg_inscricao_desconta_vaga
  before insert on public.eventos_participantes
  for each row execute function public.ajustar_vagas_evento();

drop trigger if exists trg_inscricao_devolve_vaga on public.eventos_participantes;
create trigger trg_inscricao_devolve_vaga
  after delete on public.eventos_participantes
  for each row execute function public.ajustar_vagas_evento();

-- -----------------------------------------------------------------------------
-- 3. (Opcional, recomendado) impedir inscrição duplicada no mesmo evento.
--    Descomente se não houver duplicatas na tabela; senão o comando falha.
-- -----------------------------------------------------------------------------
-- alter table public.eventos_participantes
--   add constraint eventos_participantes_evento_participante_key
--   unique (id_evento, id_participante);
