-- =============================================================================
-- Realtime: publica alterações da tabela `eventos` para o site.
-- Com isso, "vagas restantes" atualiza sozinho na home, no detalhe e na
-- inscrição quando alguém se inscreve (sem recarregar a página).
--
-- Segurança: o Realtime respeita o RLS. `eventos` já tem SELECT público
-- (não há dado pessoal nela). participantes / eventos_participantes NÃO são publicadas.
--
-- Executar no Supabase: SQL Editor → colar tudo → Run. Idempotente.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'eventos'
  ) then
    alter publication supabase_realtime add table public.eventos;
  end if;
end;
$$;

-- Conferência: deve listar public.eventos
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime';
