/**
 * ============================================================
 * MODELO: actividades.model.js
 * ============================================================
 * Gestiona el almacenamiento de actividades por evento usando
 * localStorage como base de datos simulada.
 *
 * Cada actividad guarda:
 *   - id, eventoId, titulo, descripcion, prioridad (alta/media/baja)
 *   - voluntarioId, voluntarioNombre, completada, creadaEn
 *
 * Clave de almacenamiento: bsp_actividades
 * ============================================================
 */

const ActividadesModel = (() => {

  const KEY = 'bsp_actividades';

  // ── Datos de ejemplo ─────────────────────────────────────────────────────
  const DEFAULT = [
    {
      id:               1,
      eventoId:         1,
      titulo:           'Recibir invitados',
      descripcion:      'Dar la bienvenida a los asistentes en la entrada',
      prioridad:        'alta',
      voluntarioId:     4,
      voluntarioNombre: 'María González',
      completada:       false,
      creadaEn:         '2026-05-10'
    },
    {
      id:               2,
      eventoId:         1,
      titulo:           'Operar proyector',
      descripcion:      'Manejar presentaciones durante el servicio',
      prioridad:        'alta',
      voluntarioId:     2,
      voluntarioNombre: 'Juan Colaborador',
      completada:       true,
      creadaEn:         '2026-05-10'
    },
    {
      id:               3,
      eventoId:         1,
      titulo:           'Preparar café',
      descripcion:      'Tener listo el café para después del servicio',
      prioridad:        'media',
      voluntarioId:     6,
      voluntarioNombre: 'Ana Martínez',
      completada:       false,
      creadaEn:         '2026-05-10'
    },
    {
      id:               4,
      eventoId:         2,
      titulo:           'Coordinar sonido',
      descripcion:      'Manejar el equipo de audio durante el encuentro',
      prioridad:        'alta',
      voluntarioId:     3,
      voluntarioNombre: 'Pedro Voluntario',
      completada:       false,
      creadaEn:         '2026-05-12'
    }
  ];

  // ── Inicializar si no existe ─────────────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  /** Devuelve todas las actividades */
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY));
  }

  /** Devuelve las actividades de un evento específico */
  function getByEvento(eventoId) {
    return getAll().filter(a => a.eventoId === eventoId);
  }

  /** Devuelve una actividad por ID */
  function getById(id) {
    return getAll().find(a => a.id === id) || null;
  }

  /**
   * Crea una nueva actividad.
   * @param {object} data - { eventoId, titulo, descripcion, prioridad, voluntarioId, voluntarioNombre }
   * @returns {{ ok: boolean, actividad?: object, error?: string }}
   */
  function crear(data) {
    if (!data.titulo?.trim())        return { ok: false, error: 'El título es obligatorio.' };
    if (!data.eventoId)              return { ok: false, error: 'El evento es obligatorio.' };
    if (!data.voluntarioId)          return { ok: false, error: 'Debes asignar un voluntario.' };
    if (!['alta','media','baja'].includes(data.prioridad))
                                     return { ok: false, error: 'Prioridad inválida.' };

    const actividades = getAll();
    const nueva = {
      id:               Date.now(),
      eventoId:         data.eventoId,
      titulo:           data.titulo.trim(),
      descripcion:      data.descripcion?.trim() || '',
      prioridad:        data.prioridad,
      voluntarioId:     data.voluntarioId,
      voluntarioNombre: data.voluntarioNombre,
      completada:       false,
      creadaEn:         new Date().toISOString().split('T')[0]
    };

    actividades.push(nueva);
    localStorage.setItem(KEY, JSON.stringify(actividades));
    return { ok: true, actividad: nueva };
  }

  /**
   * Actualiza una actividad existente.
   * @param {number} id
   * @param {object} data - mismos campos que crear()
   */
  function actualizar(id, data) {
    if (!data.titulo?.trim())        return { ok: false, error: 'El título es obligatorio.' };
    if (!data.voluntarioId)          return { ok: false, error: 'Debes asignar un voluntario.' };
    if (!['alta','media','baja'].includes(data.prioridad))
                                     return { ok: false, error: 'Prioridad inválida.' };

    const actividades = getAll();
    const idx = actividades.findIndex(a => a.id === id);
    if (idx === -1) return { ok: false, error: 'Actividad no encontrada.' };

    actividades[idx] = {
      ...actividades[idx],
      titulo:           data.titulo.trim(),
      descripcion:      data.descripcion?.trim() || '',
      prioridad:        data.prioridad,
      voluntarioId:     data.voluntarioId,
      voluntarioNombre: data.voluntarioNombre
    };

    localStorage.setItem(KEY, JSON.stringify(actividades));
    return { ok: true, actividad: actividades[idx] };
  }

  /**
   * Marca o desmarca una actividad como completada.
   * @param {number} id
   * @param {boolean} completada
   */
  function toggleCompletada(id, completada) {
    const actividades = getAll();
    const idx = actividades.findIndex(a => a.id === id);
    if (idx === -1) return { ok: false, error: 'Actividad no encontrada.' };

    actividades[idx].completada = completada;
    localStorage.setItem(KEY, JSON.stringify(actividades));
    return { ok: true };
  }

  /** Elimina una actividad */
  function eliminar(id) {
    const actividades = getAll().filter(a => a.id !== id);
    localStorage.setItem(KEY, JSON.stringify(actividades));
    return { ok: true };
  }

  /**
   * Devuelve un resumen de actividades para un evento:
   * { total, completadas, pendientes }
   */
  function getResumenEvento(eventoId) {
    const acts = getByEvento(eventoId);
    const completadas = acts.filter(a => a.completada).length;
    return {
      total:       acts.length,
      completadas,
      pendientes:  acts.length - completadas
    };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return { getAll, getByEvento, getById, crear, actualizar, toggleCompletada, eliminar, getResumenEvento };

})();
