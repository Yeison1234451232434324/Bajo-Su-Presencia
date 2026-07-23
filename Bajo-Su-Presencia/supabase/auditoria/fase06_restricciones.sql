-- ============================================================================
--  FASE 6 · RESTRICCIONES — CHECK, NOT NULL y DEFAULT faltantes
--  (hasta hoy estas reglas vivían solo en JavaScript: cualquier cliente de la
--   API de Supabase podía insertar datos inválidos)
--  Usa aud.add_check: si quedaran filas históricas en conflicto, el CHECK se
--  crea NOT VALID y se avisa — nada falla.
--  Requiere: FASES 1-4. Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 6.1 Cantidades y montos nunca negativos
-- ===========================================
select aud.add_check('recursos',        'ck_recursos_cantidad',       'cantidad >= 0');
select aud.add_check('evento_recursos', 'ck_evento_recursos_cantidad','cantidad >= 1');
select aud.add_check('eventos',         'ck_eventos_cupos',
                     'cupos_disponibles is null or cupos_disponibles >= 0');
select aud.add_check('eventos',         'ck_eventos_voluntarios',
                     'voluntarios_necesarios is null or voluntarios_necesarios >= 0');
select aud.add_check('informes',        'ck_informes_ofrenda',
                     'ofrenda_recaudada is null or ofrenda_recaudada >= 0');

-- ===========================================
-- 6.2 Coherencia temporal del evento (mismo día: fin > inicio).
-- Si el ministerio realiza vigilias que cruzan medianoche, eliminar este
-- CHECK y modelar inicio/fin como timestamptz.
-- ===========================================
select aud.add_check('eventos', 'ck_eventos_horario',
                     'hora is null or hora_fin is null or hora_fin > hora');

-- ===========================================
-- 6.3 asistencias: toda fila identifica a alguien; el estado gobierna
-- el ciclo de vida y exige su evidencia (fecha_asistencia)
-- ===========================================
select aud.add_check('asistencias', 'ck_asistencias_identidad',
                     'usuario_id is not null or nombre is not null or correo is not null');
select aud.add_check('asistencias', 'ck_asistencias_fecha_asistencia',
                     $$estado not in ('asistida','calificada') or fecha_asistencia is not null$$);

-- ===========================================
-- 6.4 calificaciones_eventos: al menos un criterio calificado
-- ===========================================
select aud.add_check('calificaciones_eventos', 'ck_calif_alguna',
                     'ujieres is not null or sonido is not null or mensaje is not null');

-- ===========================================
-- 6.5 evaluaciones: estrellas en [1,5] (columna nueva de la FASE 4)
-- ===========================================
select aud.add_check('evaluaciones', 'ck_evaluaciones_estrellas',
                     'estrellas is null or estrellas between 1 and 5');

-- ===========================================
-- 6.6 pqr: formato mínimo de correo (lo inserta el rol anon desde el form
-- público). Si hay históricos inválidos queda NOT VALID: exige solo a lo nuevo
-- ===========================================
select aud.add_check('pqr', 'ck_pqr_correo',
                     $$correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'$$);

-- ===========================================
-- 6.7 eventos: catálogo de categoría (antes solo era un comentario en SQL)
-- y estado con el valor 'Cancelado' que faltaba en el dominio
-- ===========================================
select aud.add_check('eventos', 'ck_eventos_categoria',
  $$categoria is null or categoria in
    ('Servicio Principal','Jóvenes','Cursos','Célula','Evento Especial')$$);

do $$ begin
  alter table public.eventos drop constraint if exists eventos_estado_check;
  alter table public.eventos drop constraint if exists ck_eventos_estado;
  update public.eventos set estado = 'Publicado'
   where estado is null or estado not in ('Publicado','En ejecución','Finalizado','Cancelado');
  alter table public.eventos add constraint ck_eventos_estado
    check (estado in ('Publicado','En ejecución','Finalizado','Cancelado'));
exception when others then
  raise notice 'ck_eventos_estado: %', sqlerrm;
end $$;

-- ===========================================
-- 6.8 actividades: prioridad dentro del dominio que ya valida el JS
-- ===========================================
do $f68$ begin
  if to_regclass('public.actividades') is null then return; end if;
  update public.actividades set prioridad = 'media'
   where prioridad is null or prioridad not in ('alta','media','baja');
  perform aud.add_check('actividades', 'ck_actividades_prioridad',
                        $$prioridad in ('alta','media','baja')$$);
end $f68$;

-- ===========================================
-- 6.9 NOT NULL: una notificación sin destinatario no significa nada
-- (las huérfanas se eliminaron en la FASE 2.13)
-- ===========================================
do $$ begin
  alter table public.notificaciones alter column usuario_id set not null;
exception when others then
  raise notice 'notificaciones.usuario_id NOT NULL: %', sqlerrm;
end $$;

-- ===========================================
-- 6.10 DEFAULT + NOT NULL en timestamps de creación de las tablas nuevas
-- (creado_en era nullable sin razón)
-- ===========================================
do $$
declare t text;
begin
  foreach t in array array['asistencias','calificaciones_eventos','notificaciones',
                           'pqr','voluntarios_eventos'] loop
    if not aud.col_exists(t, 'creado_en') then continue; end if;
    execute format('update public.%I set creado_en = now() where creado_en is null', t);
    execute format('alter table public.%I alter column creado_en set default now()', t);
    execute format('alter table public.%I alter column creado_en set not null', t);
  end loop;
end $$;

-- ===========================================
-- 6.11 usuarios.activo: sin tri-estado accidental (NULL ≠ inactivo)
-- ===========================================
do $$ begin
  update public.usuarios set activo = true where activo is null;
  alter table public.usuarios alter column activo set default true;
  alter table public.usuarios alter column activo set not null;
exception when others then
  raise notice 'usuarios.activo: %', sqlerrm;
end $$;

-- ===========================================
-- 6.12 Validar el CHECK de categorías de recursos que quedó NOT VALID
-- (los datos ya fueron normalizados a 'Otros' por el script de ajustes)
-- ===========================================
do $$ begin
  alter table public.recursos validate constraint recursos_categoria_check;
exception when others then
  raise notice 'recursos_categoria_check: %', sqlerrm;
end $$;
