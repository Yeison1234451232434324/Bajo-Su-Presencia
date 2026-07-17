-- ============================================================================
--  FASE 19 · CONSOLIDACIÓN DE POLÍTICAS SELECT REDUNDANTES
--  Tras la fase 18 cada tabla pública conserva su lectura correcta en dos
--  políticas explícitas: <t>_sel (authenticated) y <t>_sel_anon (anon).
--  Las <t>_select / "Enable read access for all users" (PUBLIC true) son
--  duplicados de la plantilla inicial de Supabase: mismo resultado, ruido.
--  Eliminarlas deja UNA sola generación coherente. Idempotente.
--  Cobertura verificada antes de aplicar: no se elimina ninguna lectura anón
--  necesaria (los *_sel_anon permanecen).
-- ============================================================================

do $$
declare p text[]; pares constant text[][] := array[
  ['eventos','Enable read access for all users'],['eventos','eventos_select'],
  ['noticias','Enable read access for all users'],['noticias','noticias_select'],
  ['oraciones','Enable read access for all users'],['oraciones','oraciones_select'],
  ['sedes','sedes_select'],
  ['actividades','actividades_select'],
  ['recursos','recursos_select']];
  par text[];
begin
  foreach par slice 1 in array pares loop
    execute format('drop policy if exists %I on public.%I', par[2], par[1]);
  end loop;
end $$;

-- Verificación: ninguna tabla debe tener ya políticas SELECT a PUBLIC
select coalesce(string_agg(polrelid::regclass::text||'.'||polname,', '),'(ninguna) ✔') as select_publicas_restantes
from pg_policy
where polcmd='r'
  and (select bool_or(rolname='public') from pg_roles where oid=any(polroles));
