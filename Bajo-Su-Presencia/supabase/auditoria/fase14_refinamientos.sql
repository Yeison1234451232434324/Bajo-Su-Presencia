-- ============================================================================
--  FASE 14 · REFINAMIENTOS DE ARQUITECTURA
--  Tercera pasada de auditoría (2026-07). Hallazgos verificados contra el
--  esquema vivo (API), los datos reales (sondeos REST) y el código de las
--  aplicaciones. Solo se incluyen cambios cuya mejora está demostrada y que
--  no rompen a ningún escritor conocido (web JS, backend PHP, app móvil).
--  Idempotente. Requiere FASE 1 (helpers aud.*).
-- ============================================================================

-- ===========================================
-- 14.1 [ALTA] calificaciones_eventos: los criterios ujieres/sonido/mensaje
-- no tienen dominio — cualquier cliente de la API puede insertar 999 o -5 y
-- corromper los promedios de v_asistencias_detalle / v_resumen_asistencias.
-- El JS asume 1-5 (asistencias.model.js promedia sobre esa base).
-- Datos vivos verificados: 0 filas fuera de rango → aplica limpio.
-- ===========================================
select aud.add_check('calificaciones_eventos', 'ck_calif_rango',
  $$(ujieres is null or ujieres between 1 and 5)
    and (sonido  is null or sonido  between 1 and 5)
    and (mensaje is null or mensaje between 1 and 5)$$);

-- ===========================================
-- 14.2 [ALTA] pqr: tipo/estado/prioridad son NOT NULL pero sin dominio en la
-- BD — las listas válidas solo viven en pqr.model.js (TIPOS/ESTADOS), así que
-- el rol anon (formulario público) puede insertar cualquier texto.
-- Dominios y defaults tomados literalmente del modelo JS.
-- Tabla vacía hoy: cero riesgo de conflicto con históricos.
-- ===========================================
select aud.add_check('pqr', 'ck_pqr_tipo',
  $$tipo in ('Petición','Queja','Reclamo')$$);
select aud.add_check('pqr', 'ck_pqr_estado',
  $$estado in ('Pendiente','En proceso','Resuelto','Cerrado')$$);
select aud.add_check('pqr', 'ck_pqr_prioridad',
  $$prioridad in ('Baja','Media','Alta')$$);
alter table public.pqr alter column estado    set default 'Pendiente';
alter table public.pqr alter column prioridad set default 'Media';

-- Coherencia de la respuesta: no puede existir metadato de respuesta
-- (fecha o autor) sin el texto de la respuesta. Compatible con
-- pqr.model.js#responder, que escribe los tres campos juntos.
select aud.add_check('pqr', 'ck_pqr_respuesta',
  $$respuesta is not null
    or (respondido_en is null and respondido_por_id is null)$$);

-- ===========================================
-- 14.3 [MEDIA] evaluaciones: una evaluación sin estrellas y sin comentarios
-- no evalúa nada (anomalía de inserción). Las 2 filas vivas cumplen.
-- NOTA deliberada: NO se agrega UNIQUE (usuario, evaluador) para las
-- evaluaciones generales (evento_id null) — los datos vivos demuestran que
-- la app las usa como HISTORIAL (varias del mismo par a lo largo del tiempo).
-- ===========================================
select aud.add_check('evaluaciones', 'ck_evaluaciones_contenido',
  'estrellas is not null or comentarios is not null');

-- ===========================================
-- 14.4 [MEDIA] asistencias.estado: el dominio existe solo si la tabla nació
-- con supabase_migracion.sql. Se garantiza aquí sin duplicar: solo se crea
-- si NINGÚN CHECK actual menciona la columna estado.
-- ===========================================
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.asistencias'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%') then
    alter table public.asistencias add constraint ck_asistencias_estado
      check (estado in ('confirmada','asistida','calificada','cancelada'));
    raise notice 'ck_asistencias_estado creado';
  end if;
exception when others then
  raise notice 'ck_asistencias_estado: %', sqlerrm;
end $$;

-- ===========================================
-- 14.5 [BAJA] login_attempts: contador sin dominio mínimo.
-- (No se impone formato de correo: lo escribe el backend PHP con el valor
-- que teclea el usuario y un CHECK aquí bloquearía el conteo de intentos.)
-- ===========================================
select aud.add_check('login_attempts', 'ck_login_attempts_intentos',
                     'intentos >= 0');

-- ===========================================
-- 14.6 [MEDIA] asignaciones: mecanismo de asignación DUPLICADO. La app
-- asigna responsable vía actividades.voluntario_id (4/4 filas vivas lo usan);
-- asignaciones (usuario↔actividad) tiene 0 filas y ninguna referencia en el
-- código web ni en el backend PHP. Dos representaciones del mismo hecho =
-- anomalía de actualización garantizada cuando diverjan.
-- Guarda: solo se elimina si sigue vacía (si la app móvil llegara a usarla,
-- el DROP no ocurre y queda el NOTICE).
-- ===========================================
do $$
declare n bigint;
begin
  if to_regclass('public.asignaciones') is null then return; end if;
  select count(*) into n from public.asignaciones;
  if n = 0 then
    drop table public.asignaciones;
    raise notice 'asignaciones eliminada (vacía; duplicaba actividades.voluntario_id)';
  else
    raise notice 'asignaciones NO eliminada: tiene % filas — revisar quién escribe', n;
  end if;
end $$;

-- ===========================================
-- 14.7 [MEDIA] Índices de FK faltantes: toda FK sin índice en la columna
-- origen convierte cada DELETE/UPDATE del padre en un seq scan del hijo.
-- Detección genérica contra el catálogo vivo (no asume nada del estado
-- actual de pg_indexes): crea solo lo que realmente falte.
-- ===========================================
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tabla, a.attname as columna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and cardinality(c.conkey) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)',
      'idx_' || replace(r.tabla, 'public.', '') || '_' || r.columna,
      r.tabla, r.columna);
    raise notice 'Índice FK creado: % (%)', r.tabla, r.columna;
  end loop;
end $$;

-- ===========================================
-- 14.8 [BAJA] Documentación de decisiones de diseño en el catálogo
-- (evita que futuras auditorías "corrijan" lo que es intencional).
-- ===========================================
comment on column public.eventos.cupos_disponibles is
  'Contador mutable mantenido por la aplicación (no derivado en BD). Decisión consciente: convertirlo en columna calculada rompería a los escritores actuales.';
comment on column public.recursos.disponible is
  'Interruptor MANUAL de habilitación (no se deriva de cantidad>0): staff puede deshabilitar un recurso con stock.';
comment on table public.evaluaciones is
  'Historial de evaluaciones a voluntarios: se permiten varias del mismo evaluador al mismo usuario a lo largo del tiempo (sin UNIQUE deliberadamente).';
comment on column public.asistencias.nombre is
  'Solo para invitados no registrados (usuario_id null); los registrados se resuelven vía FK. Escrito por la app móvil.';

-- ===========================================
-- Verificación final de esta fase
-- ===========================================
select 'checks_fase14' as indicador,
       coalesce(string_agg(conname, ', ' order by conname), '(ninguno)') as valor
from pg_constraint
where connamespace = 'public'::regnamespace and contype = 'c'
  and conname in ('ck_calif_rango','ck_pqr_tipo','ck_pqr_estado','ck_pqr_prioridad',
                  'ck_pqr_respuesta','ck_evaluaciones_contenido',
                  'ck_asistencias_estado','ck_login_attempts_intentos')
union all
select 'fks_sin_indice',
       coalesce(string_agg(distinct c.conrelid::regclass::text || '.' ||
         (select attname from pg_attribute
          where attrelid = c.conrelid and attnum = c.conkey[1]), ', '), '(ninguna)')
from pg_constraint c
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and cardinality(c.conkey) = 1
  and not exists (select 1 from pg_index i
                  where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
union all
select 'asignaciones_existe',
       case when to_regclass('public.asignaciones') is null
            then 'no (eliminada)' else 'sí' end;
