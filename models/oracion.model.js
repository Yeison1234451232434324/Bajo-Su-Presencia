/**
 * ============================================================
 * MODELO: oracion.model.js
 * ============================================================
 * Gestiona el almacenamiento de oraciones publicadas usando
 * localStorage como base de datos simulada.
 *
 * Cada oración guarda:
 *   - id, texto, versiculo, imagen, fecha, fechaISO
 *
 * Clave de almacenamiento: bsp_oraciones
 * ============================================================
 */

const OracionModel = (() => {

  const KEY = 'bsp_oraciones';

  // ── Datos de ejemplo para que el historial no arranque vacío ─────────────
  const DEFAULT = [
    {
      id:        1,
      texto:     'Señor, guía nuestros pasos en tu camino de luz y amor. Que tu paz que sobrepasa todo entendimiento guarde nuestros corazones y nuestras mentes en Cristo Jesús.',
      versiculo: 'Filipenses 4:7',
      imagen:    '',
      fecha:     '25 May 2026',
      fechaISO:  '2026-05-25'
    },
    {
      id:        2,
      texto:     'Padre celestial, gracias por un nuevo día lleno de tus misericordias. Que cada momento de hoy sea una oportunidad para glorificarte y servir a quienes nos rodean.',
      versiculo: 'Lamentaciones 3:22-23',
      imagen:    '',
      fecha:     '24 May 2026',
      fechaISO:  '2026-05-24'
    }
  ];

  // ── Inicializar si no existe ─────────────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  /** Devuelve todas las oraciones ordenadas de más reciente a más antigua */
  function getAll() {
    _init();
    const oraciones = JSON.parse(localStorage.getItem(KEY));
    return oraciones.sort((a, b) => b.fechaISO.localeCompare(a.fechaISO));
  }

  /** Devuelve una oración por ID */
  function getById(id) {
    return getAll().find(o => o.id === id) || null;
  }

  /**
   * Guarda una nueva oración.
   * @param {object} data - { texto, versiculo, imagen }
   * @returns {{ ok: boolean, oracion?: object, error?: string }}
   */
  function crear(data) {
    if (!data.texto?.trim()) return { ok: false, error: 'El texto de la oración es obligatorio.' };

    const oraciones = JSON.parse(localStorage.getItem(KEY) || '[]');
    const hoy       = new Date();
    const fechaISO  = hoy.toISOString().split('T')[0];
    const fecha     = hoy.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    const nueva = {
      id:        Date.now(),
      texto:     data.texto.trim(),
      versiculo: data.versiculo?.trim() || '',
      imagen:    data.imagen?.trim()    || '',
      fecha,
      fechaISO
    };

    oraciones.push(nueva);
    localStorage.setItem(KEY, JSON.stringify(oraciones));
    return { ok: true, oracion: nueva };
  }

  /**
   * Actualiza una oración existente.
   * @param {number} id
   * @param {object} data - { texto, versiculo, imagen }
   */
  function actualizar(id, data) {
    if (!data.texto?.trim()) return { ok: false, error: 'El texto de la oración es obligatorio.' };

    const oraciones = JSON.parse(localStorage.getItem(KEY) || '[]');
    const idx       = oraciones.findIndex(o => o.id === id);
    if (idx === -1) return { ok: false, error: 'Oración no encontrada.' };

    oraciones[idx] = {
      ...oraciones[idx],
      texto:     data.texto.trim(),
      versiculo: data.versiculo?.trim() || '',
      imagen:    data.imagen?.trim()    || ''
    };

    localStorage.setItem(KEY, JSON.stringify(oraciones));
    return { ok: true, oracion: oraciones[idx] };
  }

  /**
   * Elimina una oración por ID.
   * @param {number} id
   */
  function eliminar(id) {
    const oraciones = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!oraciones.find(o => o.id === id)) return { ok: false, error: 'Oración no encontrada.' };
    localStorage.setItem(KEY, JSON.stringify(oraciones.filter(o => o.id !== id)));
    return { ok: true };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return { getAll, getById, crear, actualizar, eliminar };

})();
