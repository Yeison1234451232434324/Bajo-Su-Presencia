-- ================================================================
--  MIGRACIÓN: tabla `auditoria_acciones`
-- ================================================================
--  Registra las acciones administrativas ejecutadas desde el panel:
--  quién (usuario_id/correo/rol —capturados del JWT en el momento de la
--  acción, NO por join posterior: si el usuario cambia de correo o se
--  elimina más adelante, el registro histórico conserva el dato real de
--  cuando ocurrió la acción), qué (accion/modulo/registro_id),
--  cuándo (creado_en) y el resultado (éxito/error).
--
--  Escritura EXCLUSIVA del backend (service_role):
--    - backend/src/Controllers/DataGatewayController.php (centraliza la
--      mayoría de las escrituras administrativas: eventos, noticias,
--      oraciones, actividades, recursos, voluntarios_eventos,
--      calificaciones_eventos, evaluaciones, informes, sedes, pqr, donaciones).
--    - backend/src/Controllers/UsuariosController.php (CRUD de usuarios,
--      fuera del Data Gateway).
--    - backend/src/Controllers/PqrController.php (responder / cambiar
--      estado, fuera del Data Gateway).
--  Ver backend/src/Support/AuditLogger.php.
--
--  Lectura EXCLUSIVA del backend vía un controlador dedicado
--  (AuditoriaController, protegido con rol Administrador) — a propósito
--  NO se añade a la lista blanca del Data Gateway genérico
--  (DataGatewayController::TABLES), porque ese gateway permite lectura a
--  CUALQUIER usuario autenticado una vez la tabla está en la lista, y la
--  auditoría debe ser visible solo para Administrador.
--
--  Idempotente: re-ejecutable sin duplicar objetos.
-- ================================================================

create table if not exists public.auditoria_acciones (
  id              uuid        primary key default gen_random_uuid(),
  usuario_id      uuid        references public.usuarios(id) on delete set null,
  usuario_correo  text,
  usuario_rol     text,
  accion          text        not null,
  modulo          text        not null,
  registro_id     uuid,
  descripcion     text        not null,
  resultado       text        not null default 'exito' check (resultado in ('exito', 'error')),
  creado_en       timestamptz not null default now()
);

comment on table public.auditoria_acciones is
  'Bitácora de acciones administrativas del panel. Solo escritura/lectura desde el backend (service_role) — ver AuditLogger y AuditoriaController. Es de solo lectura para la aplicación: no existe ningún endpoint de edición/eliminación.';

-- Índices: uno por cada filtro real que expone el panel (AuditoriaController)
-- más el orden por defecto (más reciente primero). No se agregan índices
-- sin un filtro/orden que los use.
create index if not exists idx_auditoria_creado_en      on public.auditoria_acciones (creado_en desc);
create index if not exists idx_auditoria_modulo         on public.auditoria_acciones (modulo);
create index if not exists idx_auditoria_accion         on public.auditoria_acciones (accion);
create index if not exists idx_auditoria_resultado      on public.auditoria_acciones (resultado);
create index if not exists idx_auditoria_usuario_correo on public.auditoria_acciones (usuario_correo);

-- RLS: sin políticas públicas. Solo el backend (service_role) accede,
-- igual que `donaciones` y el resto de tablas administrativas.
alter table public.auditoria_acciones enable row level security;
