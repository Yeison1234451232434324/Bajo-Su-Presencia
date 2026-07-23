-- ============================================================================
--  FASE 7 · ÍNDICES — eliminar redundantes, crear faltantes
--  Requiere: FASES 1-5 (nombres finales de columnas). Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 7.1 Redundantes: la UNIQUE (evento_id, usuario_id) de cada tabla ya indexa
-- por evento_id como prefijo. Estos tres solo encarecían cada INSERT.
-- ===========================================
drop index if exists public.idx_asistencias_evento;
drop index if exists public.idx_voleventos_evento;
drop index if exists public.idx_califeventos_evento;

-- ===========================================
-- 7.2 FKs sin índice (aceleran JOINs embebidos de PostgREST y las cascadas)
-- ===========================================
-- usuarios.rol_id: lo consulta mi_rol() en CADA evaluación de política RLS
create index if not exists idx_usuarios_rol on public.usuarios (rol_id);

create index if not exists idx_evaluaciones_usuario on public.evaluaciones (usuario_id);
create index if not exists idx_evaluaciones_evento  on public.evaluaciones (evento_id);
create index if not exists idx_informes_creado_por  on public.informes (creado_por);

do $$ begin
  if to_regclass('public.evento_recursos') is not null then
    create index if not exists idx_evento_recursos_recurso
      on public.evento_recursos (recurso_id);
  end if;
  if to_regclass('public.actividades') is not null then
    create index if not exists idx_actividades_evento
      on public.actividades (evento_id);
    create index if not exists idx_actividades_voluntario
      on public.actividades (voluntario_id);
  end if;
end $$;

-- ===========================================
-- 7.3 Filtros y ordenamientos frecuentes de las apps
-- ===========================================
-- eventos: ambas apps listan ordenando por fecha y filtran por estado
create index if not exists idx_eventos_fecha  on public.eventos (fecha);
create index if not exists idx_eventos_estado on public.eventos (estado);

-- contenido público: orden cronológico inverso
create index if not exists idx_noticias_publicado  on public.noticias  (publicado_en desc);
create index if not exists idx_oraciones_publicado on public.oraciones (publicado_en desc);

-- bandeja PQR: orden por llegada
create index if not exists idx_pqr_creado on public.pqr (creado_en desc);

-- ===========================================
-- 7.4 Índice PARCIAL para la bandeja de notificaciones no leídas:
-- diminuto y ultrarrápido (solo indexa las pendientes)
-- ===========================================
do $$ begin
  create index if not exists idx_notif_usuario_noleidas
    on public.notificaciones (usuario_id) where leida = false;
exception when undefined_column then
  -- si la FASE 3 no se ha ejecutado aún, la columna conserva la tilde
  create index if not exists idx_notif_usuario_noleidas
    on public.notificaciones (usuario_id) where "leída" = false;
end $$;
