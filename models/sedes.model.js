/**
 * ============================================================
 * MODELO: sedes.model.js
 * ============================================================
 * Gestiona el almacenamiento de sedes usando localStorage.
 *
 * Cada sede guarda:
 *   - id, nombre, ciudad, direccion, telefono, pastor, miembros
 *
 * Clave: bsp_sedes
 * ============================================================
 */

const SedesModel = (() => {

  const KEY = 'bsp_sedes';

  const DEFAULT = [
    {
      id:        1,
      nombre:    'Sede Central - Chapinero',
      ciudad:    'Bogotá',
      direccion: 'Calle 45 #12-34',
      telefono:  '+57 (601) 234-5678',
      pastor:    'Pastor Juan García',
      miembros:  330
    },
    {
      id:        2,
      nombre:    'Sede Norte - Suba',
      ciudad:    'Bogotá',
      direccion: 'Calle 127 #45-23',
      telefono:  '+57 (601) 234-5679',
      pastor:    'Pastor Pedro Martínez',
      miembros:  220
    },
    {
      id:        3,
      nombre:    'Sede Sur - Kennedy',
      ciudad:    'Bogotá',
      direccion: 'Avenida 68 #23-45',
      telefono:  '+57 (601) 234-5680',
      pastor:    'Pastora María López',
      miembros:  180
    }
  ];

  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY));
  }

  function getById(id) {
    return getAll().find(s => s.id === id) || null;
  }

  function agregar(data) {
    if (!data.nombre?.trim())    return { ok: false, error: 'El nombre es obligatorio.' };
    if (!data.ciudad?.trim())    return { ok: false, error: 'La ciudad es obligatoria.' };
    if (!data.direccion?.trim()) return { ok: false, error: 'La dirección es obligatoria.' };

    const sedes = getAll();
    const nueva = {
      id:        Date.now(),
      nombre:    data.nombre.trim(),
      ciudad:    data.ciudad.trim(),
      direccion: data.direccion.trim(),
      telefono:  data.telefono?.trim() || '',
      pastor:    data.pastor?.trim()   || '',
      miembros:  parseInt(data.miembros) || 0
    };
    sedes.push(nueva);
    localStorage.setItem(KEY, JSON.stringify(sedes));
    return { ok: true, sede: nueva };
  }

  function eliminar(id) {
    const sedes = getAll().filter(s => s.id !== id);
    localStorage.setItem(KEY, JSON.stringify(sedes));
    return { ok: true };
  }

  return { getAll, getById, agregar, eliminar };

})();
