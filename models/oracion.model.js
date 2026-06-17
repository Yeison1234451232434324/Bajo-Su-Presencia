/**
 * ============================================================
 * MODELO: oracion.model.js  (Supabase)
 * ============================================================
 * CRUD de oraciones contra public.oraciones. Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   texto  (app) ↔ contenido (BD)
 *   imagen (app) ↔ imagen_url (BD)
 *   versiculo coincide. fecha/fechaISO ↔ publicado_en (BD).
 *   (las columnas título/referencia de la BD las usa la app móvil)
 *
 * Requiere window.sb y window.miUsuarioId (controllers/supabase.client.js).
 * ============================================================
 */

const OracionModel = (() => {

  const TABLA = 'oraciones';

  function _fechaLegible(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function _fromRow(r) {
    const iso = (r.publicado_en || '').toString();
    return {
      id:        r.id,
      texto:     r.contenido || '',
      versiculo: r.versiculo || '',
      imagen:    r.imagen_url || '',
      fechaISO:  iso.slice(0, 10),
      fecha:     _fechaLegible(iso)
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  async function getAll() {
    const { data, error } = await sb.from(TABLA).select('*').order('publicado_en', { ascending: false });
    if (error) { console.error('OracionModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await sb.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function crear(data) {
    if (!data.texto?.trim()) return { ok: false, error: 'El texto de la oración es obligatorio.' };
    const fila = {
      contenido:    data.texto.trim(),
      versiculo:    data.versiculo?.trim() || null,
      imagen_url:   data.imagen?.trim() || null,
      usuario_id:   await window.miUsuarioId(),
      publicado_en: new Date().toISOString()
    };
    const { data: ins, error } = await sb.from(TABLA).insert(fila).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, oracion: _fromRow(ins) };
  }

  async function actualizar(id, data) {
    if (!data.texto?.trim()) return { ok: false, error: 'El texto de la oración es obligatorio.' };
    const fila = {
      contenido:  data.texto.trim(),
      versiculo:  data.versiculo?.trim() || null,
      imagen_url: data.imagen?.trim() || null
    };
    const { data: upd, error } = await sb.from(TABLA).update(fila).eq('id', id).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, oracion: _fromRow(upd) };
  }

  async function eliminar(id) {
    const { error } = await sb.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getById, crear, actualizar, eliminar };

})();
