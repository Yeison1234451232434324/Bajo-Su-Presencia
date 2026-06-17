/**
 * ============================================================
 * MODELO: recursos.model.js  (Supabase)
 * ============================================================
 * Inventario de recursos (tabla public.recursos) + asignaciones de recursos
 * a eventos (tabla puente public.evento_recursos). Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   descripcion (app) ↔ descripción (BD, con tilde)
 *   (creado no existe en BD → se devuelve vacío)
 *
 * Requiere window.sb (controllers/supabase.client.js).
 * ============================================================
 */

const RecursosModel = (() => {

  const TABLA = 'recursos';
  const PUENTE = 'evento_recursos';

  function _fromRow(r) {
    return {
      id:          r.id,
      nombre:      r.nombre || '',
      categoria:   r.categoria || '',
      descripcion: r['descripción'] || '',
      cantidad:    r.cantidad ?? 0,
      unidad:      r.unidad || 'unidades',
      disponible:  r.disponible !== false,
      creado:      ''
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    if (error?.code === '23505') return 'Ya existe un recurso con ese nombre.';
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  // ── Inventario ─────────────────────────────────────────────────────────────
  async function getAll() {
    const { data, error } = await sb.from(TABLA).select('*').order('nombre', { ascending: true });
    if (error) { console.error('RecursosModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await sb.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function create(data) {
    if (!data.nombre?.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
    if (data.cantidad < 0)    return { ok: false, error: 'La cantidad no puede ser negativa.' };

    const fila = {
      nombre:        data.nombre.trim(),
      categoria:     data.categoria,
      'descripción': data.descripcion?.trim() || null,
      cantidad:      parseInt(data.cantidad) || 0,
      unidad:        data.unidad?.trim() || 'unidades',
      disponible:    true
    };
    const { data: ins, error } = await sb.from(TABLA).insert(fila).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, recurso: _fromRow(ins) };
  }

  async function update(id, data) {
    if (data.cantidad < 0) return { ok: false, error: 'La cantidad no puede ser negativa.' };
    const fila = {
      nombre:        data.nombre.trim(),
      categoria:     data.categoria,
      'descripción': data.descripcion?.trim() || null,
      cantidad:      parseInt(data.cantidad) || 0,
      unidad:        data.unidad?.trim() || 'unidades'
    };
    const { data: upd, error } = await sb.from(TABLA).update(fila).eq('id', id).select().single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, recurso: _fromRow(upd) };
  }

  async function toggleDisponible(id) {
    const r = await getById(id);
    if (!r) return { ok: false, error: 'Recurso no encontrado.' };
    if (!r.disponible && r.cantidad === 0) {
      return { ok: false, error: 'No se puede activar un recurso sin stock (cantidad = 0).' };
    }
    const nuevo = !r.disponible;
    const { error } = await sb.from(TABLA).update({ disponible: nuevo }).eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, disponible: nuevo };
  }

  async function remove(id) {
    // Limpia asignaciones a eventos antes de borrar el recurso
    await sb.from(PUENTE).delete().eq('recurso_id', id);
    const { error } = await sb.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function getEstadisticas() {
    const recursos = await getAll();
    return {
      total:         recursos.length,
      disponibles:   recursos.filter(r => r.disponible).length,
      noDisponibles: recursos.filter(r => !r.disponible).length,
      sinStock:      recursos.filter(r => r.cantidad === 0).length
    };
  }

  // ── Asignaciones recurso ↔ evento (tabla evento_recursos) ──────────────────
  async function getAsignacionesPorEvento(eventoId) {
    const { data, error } = await sb
      .from(PUENTE)
      .select('id, recurso_id, cantidad, recursos(nombre, unidad)')
      .eq('evento_id', eventoId);
    if (error) { console.error('getAsignacionesPorEvento:', error); return []; }
    return (data || []).map(a => ({
      id:            a.id,
      eventoId:      eventoId,
      recursoId:     a.recurso_id,
      recursoNombre: a.recursos?.nombre || '',
      unidad:        a.recursos?.unidad || 'unidades',
      cantidad:      a.cantidad
    }));
  }

  async function asignarRecurso(data) {
    const recurso = await getById(data.recursoId);
    if (!recurso)            return { ok: false, error: 'Recurso no encontrado.' };
    if (!recurso.disponible) return { ok: false, error: 'El recurso no está disponible.' };
    if (data.cantidad < 1)   return { ok: false, error: 'La cantidad debe ser al menos 1.' };
    if (data.cantidad > recurso.cantidad) {
      return { ok: false, error: `Solo hay ${recurso.cantidad} ${recurso.unidad} disponibles.` };
    }
    // upsert por (evento_id, recurso_id)
    const { data: ya } = await sb.from(PUENTE).select('id')
      .eq('evento_id', data.eventoId).eq('recurso_id', data.recursoId).maybeSingle();
    let error;
    if (ya) {
      ({ error } = await sb.from(PUENTE).update({ cantidad: parseInt(data.cantidad) }).eq('id', ya.id));
    } else {
      ({ error } = await sb.from(PUENTE).insert({
        evento_id: data.eventoId, recurso_id: data.recursoId, cantidad: parseInt(data.cantidad)
      }));
    }
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function quitarAsignacion(eventoId, recursoId) {
    const { error } = await sb.from(PUENTE).delete().eq('evento_id', eventoId).eq('recurso_id', recursoId);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return {
    getAll, getById, create, update, toggleDisponible, remove, getEstadisticas,
    getAsignacionesPorEvento, asignarRecurso, quitarAsignacion
  };

})();
