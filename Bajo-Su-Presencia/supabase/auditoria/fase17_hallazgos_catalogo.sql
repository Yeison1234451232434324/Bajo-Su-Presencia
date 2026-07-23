-- ============================================================================
--  FASE 17 · HALLAZGOS DEL CATÁLOGO REAL (acceso SQL directo)
--  Detectados conectando directamente a Postgres 17.6 e inspeccionando
--  pg_proc / pg_policy / pg_constraint / pg_trigger — cosas invisibles desde
--  la API REST. Idempotente.
-- ============================================================================

-- ===========================================
-- 17.1 [SEGURIDAD — ALTA] get_rol_usuario(): función SECURITY DEFINER
--   (a) SIN search_path fijo → vector de escalada de privilegios,
--   (b) con EXECUTE concedido a anon y authenticated,
--   (c) con bug de correctitud: compara u.id = auth.uid() cuando el enlace
--       correcto es u.auth_id = auth.uid() (devuelve casi siempre NULL),
--   (d) sin un solo uso en el código (huérfana; las RLS usan mi_rol/es_*).
--   → Se ELIMINA. Menos superficie de ataque, sin impacto funcional.
-- ===========================================
drop function if exists public.get_rol_usuario();

-- ===========================================
-- 17.2 [INTEGRIDAD — MEDIA] actividades.evento_id era NO ACTION: no se podía
--   borrar un evento con actividades, e incoherente con TODOS los demás hijos
--   de eventos (asistencias, calificaciones, evaluaciones, voluntarios_eventos,
--   eventos_qr, evento_recursos) que son CASCADE. La fase 5 pretendía CASCADE
--   pero su guard omitió la FK preexistente *_fkey. Se recrea como CASCADE.
-- ===========================================
do $$ begin
  if exists (select 1 from pg_constraint where conname='actividades_evento_id_fkey'
             and conrelid='public.actividades'::regclass
             and confdeltype <> 'c') then
    alter table public.actividades drop constraint actividades_evento_id_fkey;
    alter table public.actividades add constraint actividades_evento_id_fkey
      foreign key (evento_id) references public.eventos(id) on delete cascade;
    raise notice '17.2: actividades.evento_id → ON DELETE CASCADE';
  end if;
end $$;

-- ===========================================
-- 17.3 [CONVENCIÓN — BAJA] 4 FKs conservan el nombre de la columna VIEJA
--   (id_de_evento) tras el rename a evento_id (fase 3). El rename de columna
--   no renombra la constraint. Cosmético pero rompe la consistencia exigida.
-- ===========================================
do $$
declare par text[]; pares constant text[][] := array[
    ['asistencias','asistencias_id_de_evento_fkey','asistencias_evento_id_fkey'],
    ['calificaciones_eventos','calificaciones_eventos_id_de_evento_fkey','calificaciones_eventos_evento_id_fkey'],
    ['evaluaciones','evaluaciones_id_de_evento_fkey','evaluaciones_evento_id_fkey'],
    ['voluntarios_eventos','voluntarios_eventos_id_de_evento_fkey','voluntarios_eventos_evento_id_fkey']];
begin
  foreach par slice 1 in array pares loop
    if exists (select 1 from pg_constraint where conname=par[2]
               and conrelid=('public.'||par[1])::regclass) then
      execute format('alter table public.%I rename constraint %I to %I', par[1], par[2], par[3]);
      raise notice '17.3: % → %', par[2], par[3];
    end if;
  end loop;
end $$;

-- ===========================================
-- 17.4 [SEGURIDAD — BAJA] tg_set_actualizado_en(): función de trigger sin
--   search_path fijo. Menor riesgo (SECURITY INVOKER), pero la buena práctica
--   es pinearlo también.
-- ===========================================
alter function public.tg_set_actualizado_en() set search_path = public, pg_temp;

-- ===========================================
-- Verificación
-- ===========================================
select '17.1 get_rol_usuario' as item,
       case when to_regprocedure('public.get_rol_usuario()') is null then 'ELIMINADA ✔' else 'AÚN EXISTE' end as estado
union all
select '17.2 actividades.evento_id on_delete',
       (select case confdeltype when 'c' then 'CASCADE ✔' else confdeltype::text end
        from pg_constraint where conname='actividades_evento_id_fkey'
        and conrelid='public.actividades'::regclass)
union all
select '17.3 FKs id_de_evento restantes',
       coalesce((select string_agg(conname,', ') from pg_constraint
        where connamespace='public'::regnamespace and conname like '%id_de_evento%'),'(ninguna) ✔')
union all
select '17.4 tg_set_actualizado_en search_path',
       coalesce((select array_to_string(proconfig,',') from pg_proc
        where proname='tg_set_actualizado_en' and pronamespace='public'::regnamespace),'(sin fijar)');
