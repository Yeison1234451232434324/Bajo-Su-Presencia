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
 *   voluntarioNombre → se resuelve desde usuarios (query aparte)
 *
 * Requiere window.sb (services/supabase.client.js).
 * ============================================================
 */

const ActividadesModel = (() => {

  const TABLA = 'actividades';

  function _fromRow(r, nombres) {
    return {
      id:               r.id,
      eventoId:         r.evento_id,
      titulo:           r.nombre || '',
      descripcion:      r.descripcion || '',
      prioridad:        r.prioridad || 'media',
      voluntarioId:     r.voluntario_id,
      voluntarioNombre: (nombres && nombres[r.voluntario_id]) || '',
      completada:       r.completada === true,
      creadaEn:         ''
    };
  }

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  // Resuelve nombres de usuarios por id (para mostrar el voluntario asignado)
  async function _nombres(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return {};
    const { data } = await DB.from('usuarios').select('id, nombre:nombre_completo').in('id', uniq);
    const map = {};
    (data || []).forEach(u => { map[u.id] = u.nombre; });
    return map;
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select('*');
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getAll', error) : console.error('ActividadesModel.getAll')); return []; }
    const nombres = await _nombres((data || []).map(a => a.voluntario_id));
    return (data || []).map(a => _fromRow(a, nombres));
  }

  async function getByEvento(eventoId) {
    const { data, error } = await DB.from(TABLA).select('*').eq('evento_id', eventoId);
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getByEvento', error) : console.error('ActividadesModel.getByEvento')); return []; }
    const nombres = await _nombres((data || []).map(a => a.voluntario_id));
    return (data || []).map(a => _fromRow(a, nombres));
  }

  // Actividades de varios eventos en una sola consulta (WHERE evento_id IN (...)),
  // acotada a los ids pedidos en vez de traer toda la tabla como getAll().
  async function getByEventos(eventoIds) {
    const uniq = [...new Set((eventoIds || []).filter(Boolean))];
    if (!uniq.length) return [];
    const { data, error } = await DB.from(TABLA).select('*').in('evento_id', uniq);
    if (error) { (window.BSPLog ? window.BSPLog.error('ActividadesModel.getByEventos', error) : console.error('ActividadesModel.getByEventos')); return []; }
    const nombres = await _nombres((data || []).map(a => a.voluntario_id));
    return (data || []).map(a => _fromRow(a, nombres));
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    const nombres = await _nombres([data.voluntario_id]);
    return _fromRow(data, nombres);
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
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select('*').single();
    if (error) return { ok: false, error: _msg(error) };
    const nombres = await _nombres([ins.voluntario_id]);
    return { ok: true, actividad: _fromRow(ins, nombres) };
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
    const { data: upd, error } = await DB.from(TABLA).update(fila).eq('id', id).select('*').single();
    if (error) return { ok: false, error: _msg(error) };
    const nombres = await _nombres([upd.voluntario_id]);
    return { ok: true, actividad: _fromRow(upd, nombres) };
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
