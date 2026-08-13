/**
 * ============================================================
 * MODELO: actividades.model.js  (Supabase)
 * ============================================================
 * CRUD de actividades por evento contra public.actividades. ASÍNCRONO.
 *
 * Mapeo app ↔ BD:
 *   titulo (app)   ↔ nombre (BD)
 *   eventoId       ↔ evento_id
 *   voluntarioId   ↔ voluntario_id
 *   voluntarioNombre → embebido vía FK fk_actividades_voluntario
 *                      (actividades.voluntario_id → usuarios.id,
 *                      ON DELETE SET NULL) en la misma consulta —
 *                      antes era una segunda consulta a /usuarios.
 *
 * Requiere window.sb (services/supabase.client.js).
 * ============================================================
 */

const ActividadesModel = (() => {

  const TABLA = 'actividades';
  // Columnas realmente usadas por _fromRow — evita traer filas completas.
  // "usuarios!voluntario_id" desambigua el embed por esa FK específica
  // (mismo patrón que ya usan pqr.model.js y reportes.model.js).
  const SEL = 'id, evento_id, nombre, descripcion, prioridad, voluntario_id, completada, ' +
              'usuarios!voluntario_id(nombre:nombre_completo)';

  function _fromRow(r) {
    return {
      id:               r.id,
      eventoId:         r.evento_id,
      titulo:           r.nombre || '',
      descripcion:      r.descripcion || '',
      prioridad:        r.prioridad || 'media',
      voluntarioId:     r.voluntario_id,
      // FK con ON DELETE SET NULL: si el voluntario fue eliminado,
      // voluntario_id y el embed quedan en null → mismo fallback a ''
      // que antes daba el mapa de nombres cuando el id no aparecía.
      voluntarioNombre: r.usuarios?.nombre || '',
      completada:       r.completada === true,
      creadaEn:         ''
    };
  }

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL);
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getAll', error) : console.error('ActividadesModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getByEvento(eventoId) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('evento_id', eventoId);
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getByEvento', error) : console.error('ActividadesModel.getByEvento')); return []; }
    return (data || []).map(_fromRow);
  }

  // Actividades de varios eventos en una sola consulta (WHERE evento_id IN (...)),
  // acotada a los ids pedidos en vez de traer toda la tabla como getAll().
  async function getByEventos(eventoIds) {
    const uniq = [...new Set((eventoIds || []).filter(Boolean))];
    if (!uniq.length) return [];
    const { data, error } = await DB.from(TABLA).select(SEL).in('evento_id', uniq);
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getByEventos', error) : console.error('ActividadesModel.getByEventos')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function crear(data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.eventoId)       return { ok: false, error: 'El evento es obligatorio.' };
    if (!data.voluntarioId)   return { ok: false, error: 'Debes asignar un voluntario.' };

    const fila = {
      evento_id:     data.eventoId,
      nombre:        data.titulo.trim(),
      descripcion:   data.descripcion?.trim() || null,
      prioridad:     ['alta','media','baja'].includes(data.prioridad) ? data.prioridad : 'media',
      voluntario_id: data.voluntarioId,
      completada:    false
    };
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select(SEL).single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, actividad: _fromRow(ins) };
  }

  async function actualizar(id, data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.voluntarioId)   return { ok: false, error: 'Debes asignar un voluntario.' };

    const fila = {
      nombre:        data.titulo.trim(),
      descripcion:   data.descripcion?.trim() || null,
      prioridad:     ['alta','media','baja'].includes(data.prioridad) ? data.prioridad : 'media',
      voluntario_id: data.voluntarioId
    };
    const { data: upd, error } = await DB.from(TABLA).update(fila).eq('id', id).select(SEL).single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, actividad: _fromRow(upd) };
  }

  async function toggleCompletada(id, completada) {
    const { error } = await DB.from(TABLA).update({ completada: !!completada }).eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function getResumenEvento(eventoId) {
    const acts = await getByEvento(eventoId);
    const completadas = acts.filter(a => a.completada).length;
    return { total: acts.length, completadas, pendientes: acts.length - completadas };
  }

  return { getAll, getByEvento, getByEventos, getById, crear, actualizar, toggleCompletada, eliminar, getResumenEvento };

})();
