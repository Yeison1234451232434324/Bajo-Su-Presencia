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
 *   creadoEn      ← created_at
 * Requiere window.sb y window.miUsuarioId.
 * ============================================================
 */

const ReportesModel = (() => {

  const TABLA = 'informes';

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  function _fromRow(r, nombres) {
    return {
      id:            r.id,
      eventoId:      r.evento_id,
      eventoTitulo:  r.eventos?.titulo || '',
      ofrenda:       r.ofrenda_recaudada ?? 0,
      incidentes:    r.incidentes || 'Ninguno',
      observaciones: r.observaciones || '',
      creadoPor:     (nombres && nombres[r.creado_por]) || '',
      creadoEn:      (r.created_at || '').toString().slice(0, 10)
    };
  }

  async function _nombres(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return {};
    const { data } = await sb.from('usuarios').select('id, nombre').in('id', uniq);
    const map = {};
    (data || []).forEach(u => { map[u.id] = u.nombre; });
    return map;
  }

  async function getAll() {
    const { data, error } = await sb.from(TABLA).select('*, eventos(titulo)');
    if (error) { console.error('ReportesModel.getAll:', error); return []; }
    const nombres = await _nombres((data || []).map(r => r.creado_por));
    return (data || []).map(r => _fromRow(r, nombres));
  }

  async function getByEvento(eventoId) {
    const { data, error } = await sb.from(TABLA).select('*, eventos(titulo)').eq('evento_id', eventoId).maybeSingle();
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

    const { data: ya } = await sb.from(TABLA).select('id').eq('evento_id', data.eventoId).maybeSingle();
    let res;
    if (ya) res = await sb.from(TABLA).update(fila).eq('id', ya.id).select('*, eventos(titulo)').single();
    else    res = await sb.from(TABLA).insert(fila).select('*, eventos(titulo)').single();
    if (res.error) return { ok: false, error: _msg(res.error) };
    const nombres = await _nombres([res.data.creado_por]);
    return { ok: true, reporte: _fromRow(res.data, nombres) };
  }

  async function eliminar(eventoId) {
    const { error } = await sb.from(TABLA).delete().eq('evento_id', eventoId);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getByEvento, guardar, eliminar };

})();
