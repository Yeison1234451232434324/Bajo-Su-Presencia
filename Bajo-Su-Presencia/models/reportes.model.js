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
 *   eventoTitulo  ← eventos.titulo (join)
 *   creadoEn      ← creado_en
 * Requiere window.sb y window.miUsuarioId.
 * ============================================================
 */

const ReportesModel = (() => {

  const TABLA = 'informes';

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  function _fromRow(r, nombres) {
    return {
      id:            r.id,
      eventoId:      r.evento_id,
      eventoTitulo:  r.eventos?.titulo || '',
      ofrenda:       r.ofrenda_recaudada ?? 0,
      incidentes:    r.incidentes || 'Ninguno',
      observaciones: r.observaciones || '',
      creadoPor:     (nombres && nombres[r.creado_por]) || '',
      creadoEn:      (r.creado_en || '').toString().slice(0, 10)
    };
  }

  async function _nombres(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return {};
    const { data } = await DB.from('usuarios').select('id, nombre:nombre_completo').in('id', uniq);
    const map = {};
    (data || []).forEach(u => { map[u.id] = u.nombre; });
    return map;
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select('*, eventos(titulo)');
    if (error) { (window.BSPLog ? window.BSPLog.error('ReportesModel.getAll', error) : console.error('ReportesModel.getAll')); return []; }
    const nombres = await _nombres((data || []).map(r => r.creado_por));
    return (data || []).map(r => _fromRow(r, nombres));
  }

  async function getByEvento(eventoId) {
    const { data, error } = await DB.from(TABLA).select('*, eventos(titulo)').eq('evento_id', eventoId).maybeSingle();
    if (error || !data) return null;
    const nombres = await _nombres([data.creado_por]);
    return _fromRow(data, nombres);
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
    if (ya) res = await DB.from(TABLA).update(fila).eq('id', ya.id).select('*, eventos(titulo)').single();
    else    res = await DB.from(TABLA).insert(fila).select('*, eventos(titulo)').single();
    if (res.error) return { ok: false, error: _msg(res.error) };
    const nombres = await _nombres([res.data.creado_por]);
    return { ok: true, reporte: _fromRow(res.data, nombres) };
  }

  async function eliminar(eventoId) {
    const { error } = await DB.from(TABLA).delete().eq('evento_id', eventoId);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getByEvento, guardar, eliminar };

})();
