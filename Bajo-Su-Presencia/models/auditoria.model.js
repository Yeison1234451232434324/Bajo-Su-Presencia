/**
 * ============================================================
 * MODELO: auditoria.model.js  (backend PHP dedicado)
 * ============================================================
 * Solo lectura. A diferencia del resto de modelos del panel, NO usa
 * window.DB (Data Gateway genérico): ese gateway permite lectura a
 * CUALQUIER usuario autenticado una vez la tabla está en su lista blanca, y
 * la auditoría debe ser visible solo para el rol Administrador. Por eso
 * llama directamente al endpoint dedicado GET /api/auditoria
 * (AuditoriaController, protegido con AuthMiddleware::authorize(['Administrador'])).
 *
 * Requiere window.apiFetch (config/api.config.js) y una sesión Administrador.
 * ============================================================
 */

const AuditoriaModel = (() => {

  const ACCIONES = [
    'crear', 'editar', 'eliminar', 'activar', 'desactivar',
    'responder', 'cambiar_estado'
  ];

  const MODULOS = [
    'usuarios', 'eventos', 'noticias', 'oraciones', 'actividades',
    'recursos', 'evento_recursos', 'voluntarios_eventos',
    'calificaciones_eventos', 'evaluaciones', 'informes', 'sedes',
    'pqr', 'donaciones'
  ];

  const RESULTADOS = ['exito', 'error'];

  function _fromRow(r) {
    return {
      id:             r.id,
      usuarioId:      r.usuario_id,
      usuarioCorreo:  r.usuario_correo || '—',
      usuarioRol:     r.usuario_rol || '—',
      accion:         r.accion || '',
      modulo:         r.modulo || '',
      registroId:     r.registro_id,
      descripcion:    r.descripcion || '',
      resultado:      r.resultado || 'exito',
      creadoEn:       r.creado_en || '',
      fecha:          (r.creado_en || '').toString().slice(0, 10)
    };
  }

  /**
   * Lista registros de auditoría.
   * @param {Object} [filtros] { usuario, modulo, accion, resultado, desde, hasta, limite }
   */
  async function listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    try {
      const data = await window.apiFetch(`/api/auditoria${qs ? '?' + qs : ''}`);
      return (data || []).map(_fromRow);
    } catch (e) {
      (window.BSPLog ? window.BSPLog.error('AuditoriaModel.listar', e) : console.error('AuditoriaModel.listar'));
      return [];
    }
  }

  return { listar, ACCIONES, MODULOS, RESULTADOS };

})();
