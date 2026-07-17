/**
 * ============================================================
 * MODELO: pqr.model.js  (Supabase)
 * ============================================================
 * CRUD de PQR contra public.pqr. Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD (esquema certificado, sin tildes):
 *   email (app)       ↔ correo (BD)
 *   telefono          ↔ telefono
 *   descripcion       ↔ descripcion
 *   respondidoPor     ← usuarios.nombre vía FK respondido_por_id
 *   creadoEn / respondidoEn ↔ creado_en / respondido_en
 *
 * Requiere window.DB (controllers/db.client.js → Data Gateway PHP).
 * ============================================================
 */

const PQRModel = (() => {

  const TABLA = 'pqr';
  const TIPOS = ['Petición', 'Queja', 'Reclamo'];
  const ESTADOS = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];
  // pqr tiene DOS FKs a usuarios (usuario_id y respondido_por_id):
  // el embed se desambigua con el nombre de la columna.
  const SEL = '*, respondido:usuarios!respondido_por_id(nombre:nombre_completo)';

  function _fromRow(r) {
    return {
      id:           r.id,
      tipo:         r.tipo || 'Petición',
      nombre:       r.nombre || '',
      email:        r.correo || '',
      telefono:     r.telefono || '',
      asunto:       r.asunto || '',
      descripcion:  r.descripcion || '',
      estado:       r.estado || 'Pendiente',
      prioridad:    r.prioridad || 'Media',
      creadoEn:     r.creado_en || '',
      respuesta:    r.respuesta || '',
      respondidoEn: r.respondido_en || null,
      respondidoPor:r.respondido?.nombre || ''
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('creado_en', { ascending: false });
    if (error) { console.error('PQRModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function crear(data) {
    if (!data.nombre?.trim())      return { ok: false, error: 'El nombre es obligatorio.' };
    if (!data.email?.trim())       return { ok: false, error: 'El correo electrónico es obligatorio.' };
    if (!data.asunto?.trim())      return { ok: false, error: 'El asunto es obligatorio.' };
    if (!data.descripcion?.trim()) return { ok: false, error: 'La descripción es obligatoria.' };

    const fila = {
      tipo:        TIPOS.includes(data.tipo) ? data.tipo : 'Petición',
      nombre:      data.nombre.trim(),
      correo:      data.email.trim().toLowerCase(),
      telefono:    data.telefono?.trim() || null,
      asunto:      data.asunto.trim(),
      descripcion: data.descripcion.trim(),
      estado:      'Pendiente',
      prioridad:   ['Baja','Media','Alta'].includes(data.prioridad) ? data.prioridad : 'Media'
    };
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select(SEL).single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(ins) };
  }

  async function cambiarEstado(id, nuevoEstado) {
    if (!ESTADOS.includes(nuevoEstado)) return { ok: false, error: 'Estado no válido.' };
    const { data, error } = await DB.from(TABLA).update({ estado: nuevoEstado }).eq('id', id).select(SEL).single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(data) };
  }

  // El 4º parámetro (nombre del respondedor) queda ignorado: ahora se guarda
  // la FK respondido_por_id del usuario logueado (no un texto editable).
  async function responder(id, respuesta, nuevoEstado, _respondidoPor) {
    if (!respuesta || !respuesta.trim()) return { ok: false, error: 'La respuesta no puede estar vacía.' };
    const respondidoPorId = (typeof window.miUsuarioId === 'function') ? await window.miUsuarioId() : null;
    const fila = {
      respuesta:          respuesta.trim(),
      respondido_en:      new Date().toISOString(),
      respondido_por_id:  respondidoPorId
    };
    if (ESTADOS.includes(nuevoEstado)) fila.estado = nuevoEstado;
    const { data, error } = await DB.from(TABLA).update(fila).eq('id', id).select(SEL).single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(data) };
  }

  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function getEstadisticas() {
    const lista = await getAll();
    return {
      total:      lista.length,
      pendientes: lista.filter(p => p.estado === 'Pendiente').length,
      enProceso:  lista.filter(p => p.estado === 'En proceso').length,
      resueltos:  lista.filter(p => p.estado === 'Resuelto').length,
      cerrados:   lista.filter(p => p.estado === 'Cerrado').length
    };
  }

  return { getAll, getById, crear, cambiarEstado, responder, eliminar, getEstadisticas };

})();
