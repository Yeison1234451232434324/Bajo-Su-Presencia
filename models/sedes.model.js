/**
 * ============================================================
 * MODELO: sedes.model.js  (Supabase)
 * ============================================================
 * CRUD de sedes contra la tabla public.sedes.
 * Todos los métodos son ASÍNCRONOS (devuelven Promesas) → el
 * controller debe usar await.
 *
 * Mapeo app ↔ BD (esquema certificado):
 *   pastor (app) ↔ pastor_encargado (BD)
 *   miembros ya NO existe en BD (era un contador manual derivado, eliminado
 *   en la auditoría); se devuelve 0 para no romper vistas antiguas.
 *   el resto coincide: nombre, ciudad, direccion, telefono
 *
 * Requiere window.sb (controllers/supabase.client.js) cargado antes.
 * ============================================================
 */

const SedesModel = (() => {

  const TABLA = 'sedes';

  // Convierte una fila de la BD al objeto que usa la vista
  function _fromRow(r) {
    return {
      id:        r.id,
      nombre:    r.nombre    || '',
      ciudad:    r.ciudad    || '',
      direccion: r.direccion || '',
      telefono:  r.telefono  || '',
      pastor:    r.pastor_encargado || '',
      miembros:  0   // columna eliminada del esquema (dato derivado)
    };
  }

  // Traduce errores de Supabase a mensajes para el usuario
  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  /** Devuelve todas las sedes (ordenadas por nombre) */
  async function getAll() {
    const { data, error } = await DB.from(TABLA).select('*').order('nombre', { ascending: true });
    if (error) { console.error('SedesModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  /** Devuelve una sede por id (uuid) o null */
  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  /** Crea una sede */
  async function agregar(data) {
    if (!data.nombre?.trim())    return { ok: false, error: 'El nombre es obligatorio.' };
    if (!data.ciudad?.trim())    return { ok: false, error: 'La ciudad es obligatoria.' };
    if (!data.direccion?.trim()) return { ok: false, error: 'La dirección es obligatoria.' };

    const fila = {
      nombre:           data.nombre.trim(),
      ciudad:           data.ciudad.trim(),
      direccion:        data.direccion.trim(),
      telefono:         data.telefono?.trim() || null,
      pastor_encargado: data.pastor?.trim()   || null
    };

    const { data: ins, error } = await DB.from(TABLA).insert(fila).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, sede: _fromRow(ins) };
  }

  /** Elimina una sede por id (uuid) */
  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getById, agregar, eliminar };

})();
