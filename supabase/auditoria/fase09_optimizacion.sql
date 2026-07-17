-- ============================================================================
--  FASE 9 · OPTIMIZACIÓN Y ESCALABILIDAD
--  - Timestamps uniformes creado_en/actualizado_en con trigger (soporta
--    sincronización incremental del móvil y auditoría de cambios)
--  - Vistas agregadas en SQL para reemplazar el patrón "descargar toda la
--    tabla y filtrar en JavaScript" de los modelos
--  - Estadísticas frescas para el planificador
--  Requiere: FASES 1-6. Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 9.1 Trigger genérico: mantiene actualizado_en al día en cada UPDATE
-- ===========================================
create or replace function public.tg_set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ===========================================
-- 9.2 creado_en / actualizado_en en todas las tablas de negocio que no
-- los tengan (nombres en español, consistentes con el resto del esquema)
-- ===========================================
do $$
declare t text;
begin
  foreach t in array array[
    'usuarios','roles','sedes','eventos','recursos','evento_recursos',
    'noticias','oraciones','actividades','asignaciones','evaluaciones',
    'informes','asistencias','calificaciones_eventos','notificaciones',
    'pqr','voluntarios_eventos','especialidades','usuario_especialidades'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    if not aud.col_exists(t, 'creado_en') and not aud.col_exists(t, 'created_at') then
      execute format('alter table public.%I add column creado_en timestamptz not null default now()', t);
    end if;
    if not aud.col_exists(t, 'actualizado_en') then
      execute format('alter table public.%I add column actualizado_en timestamptz not null default now()', t);
    end if;

    execute format('drop trigger if exists tg_actualizado_en on public.%I', t);
    execute format('create trigger tg_actualizado_en before update on public.%I
                    for each row execute function public.tg_set_actualizado_en()', t);
  end loop;
end $$;

-- ===========================================
-- 9.3 Vista: resumen de asistencia por evento.
-- Reemplaza el getAll()+filtrado en memoria de asistencias.model.js: el
-- conteo y el promedio se calculan EN la base, no en el navegador.
-- Hereda las políticas RLS de las tablas base (security_invoker).
-- ===========================================
create or replace view public.v_resumen_asistencias
with (security_invoker = true) as
select
  e.id                                            as evento_id,
  e.titulo,
  e.fecha,
  count(a.id) filter (where a.estado <> 'cancelada')                as inscritos,
  count(a.id) filter (where a.estado in ('asistida','calificada'))  as asistieron,
  round(100.0 * count(a.id) filter (where a.estado in ('asistida','calificada'))
        / nullif(count(a.id) filter (where a.estado <> 'cancelada'), 0)) as porcentaje,
  count(c.id)                                                        as calificaciones,
  round(avg(( coalesce(c.ujieres,0) + coalesce(c.sonido,0) + coalesce(c.mensaje,0) )::numeric
        / nullif( (c.ujieres is not null)::int + (c.sonido is not null)::int
                + (c.mensaje is not null)::int, 0)), 1)              as promedio_calificacion
from public.eventos e
left join public.asistencias            a on a.evento_id = e.id
left join public.calificaciones_eventos c on c.evento_id = e.id
group by e.id, e.titulo, e.fecha;

grant select on public.v_resumen_asistencias to authenticated;

-- ===========================================
-- 9.4 Vista: asistencias con su calificación (sustituye el _califMap que
-- descargaba TODA la tabla calificaciones_eventos en el cliente)
-- ===========================================
create or replace view public.v_asistencias_detalle
with (security_invoker = true) as
select
  a.*,
  e.titulo  as evento_titulo,
  e.fecha   as evento_fecha,
  round(( coalesce(c.ujieres,0) + coalesce(c.sonido,0) + coalesce(c.mensaje,0) )::numeric
        / nullif( (c.ujieres is not null)::int + (c.sonido is not null)::int
                + (c.mensaje is not null)::int, 0))  as calificacion,
  c.testimonio
from public.asistencias a
join public.eventos e on e.id = a.evento_id
left join public.calificaciones_eventos c
       on c.evento_id = a.evento_id and c.usuario_id = a.usuario_id;

grant select on public.v_asistencias_detalle to authenticated;

-- ===========================================
-- 9.5 Estadísticas frescas para el planificador tras todos los cambios
-- ===========================================
analyze;
