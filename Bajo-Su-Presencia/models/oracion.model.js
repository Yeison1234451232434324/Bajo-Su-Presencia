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
 * Requiere window.sb y window.miUsuarioId (services/supabase.client.js).
 * ============================================================
 */

const OracionModel = (() => {

  const TABLA = 'oraciones';
  // Columnas realmente usadas por _fromRow — evita traer filas completas.
  const SEL = 'id, contenido, versiculo, imagen_url, publicado_en';

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

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('publicado_en', { ascending: false });
    if (error) { (window.BSPLog ? window.BSPLog.error('OracionModel.getAll', error) : console.error('OracionModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
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
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select().single();
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
    const { data: upd, error } = await DB.from(TABLA).update(fila).eq('id', id).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, oracion: _fromRow(upd) };
  }

  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getById, crear, actualizar, eliminar };

})();
