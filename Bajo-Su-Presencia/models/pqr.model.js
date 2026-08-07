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
 * Requiere window.DB (services/db.client.js → Data Gateway PHP).
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

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function _msg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('creado_en', { ascending: false });
    if (error) { (window.BSPLog ? window.BSPLog.error('PQRModel.getAll', error) : console.error('PQRModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  // Pasa por el backend PHP (no por el Data Gateway) porque, además de
  // insertar la fila, envía la confirmación de recepción al correo indicado
  // (requiere Mailer/SMTP, solo disponible en el servidor). Es la única
  // escritura pública en `pqr`, así que no exige JWT (auth:false).
  async function crear(data) {
    if (!data.nombre?.trim())      return { ok: false, error: 'El nombre es obligatorio.' };
    if (!data.email?.trim())       return { ok: false, error: 'El correo electrónico es obligatorio.' };
    if (!data.asunto?.trim())      return { ok: false, error: 'El asunto es obligatorio.' };
    if (!data.descripcion?.trim()) return { ok: false, error: 'La descripción es obligatoria.' };

    try {
      const creada = await window.apiFetch('/api/pqr', {
        method: 'POST',
        auth: false,
        body: {
          tipo:        TIPOS.includes(data.tipo) ? data.tipo : 'Petición',
          nombre:      data.nombre.trim(),
          correo:      data.email.trim().toLowerCase(),
          telefono:    data.telefono?.trim() || null,
          asunto:      data.asunto.trim(),
          descripcion: data.descripcion.trim()
        }
      });
      return { ok: true, pqr: _fromRow(creada) };
    } catch (e) {
      return { ok: false, error: e.message || 'Ocurrió un error al procesar la solicitud.' };
    }
  }

  // Pasa por el backend PHP (no por el Data Gateway) porque, además de
  // actualizar la fila, notifica el cambio de estado al correo del
  // solicitante — y el gateway genérico no tiene acceso a Mailer. El
  // backend rechaza el cambio si la PQR ya está "Resuelto" (solo lectura,
  // salvo eliminar).
  async function cambiarEstado(id, nuevoEstado) {
    if (!ESTADOS.includes(nuevoEstado)) return { ok: false, error: 'Estado no válido.' };
    try {
      const data = await window.apiFetch(`/api/pqr/${encodeURIComponent(id)}/estado`, {
        method: 'PATCH',
        body: { estado: nuevoEstado }
      });
      return { ok: true, pqr: _fromRow(data) };
    } catch (e) {
      return { ok: false, error: e.message || 'Ocurrió un error al procesar la solicitud.' };
    }
  }

  // El 4º parámetro (nombre del respondedor) queda ignorado: el backend guarda
  // la FK respondido_por_id a partir del JWT del usuario logueado.
  //
  // Pasa por el backend PHP (no por el Data Gateway) porque, además de
  // actualizar la fila, envía la respuesta al correo que la persona registró
  // al radicar la PQR (requiere Mailer/SMTP, solo disponible en el servidor).
  async function responder(id, respuesta, nuevoEstado, _respondidoPor) {
    if (!respuesta || !respuesta.trim()) return { ok: false, error: 'La respuesta no puede estar vacía.' };
    try {
      const data = await window.apiFetch(`/api/pqr/${encodeURIComponent(id)}/responder`, {
        method: 'PATCH',
        body: {
          respuesta: respuesta.trim(),
          estado: ESTADOS.includes(nuevoEstado) ? nuevoEstado : undefined
        }
      });
      return { ok: true, pqr: _fromRow(data) };
    } catch (e) {
      return { ok: false, error: e.message || 'Ocurrió un error al procesar la solicitud.' };
    }
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
