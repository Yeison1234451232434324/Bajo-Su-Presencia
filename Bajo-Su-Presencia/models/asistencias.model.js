/**
 * ============================================================
 * MODELO: asistencias.model.js  (Supabase)
 * ============================================================
 * Lectura de asistencias (la app móvil las escribe vía QR/reserva).
 * La calificación del evento por el asistente se toma de
 * calificaciones_eventos (promedio de ujieres/sonido/mensaje).
 * Métodos ASÍNCRONOS. Requiere window.DB (controllers/db.client.js → Data Gateway PHP).
 *
 * Mapeo app ↔ BD (esquema certificado):
 *   eventoId↔evento_id, email↔correo, telefono↔telefono,
 *   fechaInscripcion↔fecha_inscripcion, fechaAsistencia↔fecha_asistencia,
 *   metodo↔metodo. Los booleanos inscrito/asistio se DERIVAN de "estado"
 *   (confirmada→asistida→calificada / cancelada), única fuente de verdad.
 * ============================================================
 */

const AsistenciasModel = (() => {

  const TABLA = 'asistencias';

  function _fromRow(r, califMap) {
    const calif = califMap[`${r.evento_id}|${r.usuario_id}`] || null;
    return {
      id:               r.id,
      eventoId:         r.evento_id,
      eventoNombre:     r.eventos?.titulo || '',
      eventoFecha:      r.eventos?.fecha || '',
      nombre:           r.nombre || '',
      email:            r.correo || '',
      telefono:         r.telefono || '',
      inscrito:         r.estado !== 'cancelada',
      fechaInscripcion: (r.fecha_inscripcion || '').toString().slice(0, 10),
      asistio:          r.estado === 'asistida' || r.estado === 'calificada',
      fechaAsistencia:  r.fecha_asistencia ? r.fecha_asistencia.toString().slice(0, 16).replace('T', ' ') : null,
      metodo:           r.metodo || null,
      calificacion:     calif ? calif.estrellas : null,
      comentario:       calif ? calif.testimonio : ''
    };
  }

  // Construye un mapa de calificaciones de evento por (evento|usuario)
  async function _califMap() {
    const { data } = await DB.from('calificaciones_eventos').select('evento_id, usuario_id, ujieres, sonido, mensaje, testimonio');
    const map = {};
    (data || []).forEach(c => {
      const est = Math.round(((c.ujieres || 0) + (c.sonido || 0) + (c.mensaje || 0)) / 3);
      map[`${c.evento_id}|${c.usuario_id}`] = { estrellas: est, testimonio: c.testimonio || '' };
    });
    return map;
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select('*, eventos(titulo, fecha)');
    if (error) { (window.BSPLog ? window.BSPLog.error('AsistenciasModel.getAll', error) : console.error('AsistenciasModel.getAll')); return []; }
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
