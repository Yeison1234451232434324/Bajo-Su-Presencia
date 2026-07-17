-- ============================================================================
--  FASE 3 · CONVENCIONES DE NOMBRES
--  Estándar adoptado: snake_case, ASCII puro (sin tildes/eñes/mayúsculas),
--  FK unificada como <tabla_singular>_id  (evento_id, NUNCA id_de_evento).
--  Requiere: FASE 1 (helper aud.rename_col). Re-ejecutable: cada rename solo
--  ocurre si la columna vieja existe y la nueva no.
--
--  ⚠ ROMPIENTE PARA LAS APPS: tras esta fase hay que actualizar los modelos
--    JS y el backend PHP que usan los nombres viejos (lista al final).
-- ============================================================================

-- ===========================================
-- usuarios: quitar tildes
-- ===========================================
select aud.rename_col('usuarios', 'teléfono',  'telefono');
select aud.rename_col('usuarios', 'ubicación', 'ubicacion');
select aud.rename_col('usuarios', 'ocupación', 'ocupacion');

-- ===========================================
-- eventos: quitar tildes (código_qr se renombra aquí y en la FASE 4
-- se muda a su propia tabla privada eventos_qr)
-- ===========================================
select aud.rename_col('eventos', 'categoría', 'categoria');
select aud.rename_col('eventos', 'código_qr', 'codigo_qr');

-- ===========================================
-- asistencias: unificar FK + quitar tildes
-- ===========================================
select aud.rename_col('asistencias', 'id_de_evento',       'evento_id');
select aud.rename_col('asistencias', 'teléfono',           'telefono');
select aud.rename_col('asistencias', 'fecha_inscripción',  'fecha_inscripcion');
select aud.rename_col('asistencias', 'asistió',            'asistio');   -- se elimina en FASE 4
select aud.rename_col('asistencias', 'método',             'metodo');

-- ===========================================
-- calificaciones_eventos / voluntarios_eventos / evaluaciones: FK unificada
-- ===========================================
select aud.rename_col('calificaciones_eventos', 'id_de_evento', 'evento_id');
select aud.rename_col('voluntarios_eventos',    'id_de_evento', 'evento_id');
select aud.rename_col('evaluaciones',           'id_de_evento', 'evento_id');

-- evaluaciones.fecha guarda un timestamp completo: nombre veraz
select aud.rename_col('evaluaciones', 'fecha', 'evaluado_en');

-- ===========================================
-- notificaciones: quitar tildes
-- ===========================================
select aud.rename_col('notificaciones', 'categoría', 'categoria');
select aud.rename_col('notificaciones', 'título',    'titulo');
select aud.rename_col('notificaciones', 'leída',     'leida');

-- ===========================================
-- pqr: quitar tildes
-- ===========================================
select aud.rename_col('pqr', 'teléfono',    'telefono');
select aud.rename_col('pqr', 'descripción', 'descripcion');

-- ===========================================
-- recursos / oraciones / noticias: quitar tildes y la mayúscula huérfana
-- ===========================================
select aud.rename_col('recursos',  'descripción', 'descripcion');
select aud.rename_col('oraciones', 'título',      'titulo');
select aud.rename_col('noticias',  'Descripcion', 'descripcion');

-- ============================================================================
--  IMPACTO EN CÓDIGO (actualizar tras ejecutar esta fase):
--   - models/asistencias.model.js   → evento_id, telefono, fecha_inscripcion,
--                                     metodo (y estado en vez de asistio, FASE 4)
--   - models/eventos.model.js       → _syncEspecialistas: evento_id
--   - models/voluntarios.model.js   → evento_id en VE y EVAL; evaluado_en
--   - models/pqr.model.js           → telefono, descripcion
--   - models/recursos.model.js      → descripcion
--   - models/usuarios.model.js      → telefono, ubicacion, ocupacion
--   - models/noticias.model.js      → descripcion (antes "Descripcion")
--   - backend: SupabaseClient/UsuariosService si consultan columnas con tilde
-- ============================================================================
