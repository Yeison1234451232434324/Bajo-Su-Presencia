/**
 * ============================================================
 * MODELO: pqr.model.js  (Supabase)
 * ============================================================
 * CRUD de PQR contra public.pqr. Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   email (app)        ↔ correo (BD)
 *   telefono (app)     ↔ teléfono (BD, con tilde)
 *   descripcion (app)  ↔ descripción (BD, con tilde)
 *   creadoEn / respondidoEn / respondidoPor ↔ creado_en / respondido_en / respondido_por
 *
 * Requiere window.sb (controllers/supabase.client.js).
 * ============================================================
 */

const PQRModel = (() => {

  const TABLA = 'pqr';
  const TIPOS = ['Petición', 'Queja', 'Reclamo'];
  const ESTADOS = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];

  function _fromRow(r) {
    return {
      id:           r.id,
      tipo:         r.tipo || 'Petición',
      nombre:       r.nombre || '',
      email:        r.correo || '',
      telefono:     r['teléfono'] || '',
      asunto:       r.asunto || '',
      descripcion:  r['descripción'] || '',
      estado:       r.estado || 'Pendiente',
      prioridad:    r.prioridad || 'Media',
      creadoEn:     r.creado_en || '',
      respuesta:    r.respuesta || '',
      respondidoEn: r.respondido_en || null,
      respondidoPor:r.respondido_por || ''
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  async function getAll() {
    const { data, error } = await sb.from(TABLA).select('*').order('creado_en', { ascending: false });
    if (error) { console.error('PQRModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await sb.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function crear(data) {
    if (!data.nombre?.trim())      return { ok: false, error: 'El nombre es obligatorio.' };
    if (!data.email?.trim())       return { ok: false, error: 'El correo electrónico es obligatorio.' };
    if (!data.asunto?.trim())      return { ok: false, error: 'El asunto es obligatorio.' };
    if (!data.descripcion?.trim()) return { ok: false, error: 'La descripción es obligatoria.' };

    const fila = {
      tipo:         TIPOS.includes(data.tipo) ? data.tipo : 'Petición',
      nombre:       data.nombre.trim(),
      correo:       data.email.trim().toLowerCase(),
      'teléfono':   data.telefono?.trim() || null,
      asunto:       data.asunto.trim(),
      'descripción':data.descripcion.trim(),
      estado:       'Pendiente',
      prioridad:    ['Baja','Media','Alta'].includes(data.prioridad) ? data.prioridad : 'Media'
    };
    const { data: ins, error } = await sb.from(TABLA).insert(fila).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(ins) };
  }

  async function cambiarEstado(id, nuevoEstado) {
    if (!ESTADOS.includes(nuevoEstado)) return { ok: false, error: 'Estado no válido.' };
    const { data, error } = await sb.from(TABLA).update({ estado: nuevoEstado }).eq('id', id).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(data) };
  }

  async function responder(id, respuesta, nuevoEstado, respondidoPor) {
    if (!respuesta || !respuesta.trim()) return { ok: false, error: 'La respuesta no puede estar vacía.' };
    const fila = {
      respuesta:       respuesta.trim(),
      respondido_en:   new Date().toISOString(),
      respondido_por:  respondidoPor?.trim() || 'Administrador'
    };
    if (ESTADOS.includes(nuevoEstado)) fila.estado = nuevoEstado;
    const { data, error } = await sb.from(TABLA).update(fila).eq('id', id).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, pqr: _fromRow(data) };
  }

  async function eliminar(id) {
    const { error } = await sb.from(TABLA).delete().eq('id', id);
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
