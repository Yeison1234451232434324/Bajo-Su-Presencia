/**
 * ============================================================
 * MODELO: pqr.model.js
 * ============================================================
 * Gestiona las Peticiones, Quejas y Reclamos (PQR) de la
 * comunidad usando localStorage como base de datos simulada.
 *
 * Clave localStorage: bsp_pqr
 *
 * Campos de cada PQR:
 *   id, tipo, nombre, email, telefono, asunto, descripcion,
 *   estado, prioridad, creadoEn, respuesta, respondidoEn,
 *   respondidoPor
 * ============================================================
 */

const PQRModel = (() => {

  // ── Clave de localStorage ────────────────────────────────────────────────
  const KEY = 'bsp_pqr';

  // ── Datos de ejemplo para arrancar la app ────────────────────────────────
  const PQR_DEFAULT = [
    {
      id:           1748000001,
      tipo:         'Petición',
      nombre:       'María González',
      email:        'maria.gonzalez@email.com',
      telefono:     '+57 310 234 5678',
      asunto:       'Solicitud de espacio para grupo de oración',
      descripcion:  'Quisiera solicitar un espacio disponible los martes en la tarde para reunir a un grupo de oración de aproximadamente 15 personas. Somos un grupo que lleva 2 años reuniéndose y necesitamos un lugar fijo.',
      estado:       'En proceso',
      prioridad:    'Media',
      creadoEn:     '2026-05-10T09:30:00.000Z',
      respuesta:    'Hemos recibido su solicitud y estamos revisando la disponibilidad de los salones. Le contactaremos pronto.',
      respondidoEn: '2026-05-11T14:00:00.000Z',
      respondidoPor:'Pastor Carlos'
    },
    {
      id:           1748000002,
      tipo:         'Queja',
      nombre:       'Juan Pérez',
      email:        'juan.perez@email.com',
      telefono:     '',
      asunto:       'Problemas con el sonido durante el culto dominical',
      descripcion:  'Durante los últimos tres domingos el sistema de sonido ha fallado repetidamente, lo que dificulta escuchar la predicación desde las últimas filas. Esto afecta la experiencia de adoración de muchos hermanos.',
      estado:       'Pendiente',
      prioridad:    'Alta',
      creadoEn:     '2026-05-12T16:45:00.000Z',
      respuesta:    '',
      respondidoEn: null,
      respondidoPor:''
    },
    {
      id:           1748000003,
      tipo:         'Reclamo',
      nombre:       'Ana Rodríguez',
      email:        'ana.rodriguez@email.com',
      telefono:     '+57 320 987 6543',
      asunto:       'Inscripción al retiro espiritual no procesada',
      descripcion:  'Me inscribí al retiro espiritual de jóvenes hace tres semanas y realicé el pago correspondiente, pero no he recibido confirmación ni información sobre el evento. Ya intenté comunicarme por teléfono sin éxito.',
      estado:       'Resuelto',
      prioridad:    'Alta',
      creadoEn:     '2026-05-08T11:20:00.000Z',
      respuesta:    'Hemos verificado su inscripción y el pago. Fue un error administrativo. Su lugar está confirmado. Le enviamos el correo con todos los detalles del retiro. Disculpe los inconvenientes.',
      respondidoEn: '2026-05-09T10:00:00.000Z',
      respondidoPor:'Secretaría'
    }
  ];

  // ── Inicializar datos si no existen ──────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(PQR_DEFAULT));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Devuelve todos los PQR */
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY));
  }

  /** Devuelve un PQR por ID */
  function getById(id) {
    return getAll().find(p => p.id === id) || null;
  }

  /**
   * Crea un nuevo PQR.
   * Valida que nombre, email, asunto y descripcion sean obligatorios.
   */
  function crear(data) {
    // Validaciones obligatorias
    if (!data.nombre || !data.nombre.trim()) {
      return { ok: false, error: 'El nombre es obligatorio.' };
    }
    if (!data.email || !data.email.trim()) {
      return { ok: false, error: 'El correo electrónico es obligatorio.' };
    }
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
    }
    if (!data.asunto || !data.asunto.trim()) {
      return { ok: false, error: 'El asunto es obligatorio.' };
    }
    if (!data.descripcion || !data.descripcion.trim()) {
      return { ok: false, error: 'La descripción es obligatoria.' };
    }

    const tiposValidos = ['Petición', 'Queja', 'Reclamo'];
    const tipo = tiposValidos.includes(data.tipo) ? data.tipo : 'Petición';

    const prioridadesValidas = ['Baja', 'Media', 'Alta'];
    const prioridad = prioridadesValidas.includes(data.prioridad) ? data.prioridad : 'Media';

    const nuevo = {
      id:           Date.now(),
      tipo:         tipo,
      nombre:       data.nombre.trim(),
      email:        data.email.trim().toLowerCase(),
      telefono:     data.telefono?.trim() || '',
      asunto:       data.asunto.trim(),
      descripcion:  data.descripcion.trim(),
      estado:       'Pendiente',
      prioridad:    prioridad,
      creadoEn:     new Date().toISOString(),
      respuesta:    '',
      respondidoEn: null,
      respondidoPor:''
    };

    const lista = getAll();
    lista.push(nuevo);
    localStorage.setItem(KEY, JSON.stringify(lista));
    return { ok: true, pqr: nuevo };
  }

  /**
   * Actualiza los datos de un PQR existente.
   */
  function actualizar(id, data) {
    const lista = getAll();
    const idx   = lista.findIndex(p => p.id === id);
    if (idx === -1) return { ok: false, error: 'PQR no encontrado.' };

    lista[idx] = { ...lista[idx], ...data };
    localStorage.setItem(KEY, JSON.stringify(lista));
    return { ok: true, pqr: lista[idx] };
  }

  /**
   * Cambia el estado de un PQR.
   * Estados válidos: 'Pendiente' | 'En proceso' | 'Resuelto' | 'Cerrado'
   */
  function cambiarEstado(id, nuevoEstado) {
    const estadosValidos = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      return { ok: false, error: 'Estado no válido.' };
    }

    const lista = getAll();
    const idx   = lista.findIndex(p => p.id === id);
    if (idx === -1) return { ok: false, error: 'PQR no encontrado.' };

    lista[idx].estado = nuevoEstado;
    localStorage.setItem(KEY, JSON.stringify(lista));
    return { ok: true, pqr: lista[idx] };
  }

  /**
   * Guarda la respuesta del administrador a un PQR.
   * También actualiza el estado si se proporciona.
   */
  function responder(id, respuesta, nuevoEstado, respondidoPor) {
    const lista = getAll();
    const idx   = lista.findIndex(p => p.id === id);
    if (idx === -1) return { ok: false, error: 'PQR no encontrado.' };

    if (!respuesta || !respuesta.trim()) {
      return { ok: false, error: 'La respuesta no puede estar vacía.' };
    }

    lista[idx].respuesta    = respuesta.trim();
    lista[idx].respondidoEn = new Date().toISOString();
    lista[idx].respondidoPor= respondidoPor?.trim() || 'Administrador';

    if (nuevoEstado) {
      const estadosValidos = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];
      if (estadosValidos.includes(nuevoEstado)) {
        lista[idx].estado = nuevoEstado;
      }
    }

    localStorage.setItem(KEY, JSON.stringify(lista));
    return { ok: true, pqr: lista[idx] };
  }

  /**
   * Elimina un PQR por ID.
   */
  function eliminar(id) {
    const lista = getAll();
    if (!lista.find(p => p.id === id)) {
      return { ok: false, error: 'PQR no encontrado.' };
    }
    localStorage.setItem(KEY, JSON.stringify(lista.filter(p => p.id !== id)));
    return { ok: true };
  }

  /**
   * Devuelve estadísticas de los PQR:
   * total, pendientes, en proceso, resueltos, cerrados
   */
  function getEstadisticas() {
    const lista = getAll();
    return {
      total:     lista.length,
      pendientes: lista.filter(p => p.estado === 'Pendiente').length,
      enProceso:  lista.filter(p => p.estado === 'En proceso').length,
      resueltos:  lista.filter(p => p.estado === 'Resuelto').length,
      cerrados:   lista.filter(p => p.estado === 'Cerrado').length
    };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return {
    getAll,
    getById,
    crear,
    actualizar,
    cambiarEstado,
    responder,
    eliminar,
    getEstadisticas
  };

})();
