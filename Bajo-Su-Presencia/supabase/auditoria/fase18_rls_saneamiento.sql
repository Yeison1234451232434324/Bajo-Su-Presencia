-- ============================================================================
--  FASE 18 · SANEAMIENTO CRÍTICO DE RLS  (detectado con acceso SQL directo)
--
--  HALLAZGO CRÍTICO: coexistían TRES generaciones de políticas. Dos son
--  peligrosas o rotas y anulaban por OR a la generación correcta (es_/mi_):
--
--   (a) "acceso_autenticado" / "evento_recursos_all":
--       FOR ALL TO PUBLIC USING (auth.uid() IS NOT NULL)
--       → CUALQUIER usuario logueado (cualquier rol) podía LEER, MODIFICAR y
--         BORRAR informes (ofrendas), evaluaciones, recursos, sedes y
--         evento_recursos. Exposición financiera y de datos de desempeño.
--
--   (b) Generación "get_rol_usuario()": rota en 3 formas (compara u.id en vez
--       de u.auth_id; roles en minúsculas vs 'Administrador'; propiedad contra
--       auth.uid() en vez de usuarios.id). Siempre evalúa FALSE → inútil, pero
--       mantiene viva una función SECURITY DEFINER insegura y expuesta a anon.
--
--  Se conserva ÚNICAMENTE la generación correcta (es_staff/es_admin/
--  mi_usuario_id, verificada: enlaza por auth_id y usa roles capitalizados) y
--  las lecturas públicas explícitas (*_sel_anon). Idempotente.
-- ============================================================================

-- ===========================================
-- 18.1 Eliminar las plantillas permisivas "FOR ALL" (hueco de escritura)
-- ===========================================
do $$
declare t text;
begin
  foreach t in array array['actividades','evaluaciones','evento_recursos','informes','recursos','sedes'] loop
    execute format('drop policy if exists acceso_autenticado on public.%I', t);
  end loop;
  drop policy if exists evento_recursos_all on public.evento_recursos;
end $$;

-- ===========================================
-- 18.2 Eliminar la generación rota basada en get_rol_usuario()
-- ===========================================
do $$
declare p text; pares constant text[][] := array[
  ['actividades','actividades_insert'],['actividades','actividades_update'],['actividades','actividades_delete'],
  ['evaluaciones','evaluaciones_select'],['evaluaciones','evaluaciones_insert'],['evaluaciones','evaluaciones_delete'],
  ['eventos','eventos_insert'],['eventos','eventos_update'],['eventos','eventos_delete'],
  ['informes','informes_select'],['informes','informes_insert'],['informes','informes_update'],
  ['noticias','noticias_insert'],['noticias','noticias_delete'],
  ['oraciones','oraciones_insert'],['oraciones','oraciones_delete'],
  ['recursos','recursos_insert'],['recursos','recursos_update'],['recursos','recursos_delete'],
  ['sedes','sedes_insert'],['sedes','sedes_delete']];
  par text[];
begin
  foreach par slice 1 in array pares loop
    execute format('drop policy if exists %I on public.%I', par[2], par[1]);
  end loop;
end $$;

-- ===========================================
-- 18.3 Reemplazo CORRECTO para la escritura del voluntario en actividades
-- (la única función legítima que dependía de la política insegura): el
-- responsable puede actualizar SU actividad; el resto de CRUD ya lo cubre
-- actividades_mod (es_staff). Solo se crea si no existe.
-- ===========================================
do $$ begin
  if not exists (select 1 from pg_policy where polname='actividades_upd_propia'
                 and polrelid='public.actividades'::regclass) then
    create policy actividades_upd_propia on public.actividades
      for update to authenticated
      using (voluntario_id = public.mi_usuario_id())
      with check (voluntario_id = public.mi_usuario_id());
  end if;
end $$;

-- ===========================================
-- 18.4 Ahora sí: eliminar la función insegura (ya sin dependientes)
-- ===========================================
drop function if exists public.get_rol_usuario();

-- ===========================================
-- 18.5 [BAJA] roles legible por anon (roles_lectura_publica / "Enable read...")
-- expone los nombres de rol al público. El catálogo de roles no necesita ser
-- anónimo (el backend lo lee con service_role). Se restringe a authenticated.
-- ===========================================
do $$ begin
  drop policy if exists roles_lectura_publica on public.roles;
  drop policy if exists "Enable read access for all users" on public.roles;
  drop policy if exists roles_select on public.roles;
  -- roles_sel (authenticated) permanece para la app autenticada.
end $$;

-- ===========================================
-- Verificación: ya no debe quedar política PUBLIC con USING(true) o
-- USING(auth.uid() is not null) para comandos de ESCRITURA, ni get_rol_usuario.
-- ===========================================
select 'get_rol_usuario' as item,
       case when to_regprocedure('public.get_rol_usuario()') is null then 'ELIMINADA ✔' else 'EXISTE ✗' end as estado
union all
select 'policies_escritura_publicas_peligrosas',
       coalesce(string_agg(polrelid::regclass::text||'.'||polname,', '),'(ninguna) ✔')
from pg_policy
where polcmd in ('a','w','d','*')
  and (select bool_or(rolname='public') from pg_roles where oid=any(polroles))
  and coalesce(pg_get_expr(polqual,polrelid),'')||coalesce(pg_get_expr(polwithcheck,polrelid),'')
      ~ '(auth.uid\(\) IS NOT NULL|^true|[^_]true)'
union all
select 'referencias_get_rol_restantes',
       coalesce((select string_agg(polname,', ') from pg_policy
        where pg_get_expr(polqual,polrelid) like '%get_rol_usuario%'
           or pg_get_expr(polwithcheck,polrelid) like '%get_rol_usuario%'),'(ninguna) ✔');
