/* global DB */
/* exported EventosModel */
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
 * Requiere window.sb (services/supabase.client.js).
 * ============================================================
 */

const EventosModel = (() => {
  const TABLA = 'eventos';
  const REC = 'evento_recursos';
  const VOL = 'voluntarios_eventos';
  const ESTADOS = ['Publicado', 'En ejecución', 'Finalizado', 'Cancelado'];

  const SEL = '*, evento_recursos(recurso_id, cantidad, recursos(nombre, unidad)), '
              + 'voluntarios_eventos(usuario_id, rol_en_evento, usuarios(nombre:nombre_completo))';

  function localCombinar(hora, horaFin) {
    if (!hora) return '';
    const ini = String(hora).slice(0, 5);
    const fin = horaFin ? String(horaFin).slice(0, 5) : '';
    return fin ? `${ini} - ${fin}` : ini;
  }

  function localSplit(horario) {
    if (!horario) return { hora: null, horaFin: null };
    const p = horario.split(' - ');
    return { hora: (p[0] || '').trim() || null, horaFin: (p[1] || '').trim() || null };
  }

  function localFromRow(r) {
    return {
      id: r.id,
      titulo: r.titulo || '',
      fecha: r.fecha || '',
      horario: localCombinar(r.hora, r.hora_fin),
      ubicacion: r.ubicacion || '',
      asistentes: (r.cupos_disponibles ?? '') === null ? '' : (r.cupos_disponibles ?? ''),
      voluntariosNecesarios: r.voluntarios_necesarios ?? 0,
      descripcion: r.descripcion || '',
      estado: r.estado || 'Publicado',
      publicado: (r.publicado_en || '').toString().slice(0, 10),
      recursos: (r.evento_recursos || []).map((er) => ({
        recursoId: er.recurso_id,
        recursoNombre: er.recursos?.nombre || 'Recurso',
        cantidad: er.cantidad,
        unidad: er.recursos?.unidad || 'unidades',
      })),
      especialistas: (r.voluntarios_eventos || []).map((ve) => ({
        usuarioId: ve.usuario_id,
        nombre: ve.usuarios?.nombre || '',
        especialidad: ve.rol_en_evento || '',
      })),
    };
  }

  // Traducción de errores centralizada en db.client.js (window.DB.mensajeError).
  function localMsg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select(SEL).order('fecha', { ascending: true });
    if (error) {
      if (window.BSPLog) {
        window.BSPLog.error('EventosModel.getAll', error);
      } else {
        console.error('EventosModel.getAll');
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

  // Varios eventos por id en una sola consulta (WHERE id IN (...)), acotada
  // a los ids pedidos en vez de traer toda la tabla como getAll().
  async function getByIds(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return [];
    const { data, error } = await DB.from(TABLA).select(SEL).in('id', uniq);
    if (error) {
      if (window.BSPLog) {
        window.BSPLog.error('EventosModel.getByIds', error);
      } else {
        console.error('EventosModel.getByIds');
      }
      return [];
    }
    return (data || []).map(localFromRow);
  }

  // El formulario web no captura sede; usamos la primera disponible como default
  // (por si eventos.sede_id sigue siendo NOT NULL). Idealmente correr el ALTER
  // de supabase_ajustes_eventos_recursos.sql para hacerla opcional.
  async function localSedeDefault() {
    const { data } = await DB.from('sedes').select('id').limit(1).maybeSingle();
    return data?.id || null;
  }

  async function localSyncRecursos(eventoId, recursos) {
    await DB.from(REC).delete().eq('evento_id', eventoId);
    const filas = (recursos || []).map((r) => ({
      evento_id: eventoId, recurso_id: r.recursoId, cantidad: parseInt(r.cantidad, 10) || 1,
    }));
    if (filas.length) await DB.from(REC).insert(filas);
  }

  async function localSyncEspecialistas(eventoId, especialistas) {
    await DB.from(VOL).delete().eq('evento_id', eventoId);
    const filas = (especialistas || []).map((e) => ({
      evento_id: eventoId, usuario_id: e.usuarioId, rol_en_evento: e.especialidad || null,
    }));
    if (filas.length) await DB.from(VOL).insert(filas);
  }

  function localFila(data) {
    const { hora, horaFin } = localSplit(data.horario);
    const asist = (data.asistentes !== '' && data.asistentes != null) ? parseInt(data.asistentes, 10) : null;
    return {
      titulo: data.titulo.trim(),
      descripcion: data.descripcion?.trim() || null,
      fecha: data.fecha,
      hora,
      hora_fin: horaFin,
      ubicacion: data.ubicacion?.trim() || null,
      cupos_disponibles: Number.isNaN(Number(asist)) ? null : asist,
      voluntarios_necesarios: parseInt(data.voluntariosNecesarios, 10) || 0,
      estado: ESTADOS.includes(data.estado) ? data.estado : 'Publicado',
    };
  }

  async function crear(data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.fecha) return { ok: false, error: 'La fecha es obligatoria.' };

    const fila = localFila(data);
    fila.publicado_en = new Date().toISOString();
    fila.sede_id = await localSedeDefault(); // el form no captura sede
    const { data: ins, error } = await DB.from(TABLA).insert(fila).select('id').single();
    if (error) return { ok: false, error: localMsg(error) };

    await localSyncRecursos(ins.id, data.recursos);
    await localSyncEspecialistas(ins.id, data.especialistas);
    return { ok: true };
  }

  async function actualizar(id, data) {
    if (!data.titulo?.trim()) return { ok: false, error: 'El título es obligatorio.' };
    if (!data.fecha) return { ok: false, error: 'La fecha es obligatoria.' };

    const { error } = await DB.from(TABLA).update(localFila(data)).eq('id', id);
    if (error) return { ok: false, error: localMsg(error) };

    await localSyncRecursos(id, data.recursos);
    await localSyncEspecialistas(id, data.especialistas);
    return { ok: true };
  }

  async function eliminar(id) {
    // Las FKs con ON DELETE CASCADE limpian evento_recursos y
    // voluntarios_eventos automáticamente al borrar el evento.
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true };
  }

  // ── Inscripción de un voluntario a un evento ────────────────────────────
  // Un voluntario se apunta a un evento creando su fila en voluntarios_eventos.
  // El rol_en_evento queda null (voluntario general); la disponibilidad, true.
  async function inscribir(eventoId, usuarioId, rol = null) {
    if (!eventoId || !usuarioId) return { ok: false, error: 'Datos de inscripción incompletos.' };
    const { error } = await DB.from(VOL).insert({
      evento_id: eventoId,
      usuario_id: usuarioId,
      rol_en_evento: rol || null,
      disponible: true,
    });
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true };
  }

  // Cancela la inscripción del voluntario (borra su fila puente para ese evento).
  async function cancelarInscripcion(eventoId, usuarioId) {
    if (!eventoId || !usuarioId) return { ok: false, error: 'Datos de inscripción incompletos.' };
    const { error } = await DB.from(VOL).delete().eq('evento_id', eventoId).eq('usuario_id', usuarioId);
    if (error) return { ok: false, error: localMsg(error) };
    return { ok: true };
  }

  return {
    getAll, getById, getByIds, crear, actualizar, eliminar, inscribir, cancelarInscripcion, ESTADOS,
  };
})();
