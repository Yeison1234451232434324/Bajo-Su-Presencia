/**
 * ============================================================
 * MODELO: eventos.model.js  (Supabase)
 * ============================================================
 * CRUD de eventos contra public.eventos + tablas puente:
 *   - evento_recursos      (recursos asignados al evento)
 *   - voluntarios_eventos  (especialistas requeridos; rol_en_evento = especialidad)
 * Métodos ASÍNCRONOS.
 *
 * Mapeo app ↔ BD:
 *   horario "HH:MM - HH:MM" (app) ↔ hora + hora_fin (BD, type time)
 *   asistentes (app) ↔ cupos_disponibles (BD)
 *   voluntariosNecesarios ↔ voluntarios_necesarios
 *   publicado ↔ publicado_en
 *
 * Requiere window.sb (controllers/supabase.client.js).
 * ============================================================
 */

const EventosModel = (() => {

  const TABLA = 'eventos';
  const REC   = 'evento_recursos';
  const VOL   = 'voluntarios_eventos';
  const ESTADOS = ['Publicado', 'En ejecución', 'Finalizado', 'Cancelado'];

  const SEL = '*, evento_recursos(recurso_id, cantidad, recursos(nombre, unidad)), ' +
              'voluntarios_eventos(usuario_id, rol_en_evento, usuarios(nombre:nombre_completo))';

  function _combinar(hora, horaFin) {
    if (!hora) return '';
    const ini = String(hora).slice(0, 5);
    const fin = horaFin ? String(horaFin).slice(0, 5) : '';
    return fin ? `${ini} - ${fin}` : ini;
  }

  function _split(horario) {
    if (!horario) return { hora: null, horaFin: null };
    const p = horario.split(' - ');
    return { hora: (p[0] || '').trim() || null, horaFin: (p[1] || '').trim() || null };
  }

  function _fromRow(r) {
    return {
      id:                    r.id,
      titulo:                r.titulo || '',
      fecha:                 r.fecha || '',
      horario:               _combinar(r.hora, r.hora_fin),
      ubicacion:             r.ubicacion || '',
      asistentes:            (r.cupos_disponibles ?? '') === null ? '' : (r.cupos_disponibles ?? ''),
      voluntariosNecesarios: r.voluntarios_necesarios ?? 0,
      descripcion:           r.descripcion || '',
      estado:                r.estado || 'Publicado',
      publicado:             (r.publicado_en || '').toString().slice(0, 10),
      recursos: (r.evento_recursos || []).map(er => ({
        recursoId:     er.recurso_id,
        recursoNombre: er.recursos?.nombre || 'Recurso',
        cantidad:      er.cantidad,
        unidad:        er.recursos?.unidad || 'unidades'
      })),
      especialistas: (r.voluntarios_eventos || []).map(ve => ({
        usuarioId:    ve.usuario_id,
        nombre:       ve.usuarios?.nombre || '',
        especialidad: ve.rol_en_evento || ''
      }))
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('fecha', { ascending: true });
    if (error) { (window.BSPLog ? window.BSPLog.error('EventosModel.getAll', error) : console.error('EventosModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select(SEL).eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  // El formulario web no captura sede; usamos la primera disponible como default
  // (por si eventos.sede_id sigue siendo NOT NULL). Idealmente correr el ALTER
  // de supabase_ajustes_eventos_recursos.sql para hacerla opcional.
  async function _sedeDefault() {
    const { data } = await DB.from('sedes').select('id').limit(1).maybeSingle();
    return data?.id || null;
  }

  async function _syncRecursos(eventoId, recursos) {
    await DB.from(REC).delete().eq('evento_id', eventoId);
    const filas = (recursos || []).map(r => ({
      evento_id: eventoId, recurso_id: r.recursoId, cantidad: parseInt(r.cantidad) || 1
    }));
    if (filas.length) await DB.from(REC).insert(filas);
  }

  async function _syncEspecialistas(eventoId, especialistas) {
    await DB.from(VOL).delete().eq('evento_id', eventoId);
    const filas = (especialistas || []).map(e => ({
      evento_id: eventoId, usuario_id: e.usuarioId, rol_en_evento: e.especialidad || null
    }));
    if (filas.length) await DB.from(VOL).insert(filas);
  }

  function _fila(data) {
    const { hora, horaFin } = _split(data.horario);
    const asist = (data.asistentes !== '' && data.asistentes != null) ? parseInt(data.asistentes) : null;
    return {
      titulo:                 data.titulo.trim(),
      descripcion:            data.descripcion?.trim() || null,
      fecha:                  data.fecha,
      hora:                   hora,
      hora_fin:               horaFin,
      ubicacion:              data.ubicacion?.trim() || null,
      cupos_disponibles:      isNaN(asist) ? null : asist,
      voluntarios_necesarios: parseInt(data.voluntariosNecesarios) || 0,
      estado:                 ESTADOS.includes(data.estado) ? data.estado : 'Publicado'
    };
  }

  async function publicar(data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.fecha)          return { ok: false, error: 'La fecha es obligatoria.' };

    const fila = _fila(data);
    fila.publicado_en = new Date().toISOString();
    fila.sede_id = await _sedeDefault();   // el form no captura sede
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select('id').single();
    if (error) return { ok: false, error: _msg(error) };

    await _syncRecursos(ins.id, data.recursos);
    await _syncEspecialistas(ins.id, data.especialistas);
    return { ok: true, evento: await getById(ins.id) };
  }

  async function actualizar(id, data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.fecha)          return { ok: false, error: 'La fecha es obligatoria.' };

    const { error } = await DB.from(TABLA).update(_fila(data)).eq('id', id);
    if (error) return { ok: false, error: _msg(error) };

    await _syncRecursos(id, data.recursos);
    await _syncEspecialistas(id, data.especialistas);
    return { ok: true, evento: await getById(id) };
  }

  async function eliminar(id) {
    // Las FKs con ON DELETE CASCADE limpian evento_recursos y
    // voluntarios_eventos automáticamente al borrar el evento.
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  return { getAll, getById, publicar, actualizar, eliminar, ESTADOS };

})();
