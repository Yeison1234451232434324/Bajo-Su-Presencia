/**
 * ============================================================
 * MODELO: voluntarios.model.js  (Supabase)
 * ============================================================
 * - Eventos con sus voluntarios asignados  → voluntarios_eventos
 * - Calificaciones de voluntarios           → evaluaciones
 *   (esquema certificado: una columna "estrellas" 1-5, evaluador_id FK
 *    a usuarios y evaluado_en timestamptz)
 * - Disponibilidad del voluntario           → voluntarios_eventos.disponible
 * Métodos ASÍNCRONOS. Requiere window.DB (controllers/db.client.js → Data Gateway PHP).
 * ============================================================
 */

const VoluntariosModel = (() => {

  const EVENTOS = 'eventos';
  const VE      = 'voluntarios_eventos';
  const EVAL    = 'evaluaciones';

  const SEL_EV = 'id, titulo, fecha, ubicacion, voluntarios_necesarios, ' +
                 'voluntarios_eventos(usuario_id, rol_en_evento, disponible, usuarios(nombre:nombre_completo))';

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  // evaluaciones tiene DOS FKs a usuarios (usuario_id y evaluador_id):
  // el embed debe desambiguarse con el nombre de la columna.
  const SEL_EVAL = '*, eventos(titulo), voluntario:usuarios!usuario_id(nombre:nombre_completo)';

  function _evToVol(e) {
    return {
      id:                    e.id,
      nombre:                e.titulo || '',
      fecha:                 e.fecha || '',
      lugar:                 e.ubicacion || '',
      voluntariosNecesarios: e.voluntarios_necesarios || 0,
      voluntarios: (e.voluntarios_eventos || []).map(v => ({
        id:         v.usuario_id,
        nombre:     v.usuarios?.nombre || '',
        rol:        v.rol_en_evento || 'Voluntario',
        disponible: v.disponible !== false
      }))
    };
  }

  function _calif(c) {
    return {
      id:               c.id,
      eventoId:         c.evento_id,
      eventoNombre:     c.eventos?.titulo || '',
      voluntarioId:     c.usuario_id,
      voluntarioNombre: c.voluntario?.nombre || '',
      estrellas:        c.estrellas || 0,
      comentario:       c.comentarios || '',
      fecha:            (c.evaluado_en || '').toString().slice(0, 10)
    };
  }

  // ── EVENTOS + voluntarios ──────────────────────────────────────────────────
  async function getEventos() {
    const { data, error } = await DB.from(EVENTOS).select(SEL_EV).order('fecha', { ascending: true });
    if (error) { (window.BSPLog ? window.BSPLog.error('VoluntariosModel.getEventos', error) : console.error('VoluntariosModel.getEventos')); return []; }
    return (data || []).map(_evToVol);
  }

  async function getEventoById(id) {
    const { data, error } = await DB.from(EVENTOS).select(SEL_EV).eq('id', id).single();
    if (error || !data) return null;
    return _evToVol(data);
  }

  // ── CALIFICACIONES ──────────────────────────────────────────────────────────
  async function getCalificaciones() {
    const { data, error } = await DB.from(EVAL).select(SEL_EVAL);
    if (error) { (window.BSPLog ? window.BSPLog.error('VoluntariosModel.getCalificaciones', error) : console.error('VoluntariosModel.getCalificaciones')); return []; }
    return (data || []).map(_calif);
  }

  async function getCalifByEventoVoluntario(eventoId, voluntarioId) {
    const { data } = await DB.from(EVAL).select('*, eventos(titulo)')
      .eq('evento_id', eventoId).eq('usuario_id', voluntarioId).maybeSingle();
    return data ? _calif(data) : null;
  }

  async function guardarCalificacion(data) {
    if (data.estrellas < 1 || data.estrellas > 5) return { ok: false, error: 'Las estrellas deben ser entre 1 y 5.' };
    // evaluador_id: FK real al usuario logueado (ya no un nombre editable)
    const evaluadorId = (typeof window.miUsuarioId === 'function') ? await window.miUsuarioId() : null;
    const fila = {
      evento_id:    data.eventoId,
      usuario_id:   data.voluntarioId,
      evaluador_id: evaluadorId,
      estrellas:    data.estrellas,
      comentarios:  data.comentario || null,
      evaluado_en:  new Date().toISOString()
    };
    const { data: ya } = await DB.from(EVAL).select('id')
      .eq('evento_id', data.eventoId).eq('usuario_id', data.voluntarioId).maybeSingle();
    let error;
    if (ya) ({ error } = await DB.from(EVAL).update(fila).eq('id', ya.id));
    else    ({ error } = await DB.from(EVAL).insert(fila));
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function getHistorialVoluntario(voluntarioId) {
    const { data } = await DB.from(EVAL).select(SEL_EVAL).eq('usuario_id', voluntarioId);
    return (data || []).map(_calif);
  }

  async function getResumenVoluntario(voluntarioId) {
    const historial = await getHistorialVoluntario(voluntarioId);
    if (!historial.length) return { promedio: 0, total: 0, distribucion: {1:0,2:0,3:0,4:0,5:0}, mejor: null, peor: null };
    const suma = historial.reduce((a, c) => a + c.estrellas, 0);
    const distribucion = {1:0,2:0,3:0,4:0,5:0};
    historial.forEach(c => { distribucion[c.estrellas] = (distribucion[c.estrellas] || 0) + 1; });
    const mejor = historial.reduce((a, b) => a.estrellas >= b.estrellas ? a : b);
    const peor  = historial.reduce((a, b) => a.estrellas <= b.estrellas ? a : b);
    return { promedio: Math.round((suma / historial.length) * 10) / 10, total: historial.length, distribucion, mejor, peor };
  }

  // ── DISPONIBILIDAD ──────────────────────────────────────────────────────────
  async function estaInscrito(eventoId, voluntarioId) {
    const { data } = await DB.from(VE).select('id, disponible')
      .eq('evento_id', eventoId).eq('usuario_id', voluntarioId).maybeSingle();
    return data || null;
  }

  async function unirseEvento(eventoId, voluntarioId, rol) {
    const { error } = await DB.from(VE).insert({
      evento_id: eventoId, usuario_id: voluntarioId, rol_en_evento: rol || 'Voluntario General', disponible: true
    });
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function setDisponibilidad(eventoId, voluntarioId, disponible) {
    const { error } = await DB.from(VE).update({ disponible })
      .eq('evento_id', eventoId).eq('usuario_id', voluntarioId);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return {
    getEventos, getEventoById,
    getCalificaciones, getCalifByEventoVoluntario, guardarCalificacion,
    getHistorialVoluntario, getResumenVoluntario,
    estaInscrito, unirseEvento, setDisponibilidad
  };

})();
