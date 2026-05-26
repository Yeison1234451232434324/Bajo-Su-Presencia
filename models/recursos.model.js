/**
 * ============================================================
 * MODELO: recursos.model.js
 * ============================================================
 * Gestiona el inventario de recursos de la iglesia usando
 * localStorage como base de datos simulada.
 *
 * Colecciones:
 *   - bsp_recursos      : catálogo de recursos con stock y estado
 *   - bsp_asignaciones  : recursos asignados a eventos específicos
 *
 * Categorías disponibles:
 *   Mobiliario | Audio y Video | Iluminación | Papelería | Cocina | Otros
 * ============================================================
 */

const RecursosModel = (() => {

  // ── Claves de localStorage ───────────────────────────────────────────────
  const KEY_RECURSOS     = 'bsp_recursos';
  const KEY_ASIGNACIONES = 'bsp_asignaciones';

  // ── Datos de ejemplo para arrancar la app ────────────────────────────────
  const RECURSOS_DEFAULT = [
    {
      id:          1,
      nombre:      'Sillas plegables',
      categoria:   'Mobiliario',
      descripcion: 'Sillas metálicas plegables para eventos generales.',
      cantidad:    150,   // stock total disponible
      unidad:      'unidades',
      disponible:  true,  // si el recurso está activo/disponible para asignar
      creado:      '2025-01-10'
    },
    {
      id:          2,
      nombre:      'Mesas rectangulares',
      categoria:   'Mobiliario',
      descripcion: 'Mesas de 1.80m x 0.75m para salones.',
      cantidad:    30,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-01-10'
    },
    {
      id:          3,
      nombre:      'Micrófonos inalámbricos',
      categoria:   'Audio y Video',
      descripcion: 'Micrófonos de mano con receptor UHF.',
      cantidad:    8,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-02-05'
    },
    {
      id:          4,
      nombre:      'Proyector Full HD',
      categoria:   'Audio y Video',
      descripcion: 'Proyector 3500 lúmenes, resolución 1080p.',
      cantidad:    2,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-02-05'
    },
    {
      id:          5,
      nombre:      'Pantallas LED portátiles',
      categoria:   'Iluminación',
      descripcion: 'Pantallas LED de 2m x 1m para escenario.',
      cantidad:    0,
      unidad:      'unidades',
      disponible:  false, // sin stock, marcado como no disponible
      creado:      '2025-03-01'
    },
    {
      id:          6,
      nombre:      'Cables de extensión',
      categoria:   'Audio y Video',
      descripcion: 'Extensiones eléctricas de 10m con múltiple toma.',
      cantidad:    20,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-03-15'
    },
    {
      id:          7,
      nombre:      'Mantelería blanca',
      categoria:   'Mobiliario',
      descripcion: 'Manteles blancos para mesas de eventos.',
      cantidad:    40,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-04-01'
    },
    {
      id:          8,
      nombre:      'Reflectores LED',
      categoria:   'Iluminación',
      descripcion: 'Reflectores de escenario RGB programables.',
      cantidad:    6,
      unidad:      'unidades',
      disponible:  true,
      creado:      '2025-04-20'
    }
  ];

  // Asignaciones de ejemplo: qué recursos se usaron en qué eventos
  const ASIGNACIONES_DEFAULT = [
    {
      id:          1,
      eventoId:    1,
      eventoNombre:'Culto Dominical',
      recursoId:   1,
      recursoNombre:'Sillas plegables',
      cantidad:    100,
      fecha:       '2026-05-18',
      nota:        'Para el área principal del santuario.'
    },
    {
      id:          2,
      eventoId:    1,
      eventoNombre:'Culto Dominical',
      recursoId:   3,
      recursoNombre:'Micrófonos inalámbricos',
      cantidad:    4,
      fecha:       '2026-05-18',
      nota:        'Para el equipo de alabanza.'
    }
  ];

  // ── Inicializar datos si no existen ──────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY_RECURSOS)) {
      localStorage.setItem(KEY_RECURSOS, JSON.stringify(RECURSOS_DEFAULT));
    }
    if (!localStorage.getItem(KEY_ASIGNACIONES)) {
      localStorage.setItem(KEY_ASIGNACIONES, JSON.stringify(ASIGNACIONES_DEFAULT));
    }
  }

  // ════════════════════════════════════════════════════════════════
  // RECURSOS — CRUD
  // ════════════════════════════════════════════════════════════════

  /** Devuelve todos los recursos */
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY_RECURSOS));
  }

  /** Devuelve un recurso por ID */
  function getById(id) {
    return getAll().find(r => r.id === id) || null;
  }

  /**
   * Crea un nuevo recurso.
   * Valida que el nombre no esté duplicado.
   */
  function create(data) {
    const recursos = getAll();

    // Validar nombre único (insensible a mayúsculas)
    if (recursos.some(r => r.nombre.toLowerCase() === data.nombre.trim().toLowerCase())) {
      return { ok: false, error: 'Ya existe un recurso con ese nombre.' };
    }
    if (data.cantidad < 0) {
      return { ok: false, error: 'La cantidad no puede ser negativa.' };
    }

    const nuevo = {
      id:          Date.now(),
      nombre:      data.nombre.trim(),
      categoria:   data.categoria,
      descripcion: data.descripcion?.trim() || '',
      cantidad:    parseInt(data.cantidad) || 0,
      unidad:      data.unidad?.trim() || 'unidades',
      disponible:  true,
      creado:      new Date().toISOString().split('T')[0]
    };

    recursos.push(nuevo);
    localStorage.setItem(KEY_RECURSOS, JSON.stringify(recursos));
    return { ok: true, recurso: nuevo };
  }

  /**
   * Actualiza los datos de un recurso existente.
   * Valida nombre único excluyendo el propio recurso.
   */
  function update(id, data) {
    const recursos = getAll();
    const idx      = recursos.findIndex(r => r.id === id);
    if (idx === -1) return { ok: false, error: 'Recurso no encontrado.' };

    if (recursos.some(r => r.nombre.toLowerCase() === data.nombre.trim().toLowerCase() && r.id !== id)) {
      return { ok: false, error: 'Ya existe un recurso con ese nombre.' };
    }
    if (data.cantidad < 0) {
      return { ok: false, error: 'La cantidad no puede ser negativa.' };
    }

    recursos[idx] = {
      ...recursos[idx],
      nombre:      data.nombre.trim(),
      categoria:   data.categoria,
      descripcion: data.descripcion?.trim() || '',
      cantidad:    parseInt(data.cantidad) || 0,
      unidad:      data.unidad?.trim() || 'unidades'
    };

    localStorage.setItem(KEY_RECURSOS, JSON.stringify(recursos));
    return { ok: true, recurso: recursos[idx] };
  }

  /**
   * Cambia el estado disponible/no disponible de un recurso.
   * Un recurso sin stock (cantidad = 0) no puede marcarse como disponible.
   */
  function toggleDisponible(id) {
    const recursos = getAll();
    const idx      = recursos.findIndex(r => r.id === id);
    if (idx === -1) return { ok: false, error: 'Recurso no encontrado.' };

    // Si intenta activar pero no tiene stock, bloquear
    if (!recursos[idx].disponible && recursos[idx].cantidad === 0) {
      return { ok: false, error: 'No se puede activar un recurso sin stock (cantidad = 0).' };
    }

    recursos[idx].disponible = !recursos[idx].disponible;
    localStorage.setItem(KEY_RECURSOS, JSON.stringify(recursos));
    return { ok: true, disponible: recursos[idx].disponible };
  }

  /**
   * Elimina un recurso del inventario.
   * También elimina sus asignaciones a eventos.
   */
  function remove(id) {
    const recursos = getAll();
    if (!recursos.find(r => r.id === id)) return { ok: false, error: 'Recurso no encontrado.' };

    // Eliminar el recurso
    localStorage.setItem(KEY_RECURSOS, JSON.stringify(recursos.filter(r => r.id !== id)));

    // Limpiar asignaciones relacionadas
    const asigs = getAsignaciones().filter(a => a.recursoId !== id);
    localStorage.setItem(KEY_ASIGNACIONES, JSON.stringify(asigs));

    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════
  // ASIGNACIONES — recursos asignados a eventos
  // ════════════════════════════════════════════════════════════════

  /** Devuelve todas las asignaciones */
  function getAsignaciones() {
    _init();
    return JSON.parse(localStorage.getItem(KEY_ASIGNACIONES));
  }

  /**
   * Asigna un recurso a un evento.
   * Si ya existe la combinación evento+recurso, actualiza la cantidad.
   * Valida que la cantidad solicitada no supere el stock disponible.
   */
  function asignarRecurso(data) {
    const recurso = getById(data.recursoId);
    if (!recurso)           return { ok: false, error: 'Recurso no encontrado.' };
    if (!recurso.disponible) return { ok: false, error: 'El recurso no está disponible.' };
    if (data.cantidad < 1)  return { ok: false, error: 'La cantidad debe ser al menos 1.' };
    if (data.cantidad > recurso.cantidad) {
      return { ok: false, error: `Solo hay ${recurso.cantidad} ${recurso.unidad} disponibles.` };
    }

    const asigs    = getAsignaciones();
    const existeIdx = asigs.findIndex(
      a => a.eventoId === data.eventoId && a.recursoId === data.recursoId
    );

    const registro = {
      id:           existeIdx >= 0 ? asigs[existeIdx].id : Date.now(),
      eventoId:     data.eventoId,
      eventoNombre: data.eventoNombre,
      recursoId:    data.recursoId,
      recursoNombre:recurso.nombre,
      cantidad:     parseInt(data.cantidad),
      fecha:        new Date().toISOString().split('T')[0],
      nota:         data.nota?.trim() || ''
    };

    if (existeIdx >= 0) {
      asigs[existeIdx] = registro;
    } else {
      asigs.push(registro);
    }

    localStorage.setItem(KEY_ASIGNACIONES, JSON.stringify(asigs));
    return { ok: true, asignacion: registro };
  }

  /** Elimina la asignación de un recurso a un evento */
  function quitarAsignacion(eventoId, recursoId) {
    const asigs = getAsignaciones().filter(
      a => !(a.eventoId === eventoId && a.recursoId === recursoId)
    );
    localStorage.setItem(KEY_ASIGNACIONES, JSON.stringify(asigs));
    return { ok: true };
  }

  /** Devuelve los recursos asignados a un evento específico */
  function getAsignacionesPorEvento(eventoId) {
    return getAsignaciones().filter(a => a.eventoId === eventoId);
  }

  /**
   * Devuelve estadísticas del inventario:
   * - total de recursos, disponibles, no disponibles, sin stock
   */
  function getEstadisticas() {
    const recursos = getAll();
    return {
      total:        recursos.length,
      disponibles:  recursos.filter(r => r.disponible).length,
      noDisponibles:recursos.filter(r => !r.disponible).length,
      sinStock:     recursos.filter(r => r.cantidad === 0).length
    };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return {
    getAll, getById, create, update, toggleDisponible, remove,
    getAsignaciones, asignarRecurso, quitarAsignacion,
    getAsignacionesPorEvento, getEstadisticas
  };

})();
