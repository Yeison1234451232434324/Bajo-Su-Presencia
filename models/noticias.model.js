/**
 * ============================================================
 * MODELO: noticias.model.js  (Supabase)
 * ============================================================
 * CRUD de noticias contra public.noticias. Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   resumen (app) ↔ "Descripcion" (BD, con D mayúscula)
 *   imagen  (app) ↔ imagen_url (BD)
 *   autor   (app) ↔ usuarios.nombre (vía usuario_id; se setea al usuario logueado)
 *   fecha/fechaISO (app) ↔ publicado_en (BD, timestamp)
 *
 * Requiere window.sb y window.miUsuarioId (controllers/supabase.client.js).
 * ============================================================
 */

const NoticiasModel = (() => {

  const TABLA = 'noticias';

  function _fechaLegible(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function _fromRow(r) {
    const iso = (r.publicado_en || '').toString();
    return {
      id:        r.id,
      titulo:    r.titulo || '',
      resumen:   r.Descripcion || '',
      contenido: r.contenido || '',
      autor:     r.usuarios?.nombre || '',
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
    const { data, error } = await sb
      .from(TABLA)
      .select('*, usuarios(nombre)')
      .order('publicado_en', { ascending: false });
    if (error) { console.error('NoticiasModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await sb.from(TABLA).select('*, usuarios(nombre)').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function crear(data) {
    if (!data.titulo?.trim())  return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim()) return { ok: false, error: 'El resumen es obligatorio.' };

    const fila = {
      titulo:      data.titulo.trim(),
      Descripcion: data.resumen.trim(),
      contenido:   data.contenido?.trim() || '',
      imagen_url:  data.imagen?.trim() || null,
      usuario_id:  await window.miUsuarioId(),
      publicado_en: data.fechaISO || new Date().toISOString()
    };
    const { data: ins, error } = await sb.from(TABLA).insert(fila).select('*, usuarios(nombre)').single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, noticia: _fromRow(ins) };
  }

  async function actualizar(id, data) {
    if (!data.titulo?.trim())  return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim()) return { ok: false, error: 'El resumen es obligatorio.' };

    const fila = {
      titulo:       data.titulo.trim(),
      Descripcion:  data.resumen.trim(),
      contenido:    data.contenido?.trim() || '',
      imagen_url:   data.imagen?.trim() || null,
      publicado_en: data.fechaISO || undefined
    };
    const { data: upd, error } = await sb.from(TABLA).update(fila).eq('id', id).select('*, usuarios(nombre)').single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, noticia: _fromRow(upd) };
  }

  async function eliminar(id) {
    const { error } = await sb.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getById, crear, actualizar, eliminar };

})();
