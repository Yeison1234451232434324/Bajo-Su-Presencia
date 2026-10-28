/* global DB */
/* exported NoticiasModel */
/**
 * ============================================================
 * MODELO: noticias.model.js  (Supabase)
 * ============================================================
 * CRUD de noticias contra public.noticias. Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD (esquema certificado):
 *   resumen (app) ↔ descripcion (BD)
 *   imagen  (app) ↔ imagen_url (BD)
 *   autor   (app) ↔ usuarios.nombre (vía usuario_id; se setea al usuario logueado)
 *   fecha/fechaISO (app) ↔ publicado_en (BD, timestamp)
 *
 * Requiere window.sb y window.miUsuarioId (services/supabase.client.js).
 * ============================================================
 */

const NoticiasModel = (() => {
  const TABLA = 'noticias';
  // Columnas realmente usadas por localFromRow — evita traer filas completas.
  const SEL = 'id, titulo, descripcion, contenido, imagen_url, publicado_en, usuarios(nombre:nombre_completo)';

  function localFechaLegible(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function localFromRow(r) {
    const iso = (r.publicado_en || '').toString();
    return {
      id: r.id,
      titulo: r.titulo || '',
      resumen: r.descripcion || '',
      contenido: r.contenido || '',
      autor: r.usuarios?.nombre || '',
      imagen: r.imagen_url || '',
      fechaISO: iso.slice(0, 10),
      fecha: localFechaLegible(iso),
    };
  }

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function localMsg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB
      .from(TABLA)
      .select(SEL)
      .order('publicado_en', { ascending: false });
    if (error) {
      if (window.BSPLog) {
        window.BSPLog.error('NoticiasModel.getAll', error);
      } else {
        console.error('NoticiasModel.getAll');
      }
      return [];
    }
    return (data || []).map(localFromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
    if (error || !data) return null;
    return localFromRow(data);
  }

  async function crear(data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim()) return { ok: false, error: 'El resumen es obligatorio.' };

    const fila = {
      titulo: data.titulo.trim(),
      descripcion: data.resumen.trim(),
      contenido: data.contenido?.trim() || '',
      imagen_url: data.imagen?.trim() || null,
      usuario_id: await window.miUsuarioId(),
      publicado_en: data.fechaISO || new Date().toISOString(),
    };
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select('*, usuarios(nombre:nombre_completo)').single();
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true, noticia: localFromRow(ins) };
  }

  async function actualizar(id, data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim()) return { ok: false, error: 'El resumen es obligatorio.' };

    const fila = {
      titulo: data.titulo.trim(),
      descripcion: data.resumen.trim(),
      contenido: data.contenido?.trim() || '',
      imagen_url: data.imagen?.trim() || null,
      publicado_en: data.fechaISO || undefined,
    };
    const { data: upd, error } = await DB.from(TABLA).update(fila).eq('id', id).select('*, usuarios(nombre:nombre_completo)')
      .single();
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true, noticia: localFromRow(upd) };
  }

  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true };
  }

  return {
    getAll, getById, crear, actualizar, eliminar,
  };
})();
