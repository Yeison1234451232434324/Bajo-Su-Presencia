/**
 * ============================================================
 * MODELO: voluntarios.model.js
 * ============================================================
 * Gestiona toda la persistencia de datos del módulo de
 * calificación de voluntarios usando localStorage.
 *
 * Contiene dos colecciones:
 *   - bsp_eventos_vol  : lista de eventos con sus voluntarios asignados
 *   - bsp_calificaciones: calificaciones individuales por voluntario/evento
 * ============================================================
 */

const VoluntariosModel = (() => {

  // ── Claves de almacenamiento ─────────────────────────────────────────────
  const KEY_EVENTOS = 'bsp_eventos_vol';
  const KEY_CALIFS  = 'bsp_calificaciones';

  // ── Datos de ejemplo para arrancar la app ────────────────────────────────
  const EVENTOS_DEFAULT = [
    {
      id: 1,
      nombre: 'Culto Dominical',
      fecha: '2026-05-18',
      lugar: 'Sede Principal',
      voluntariosNecesarios: 8,
      voluntarios: [
        { id: 2, nombre: 'Juan Colaborador',  rol: 'Logística',    disponible: true  },
        { id: 3, nombre: 'Pedro Voluntario',  rol: 'Recepción',    disponible: true  },
        { id: 4, nombre: 'María González',    rol: 'Música',       disponible: false },
        { id: 5, nombre: 'Carlos López',      rol: 'Logística',    disponible: true  }
      ]
    },
    {
      id: 2,
      nombre: 'Grupo de Oración',
      fecha: '2026-05-20',
      lugar: 'Salón B',
      voluntariosNecesarios: 4,
      voluntarios: [
        { id: 3, nombre: 'Pedro Voluntario',  rol: 'Coordinación', disponible: true  },
        { id: 5, nombre: 'Carlos López',      rol: 'Logística',    disponible: false },
        { id: 6, nombre: 'Ana Martínez',      rol: 'Comunicación', disponible: true  }
      ]
    },
    {
      id: 3,
      nombre: 'Encuentro Juvenil',
      fecha: '2026-05-23',
      lugar: 'Auditorio',
      voluntariosNecesarios: 6,
      voluntarios: [
        { id: 2, nombre: 'Juan Colaborador',  rol: 'Jóvenes',      disponible: true  },
        { id: 4, nombre: 'María González',    rol: 'Música',       disponible: true  },
        { id: 6, nombre: 'Ana Martínez',      rol: 'Comunicación', disponible: true  }
      ]
    }
  ];

  // Calificaciones de ejemplo para que el historial no arranque vacío
  const CALIFS_DEFAULT = [
    {
      id: 1,
      eventoId: 1,
      eventoNombre: 'Culto Dominical',
      voluntarioId: 3,
      voluntarioNombre: 'Pedro Voluntario',
      estrellas: 5,
      comentario: 'Excelente desempeño, muy puntual y comprometido.',
      fecha: '2026-05-18'
    },
    {
      id: 2,
      eventoId: 1,
      eventoNombre: 'Culto Dominical',
      voluntarioId: 2,
      voluntarioNombre: 'Juan Colaborador',
      estrellas: 4,
      comentario: 'Buen trabajo en logística, pequeños detalles a mejorar.',
      fecha: '2026-05-18'
    },
    {
      id: 3,
      eventoId: 2,
      eventoNombre: 'Grupo de Oración',
      voluntarioId: 3,
      voluntarioNombre: 'Pedro Voluntario',
      estrellas: 4,
      comentario: 'Muy buena coordinación del grupo.',
      fecha: '2026-05-20'
    }
  ];

  // ── Inicializar datos si no existen ──────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY_EVENTOS)) {
      localStorage.setItem(KEY_EVENTOS, JSON.stringify(EVENTOS_DEFAULT));
    } else {
      // Migración: agregar voluntariosNecesarios a eventos que no lo tengan
      const eventos = JSON.parse(localStorage.getItem(KEY_EVENTOS));
      const defaults = { 1: 8, 2: 4, 3: 6 }; // valores por defecto por ID
      let modificado = false;
      eventos.forEach(ev => {
        if (ev.voluntariosNecesarios === undefined) {
          ev.voluntariosNecesarios = defaults[ev.id] || 5;
          modificado = true;
        }
      });
      if (modificado) localStorage.setItem(KEY_EVENTOS, JSON.stringify(eventos));
    }
    if (!localStorage.getItem(KEY_CALIFS)) {
      localStorage.setItem(KEY_CALIFS, JSON.stringify(CALIFS_DEFAULT));
    }
  }

  // ════════════════════════════════════════════════════════════════
  // EVENTOS
  // ════════════════════════════════════════════════════════════════

  /** Devuelve todos los eventos */
  function getEventos() {
    _init();
    return JSON.parse(localStorage.getItem(KEY_EVENTOS));
  }

  /** Devuelve un evento por su ID */
  function getEventoById(id) {
    return getEventos().find(e => e.id === id) || null;
  }

  // ════════════════════════════════════════════════════════════════
  // CALIFICACIONES
  // ════════════════════════════════════════════════════════════════

  /** Devuelve todas las calificaciones */
  function getCalificaciones() {
    _init();
    return JSON.parse(localStorage.getItem(KEY_CALIFS));
  }

  /**
   * Guarda o actualiza una calificación.
   * Si ya existe una calificación para ese voluntario en ese evento, la sobreescribe.
   * @param {object} data - { eventoId, voluntarioId, estrellas, comentario }
   */
  function guardarCalificacion(data) {
    const califs = getCalificaciones();
    const evento = getEventoById(data.eventoId);
    const vol    = evento?.voluntarios.find(v => v.id === data.voluntarioId);

    if (!evento || !vol) return { ok: false, error: 'Evento o voluntario no encontrado.' };
    if (data.estrellas < 1 || data.estrellas > 5) return { ok: false, error: 'Las estrellas deben ser entre 1 y 5.' };

    // Buscar si ya existe una calificación previa para este par evento/voluntario
    const existeIdx = califs.findIndex(
      c => c.eventoId === data.eventoId && c.voluntarioId === data.voluntarioId
    );

    const registro = {
      id:               existeIdx >= 0 ? califs[existeIdx].id : Date.now(),
      eventoId:         data.eventoId,
      eventoNombre:     evento.nombre,
      voluntarioId:     data.voluntarioId,
      voluntarioNombre: vol.nombre,
      estrellas:        data.estrellas,
      comentario:       data.comentario?.trim() || '',
      fecha:            new Date().toISOString().split('T')[0]
    };

    if (existeIdx >= 0) {
      califs[existeIdx] = registro; // actualizar
    } else {
      califs.push(registro);        // crear nuevo
    }

    localStorage.setItem(KEY_CALIFS, JSON.stringify(califs));
    return { ok: true, registro };
  }

  /**
   * Devuelve la calificación existente para un voluntario en un evento específico.
   * Útil para pre-llenar el formulario al editar.
   */
  function getCalifByEventoVoluntario(eventoId, voluntarioId) {
    return getCalificaciones().find(
      c => c.eventoId === eventoId && c.voluntarioId === voluntarioId
    ) || null;
  }

  /**
   * Devuelve todas las calificaciones de un voluntario específico (historial).
   */
  function getHistorialVoluntario(voluntarioId) {
    return getCalificaciones().filter(c => c.voluntarioId === voluntarioId);
  }

  /**
   * Calcula el resumen estadístico personal de un voluntario:
   * - promedio de estrellas
   * - total de eventos calificados
   * - distribución de estrellas (cuántas veces obtuvo 1, 2, 3, 4, 5)
   * - mejor y peor calificación
   */
  function getResumenVoluntario(voluntarioId) {
    const historial = getHistorialVoluntario(voluntarioId);

    if (historial.length === 0) {
      return {
        promedio:      0,
        total:         0,
        distribucion:  { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        mejor:         null,
        peor:          null
      };
    }

    // Suma total de estrellas para calcular promedio
    const suma = historial.reduce((acc, c) => acc + c.estrellas, 0);

    // Distribución: cuántas calificaciones tiene de cada estrella
    const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    historial.forEach(c => distribucion[c.estrellas]++);

    // Mejor y peor calificación (objetos completos)
    const mejor = historial.reduce((a, b) => a.estrellas >= b.estrellas ? a : b);
    const peor  = historial.reduce((a, b) => a.estrellas <= b.estrellas ? a : b);

    return {
      promedio:     Math.round((suma / historial.length) * 10) / 10, // 1 decimal
      total:        historial.length,
      distribucion,
      mejor,
      peor
    };
  }

  /**
   * Actualiza la disponibilidad de un voluntario en un evento específico.
   * @param {number} eventoId
   * @param {number} voluntarioId
   * @param {boolean} disponible
   */
  function setDisponibilidad(eventoId, voluntarioId, disponible) {
    const eventos = getEventos();
    const evIdx   = eventos.findIndex(e => e.id === eventoId);
    if (evIdx === -1) return { ok: false, error: 'Evento no encontrado.' };

    const volIdx = eventos[evIdx].voluntarios.findIndex(v => v.id === voluntarioId);
    if (volIdx === -1) return { ok: false, error: 'Voluntario no encontrado en este evento.' };

    eventos[evIdx].voluntarios[volIdx].disponible = disponible;
    localStorage.setItem(KEY_EVENTOS, JSON.stringify(eventos));
    return { ok: true };
  }

  // ── API pública del modelo ───────────────────────────────────────────────
  return {
    getEventos,
    getEventoById,
    getCalificaciones,
    guardarCalificacion,
    getCalifByEventoVoluntario,
    getHistorialVoluntario,
    getResumenVoluntario,
    setDisponibilidad
  };

})();
