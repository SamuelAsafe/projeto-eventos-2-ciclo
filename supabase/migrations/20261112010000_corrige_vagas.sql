-- =============================================================================
-- Correção: vagas não eram descontadas ao inscrever.
-- Causa: o trigger de vagas (migration 20261111000000) não estava criado no banco.
--
-- Este script é autossuficiente e idempotente:
--   1. (Re)cria a função e os triggers de vagas.
--   2. Recalcula vagas_restantes de TODOS os eventos a partir das inscrições
--      existentes (corrige inscrições feitas enquanto o trigger não existia).
--   3. Mostra o resultado para conferência.
--
-- Executar no Supabase: SQL Editor → colar tudo → Run.
-- =============================================================================

-- 1. Função + triggers -------------------------------------------------------
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

revoke all on function public.ajustar_vagas_evento() from public, anon, authenticated;

drop trigger if exists trg_inscricao_desconta_vaga on public.eventos_participantes;
create trigger trg_inscricao_desconta_vaga
  before insert on public.eventos_participantes
  for each row execute function public.ajustar_vagas_evento();

drop trigger if exists trg_inscricao_devolve_vaga on public.eventos_participantes;
create trigger trg_inscricao_devolve_vaga
  after delete on public.eventos_participantes
  for each row execute function public.ajustar_vagas_evento();

-- 2. Recalcula vagas a partir das inscrições existentes ----------------------
update public.eventos e
   set vagas_restantes = greatest(e.vagas_totais - coalesce(i.total, 0), 0)
  from (
    select ev.id, count(ep.id) as total
      from public.eventos ev
      left join public.eventos_participantes ep on ep.id_evento = ev.id
     group by ev.id
  ) i
 where i.id = e.id;

-- 3. Conferência --------------------------------------------------------------
select
  e.id,
  e.nome,
  e.vagas_totais,
  e.vagas_restantes,
  (select count(*) from public.eventos_participantes ep where ep.id_evento = e.id) as inscritos,
  (select count(*) from pg_trigger t
    where t.tgrelid = 'public.eventos_participantes'::regclass
      and t.tgname in ('trg_inscricao_desconta_vaga', 'trg_inscricao_devolve_vaga')) as triggers_ativos
from public.eventos e
order by e.id;
