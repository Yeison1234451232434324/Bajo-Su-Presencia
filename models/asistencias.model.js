/**
 * ============================================================
 * MODELO: asistencias.model.js  (Supabase)
 * ============================================================
 * Lectura de asistencias (la app móvil las escribe vía QR/reserva).
 * La calificación del evento por el asistente se toma de
 * calificaciones_eventos (promedio de ujieres/sonido/mensaje).
 * Métodos ASÍNCRONOS. Requiere window.sb.
 *
 * Mapeo app ↔ BD:
 *   eventoId↔id_de_evento, email↔correo, telefono↔teléfono,
 *   asistio↔asistió, fechaInscripcion↔fecha_inscripción,
 *   fechaAsistencia↔fecha_asistencia, metodo↔método
 * ============================================================
 */

const AsistenciasModel = (() => {

  const TABLA = 'asistencias';

  function _fromRow(r, califMap) {
    const calif = califMap[`${r.id_de_evento}|${r.usuario_id}`] || null;
    return {
      id:               r.id,
      eventoId:         r.id_de_evento,
      eventoNombre:     r.eventos?.titulo || '',
      eventoFecha:      r.eventos?.fecha || '',
      nombre:           r.nombre || '',
      email:            r.correo || '',
      telefono:         r['teléfono'] || '',
      inscrito:         r.inscrito !== false,
      fechaInscripcion: (r['fecha_inscripción'] || '').toString().slice(0, 10),
      asistio:          r['asistió'] === true,
      fechaAsistencia:  r.fecha_asistencia ? r.fecha_asistencia.toString().slice(0, 16).replace('T', ' ') : null,
      metodo:           r['método'] || null,
      calificacion:     calif ? calif.estrellas : null,
      comentario:       calif ? calif.testimonio : ''
    };
  }

  // Construye un mapa de calificaciones de evento por (evento|usuario)
  async function _califMap() {
    const { data } = await sb.from('calificaciones_eventos').select('id_de_evento, usuario_id, ujieres, sonido, mensaje, testimonio');
    const map = {};
    (data || []).forEach(c => {
      const est = Math.round(((c.ujieres || 0) + (c.sonido || 0) + (c.mensaje || 0)) / 3);
      map[`${c.id_de_evento}|${c.usuario_id}`] = { estrellas: est, testimonio: c.testimonio || '' };
    });
    return map;
  }

  async function getAll() {
    const { data, error } = await sb.from(TABLA).select('*, eventos(titulo, fecha)');
    if (error) { console.error('AsistenciasModel.getAll:', error); return []; }
    const califMap = await _califMap();
    return (data || []).map(r => _fromRow(r, califMap));
  }

  async function getByEvento(eventoId) {
    const todas = await getAll();
    return todas.filter(a => a.eventoId === eventoId);
  }

  async function getEventos() {
    const todas = await getAll();
    const mapa = new Map();
    todas.forEach(a => {
      if (!mapa.has(a.eventoId)) mapa.set(a.eventoId, { id: a.eventoId, nombre: a.eventoNombre, fecha: a.eventoFecha });
    });
    return [...mapa.values()].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }

  async function getResumen(eventoId = null) {
    const datos = eventoId != null ? await getByEvento(eventoId) : await getAll();
    const inscritos    = datos.filter(a => a.inscrito).length;
    const asistieron   = datos.filter(a => a.asistio).length;
    const noAsistieron = inscritos - asistieron;
    const porcentaje   = inscritos > 0 ? Math.round((asistieron / inscritos) * 100) : 0;
    const conCalif     = datos.filter(a => typeof a.calificacion === 'number' && a.calificacion > 0);
    const promedio     = conCalif.length > 0
      ? Math.round((conCalif.reduce((s, a) => s + a.calificacion, 0) / conCalif.length) * 10) / 10 : 0;
    return { inscritos, asistieron, noAsistieron, porcentaje, calificaciones: conCalif.length, promedio };
  }

  return { getAll, getByEvento, getEventos, getResumen };

})();
