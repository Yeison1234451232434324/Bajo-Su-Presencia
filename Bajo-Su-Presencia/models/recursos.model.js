/* global DB */
/* exported RecursosModel */
/**
 * ============================================================
 * MODELO: recursos.model.js  (Supabase)
 * ============================================================
 * Inventario de recursos (tabla public.recursos) + asignaciones de recursos
 * a eventos (tabla puente public.evento_recursos). Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD (esquema certificado, sin tildes):
 *   descripcion ↔ descripcion · creado ← creado_en
 *
 * Requiere window.sb (services/supabase.client.js).
 * ============================================================
 */

const RecursosModel = (() => {
  const TABLA = 'recursos';
  // Columnas realmente usadas por localFromRow — evita traer filas completas.
  const SEL = 'id, nombre, categoria, descripcion, cantidad, unidad, disponible, creado_en';

  function localFromRow(r) {
    return {
      id: r.id,
      nombre: r.nombre || '',
      categoria: r.categoria || '',
      descripcion: r.descripcion || '',
      cantidad: r.cantidad ?? 0,
      unidad: r.unidad || 'unidades',
      disponible: r.disponible !== false,
      creado: (r.creado_en || '').toString().slice(0, 10),
    };
  }

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  // El código 23505 (nombre duplicado) lleva mensaje propio de esta tabla.
  function localMsg(error) {
    return DB.mensajeError(error, { 23505: 'Ya existe un recurso con ese nombre.' });
  }

  // ── Inventario ─────────────────────────────────────────────────────────────
  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('nombre', { ascending: true });
    if (error) {
      if (window.BSPLog) {
        window.BSPLog.error('RecursosModel.getAll', error);
      } else {
        console.error('RecursosModel.getAll');
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
    if (!data.nombre?.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
    if (data.cantidad < 0) return { ok: false, error: 'La cantidad no puede ser negativa.' };

    const fila = {
      nombre: data.nombre.trim(),
      categoria: data.categoria,
      descripcion: data.descripcion?.trim() || null,
      cantidad: parseInt(data.cantidad, 10) || 0,
      unidad: data.unidad?.trim() || 'unidades',
      disponible: true,
    };
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select().single();
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true, recurso: localFromRow(ins) };
  }

  async function actualizar(id, data) {
    if (data.cantidad < 0) return { ok: false, error: 'La cantidad no puede ser negativa.' };
    const fila = {
      nombre: data.nombre.trim(),
      categoria: data.categoria,
      descripcion: data.descripcion?.trim() || null,
      cantidad: parseInt(data.cantidad, 10) || 0,
      unidad: data.unidad?.trim() || 'unidades',
    };
    const { data: upd, error } = await DB.from(TABLA).update(fila).eq('id', id).select()
      .single();
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true, recurso: localFromRow(upd) };
  }

  async function toggleDisponible(id) {
    const r = await getById(id);
    if (!r) return { ok: false, error: 'Recurso no encontrado.' };
    if (!r.disponible && r.cantidad === 0) {
      return { ok: false, error: 'No se puede activar un recurso sin stock (cantidad = 0).' };
    }
    const nuevo = !r.disponible;
    const { error } = await DB.from(TABLA).update({ disponible: nuevo }).eq('id', id);
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true, disponible: nuevo };
  }

  async function eliminar(id) {
    // La FK con ON DELETE CASCADE limpia evento_recursos automáticamente
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true };
  }

  async function getEstadisticas() {
    const recursos = await getAll();
    return {
      total: recursos.length,
      disponibles: recursos.filter((r) => r.disponible).length,
      noDisponibles: recursos.filter((r) => !r.disponible).length,
      sinStock: recursos.filter((r) => r.cantidad === 0).length,
    };
  }

  return {
    getAll,
    getById,
    crear,
    actualizar,
    toggleDisponible,
    eliminar,
    getEstadisticas,
  };
})();
