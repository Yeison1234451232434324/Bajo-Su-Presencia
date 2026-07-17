-- ============================================================================
--  FASE 12 · DEPURACIÓN FINAL DE ÍNDICES
--  Basada en el listado real de pg_indexes (68 índices). Elimina redundantes:
--  cada uno duplica exactamente a otro índice o queda cubierto por el prefijo
--  de una UNIQUE compuesta. Cero impacto en lecturas; INSERTs/UPDATEs más
--  ligeros. Idempotente.
-- ============================================================================

-- ===========================================
-- 12.1 Duplicados exactos (dos índices únicos sobre las mismas columnas)
-- ===========================================
-- roles.nombre: ux_roles_nombre (lower/trim) es más estricta → sobra la exacta
alter table public.roles drop constraint if exists roles_nombre_key;
drop index if exists public.roles_nombre_key;

-- informes.evento_id: informes_evento_id_key duplica a ux_informes_evento
alter table public.informes drop constraint if exists informes_evento_id_key;
drop index if exists public.informes_evento_id_key;

-- evento_recursos (evento_id, recurso_id): la _key duplica a ux_evento_recursos_par
alter table public.evento_recursos drop constraint if exists evento_recursos_evento_id_recurso_id_key;
drop index if exists public.evento_recursos_evento_id_recurso_id_key;

-- evaluaciones.usuario_id: idx_evaluaciones_user e idx_evaluaciones_usuario
-- son el mismo índice dos veces
drop index if exists public.idx_evaluaciones_user;

-- ===========================================
-- 12.2 Cubiertos por el prefijo de una UNIQUE compuesta
-- ===========================================
-- ux_evaluaciones_evento_usuario(evento_id, usuario_id) ya indexa evento_id
drop index if exists public.idx_evaluaciones_evento;

-- asignaciones_usuario_id_actividad_id_key(usuario_id, actividad_id) ya
-- indexa usuario_id (idx_asignaciones_act sobre actividad_id SÍ se conserva)
drop index if exists public.idx_asignaciones_user;

-- ===========================================
-- 12.3 Cosmético: índices cuyo NOMBRE aún referencia la columna vieja
-- "id_de_evento" (el rename de columnas no renombra índices)
-- ===========================================
alter index if exists public.asistencias_id_de_evento_usuario_id_key
  rename to ux_asistencias_evento_usuario;
alter index if exists public.calificaciones_eventos_id_de_evento_usuario_id_key
  rename to ux_calificaciones_evento_usuario;
alter index if exists public.voluntarios_eventos_id_de_evento_usuario_id_key
  rename to ux_voluntarios_eventos_evento_usuario;

-- ===========================================
-- Verificación: no debe quedar ningún par de índices sobre las mismas
-- columnas de la misma tabla
-- ===========================================
select t.relname as tabla, array_agg(i.relname order by i.relname) as indices_duplicados
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
group by t.relname, x.indkey, coalesce(pg_get_expr(x.indpred, x.indrelid), '')
having count(*) > 1;
