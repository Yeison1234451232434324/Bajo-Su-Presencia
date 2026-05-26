/**
 * ============================================================
 * MODELO: noticias.model.js
 * ============================================================
 * Gestiona el almacenamiento de noticias publicadas usando
 * localStorage como base de datos simulada.
 *
 * Cada noticia guarda:
 *   - id, titulo, resumen, contenido, autor, imagen,
 *     fecha (legible), fechaISO (para ordenar)
 *
 * Clave de almacenamiento: bsp_noticias
 * ============================================================
 */

const NoticiasModel = (() => {

  const KEY = 'bsp_noticias';

  // ── Datos de ejemplo para que el historial no arranque vacío ─────────────
  const DEFAULT = [
    {
      id:        1,
      titulo:    'Campaña de Ayuda Comunitaria',
      resumen:   'Este mes lanzamos nuestra campaña anual para apoyar a las familias más necesitadas de la comunidad.',
      contenido: 'Con el amor de Cristo como guía, este mes iniciamos nuestra campaña anual de ayuda comunitaria. Recolectaremos alimentos, ropa y útiles escolares para distribuir entre las familias más vulnerables de nuestra ciudad. ¡Únete y sé parte del cambio!',
      autor:     'Pastor Carlos',
      imagen:    'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=600&q=80',
      fecha:     '15 May 2026',
      fechaISO:  '2026-05-15'
    },
    {
      id:        2,
      titulo:    'Nueva Sede en el Norte',
      resumen:   'Con gran alegría anunciamos la apertura de nuestra nueva sede en el norte de la ciudad.',
      contenido: 'Después de meses de preparación y oración, Dios ha abierto las puertas para establecer nuestra nueva sede en el norte de la ciudad. Este espacio estará disponible para cultos, estudios bíblicos y actividades comunitarias. ¡Gloria a Dios!',
      autor:     'Hna. María',
      imagen:    'https://images.unsplash.com/photo-1545987796-200677ee1011?w=600&q=80',
      fecha:     '10 May 2026',
      fechaISO:  '2026-05-10'
    }
  ];

  // ── Inicializar si no existe ─────────────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  /** Devuelve todas las noticias ordenadas de más reciente a más antigua */
  function getAll() {
    _init();
    const noticias = JSON.parse(localStorage.getItem(KEY));
    return noticias.sort((a, b) => b.fechaISO.localeCompare(a.fechaISO));
  }

  /** Devuelve una noticia por ID */
  function getById(id) {
    return getAll().find(n => n.id === id) || null;
  }

  /**
   * Guarda una nueva noticia.
   * @param {object} data - { titulo, resumen, contenido, autor, imagen, fechaISO }
   * @returns {{ ok: boolean, noticia?: object, error?: string }}
   */
  function crear(data) {
    if (!data.titulo?.trim())   return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim())  return { ok: false, error: 'El resumen es obligatorio.' };
    if (!data.autor?.trim())    return { ok: false, error: 'El autor es obligatorio.' };
    if (!data.fechaISO)         return { ok: false, error: 'La fecha es obligatoria.' };

    const noticias = JSON.parse(localStorage.getItem(KEY) || '[]');

    // Convertir fechaISO a fecha legible en español
    const fechaObj = new Date(data.fechaISO + 'T00:00:00');
    const fecha    = fechaObj.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    const nueva = {
      id:        Date.now(),
      titulo:    data.titulo.trim(),
      resumen:   data.resumen.trim(),
      contenido: data.contenido?.trim() || '',
      autor:     data.autor.trim(),
      imagen:    data.imagen?.trim() || '',
      fecha,
      fechaISO:  data.fechaISO
    };

    noticias.push(nueva);
    localStorage.setItem(KEY, JSON.stringify(noticias));
    return { ok: true, noticia: nueva };
  }

  /**
   * Actualiza una noticia existente.
   * @param {number} id
   * @param {object} data
   */
  function actualizar(id, data) {
    if (!data.titulo?.trim())   return { ok: false, error: 'El título es obligatorio.' };
    if (!data.resumen?.trim())  return { ok: false, error: 'El resumen es obligatorio.' };
    if (!data.autor?.trim())    return { ok: false, error: 'El autor es obligatorio.' };
    if (!data.fechaISO)         return { ok: false, error: 'La fecha es obligatoria.' };

    const noticias = JSON.parse(localStorage.getItem(KEY) || '[]');
    const idx      = noticias.findIndex(n => n.id === id);
    if (idx === -1) return { ok: false, error: 'Noticia no encontrada.' };

    const fechaObj = new Date(data.fechaISO + 'T00:00:00');
    const fecha    = fechaObj.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    noticias[idx] = {
      ...noticias[idx],
      titulo:    data.titulo.trim(),
      resumen:   data.resumen.trim(),
      contenido: data.contenido?.trim() || '',
      autor:     data.autor.trim(),
      imagen:    data.imagen?.trim() || '',
      fecha,
      fechaISO:  data.fechaISO
    };

    localStorage.setItem(KEY, JSON.stringify(noticias));
    return { ok: true, noticia: noticias[idx] };
  }

  /**
   * Elimina una noticia por ID.
   * @param {number} id
   */
  function eliminar(id) {
    const noticias = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!noticias.find(n => n.id === id)) return { ok: false, error: 'Noticia no encontrada.' };
    localStorage.setItem(KEY, JSON.stringify(noticias.filter(n => n.id !== id)));
    return { ok: true };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return { getAll, getById, crear, actualizar, eliminar };

})();
