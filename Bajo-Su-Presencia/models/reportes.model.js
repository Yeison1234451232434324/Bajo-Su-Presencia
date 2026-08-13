/**
 * ============================================================
 * MODELO: reportes.model.js  (Supabase)
 * ============================================================
 * Informes/reportes por evento contra public.informes (un informe por
 * evento — evento_id es UNIQUE). Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   ofrenda       ↔ ofrenda_recaudada
 *   eventoId      ↔ evento_id
 *   creadoPor     ↔ creado_por (uuid usuarios; se setea al usuario logueado)
 *                   — embebido vía FK informes.creado_por → usuarios.id
 *                   (ON DELETE SET NULL) en la misma consulta, antes era
 *                   una segunda consulta a /usuarios.
 *   eventoTitulo  ← eventos.titulo (join)
 *   creadoEn      ← creado_en
 * Requiere window.sb y window.miUsuarioId.
 * ============================================================
 */

const ReportesModel = (() => {

  const TABLA = 'informes';
  // Columnas realmente usadas por _fromRow — evita traer filas completas.
  // "usuarios!creado_por" desambigua el embed por esa FK específica
  // (mismo patrón que ya usa pqr.model.js con respondido_por_id).
  const SEL = 'id, evento_id, ofrenda_recaudada, incidentes, observaciones, creado_por, creado_en, ' +
              'eventos(titulo), usuarios!creado_por(nombre:nombre_completo)';

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  function _fromRow(r) {
    return {
      id:            r.id,
      eventoId:      r.evento_id,
      eventoTitulo:  r.eventos?.titulo || '',
      ofrenda:       r.ofrenda_recaudada ?? 0,
      incidentes:    r.incidentes || 'Ninguno',
      observaciones: r.observaciones || '',
      // FK con ON DELETE SET NULL: si el usuario fue eliminado, creado_por
      // y el embed quedan en null → mismo fallback a '' que antes daba el
      // mapa de nombres cuando el id no aparecía.
      creadoPor:     r.usuarios?.nombre || '',
      creadoEn:      (r.creado_en || '').toString().slice(0, 10)
    };
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL);
    if (error) { (window.BSPLog ? window.BSPLog.error('ReportesModel.getAll', error) : console.error('ReportesModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getByEvento(eventoId) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('evento_id', eventoId).maybeSingle();
    if (error || !data) return null;
    return _fromRow(data);
  }

  // Informes de varios eventos en una sola consulta (WHERE evento_id IN (...)),
  // acotada a los ids pedidos en vez de traer toda la tabla como getAll().
  async function getByEventos(eventoIds) {
    const uniq = [...new Set((eventoIds || []).filter(Boolean))];
    if (!uniq.length) return [];
    const { data, error } = await DB.from(TABLA).select(SEL).in('evento_id', uniq);
    if (error) { (window.BSPLog ? window.BSPLog.error('ReportesModel.getByEventos', error) : console.error('ReportesModel.getByEventos')); return []; }
    return (data || []).map(_fromRow);
  }

  async function guardar(data) {
    if (!data.eventoId) return { ok: false, error: 'El evento es obligatorio.' };
    if (data.ofrenda === '' || data.ofrenda === null || isNaN(Number(data.ofrenda)))
      return { ok: false, error: 'La ofrenda recaudada es obligatoria.' };
    if (!data.observaciones?.trim()) return { ok: false, error: 'Las observaciones son obligatorias.' };

    const fila = {
      evento_id:         data.eventoId,
      ofrenda_recaudada: Number(data.ofrenda),
      incidentes:        data.incidentes?.trim() || 'Ninguno',
      observaciones:     data.observaciones.trim(),
      creado_por:        await window.miUsuarioId()
    };

    const { data: ya } = await DB.from(TABLA).select('id').eq('evento_id', data.eventoId).maybeSingle();
    let res;
    if (ya) res = await DB.from(TABLA).update(fila).eq('id', ya.id).select(SEL).single();
    else    res = await DB.from(TABLA).insert(fila).select(SEL).single();
    if (res.error) return { ok: false, error: _msg(res.error) };
    return { ok: true, reporte: _fromRow(res.data) };
  }

  async function eliminar(eventoId) {
    const { error } = await DB.from(TABLA).delete().eq('evento_id', eventoId);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getByEvento, getByEventos, guardar, eliminar };

})();
