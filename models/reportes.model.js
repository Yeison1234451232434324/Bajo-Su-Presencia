/**
 * ============================================================
 * MODELO: reportes.model.js
 * ============================================================
 * Gestiona el almacenamiento de reportes de eventos usando
 * localStorage como base de datos simulada.
 *
 * Cada reporte guarda:
 *   - id, eventoId, eventoTitulo
 *   - ofrenda (número), incidentes (texto), observaciones (texto)
 *   - creadoPor (nombre del usuario), creadoEn (fecha)
 *
 * Clave de almacenamiento: bsp_reportes
 * ============================================================
 */

const ReportesModel = (() => {

  const KEY = 'bsp_reportes';

  // ── Datos de ejemplo ─────────────────────────────────────────────────────
  const DEFAULT = [
    {
      id:           1,
      eventoId:     1,
      eventoTitulo: 'Culto Dominical',
      ofrenda:      1500000,
      incidentes:   'Ninguno',
      observaciones:'Excelente asistencia y participación de la congregación',
      creadoPor:    'Admin',
      creadoEn:     '2026-05-18'
    }
  ];

  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  /** Devuelve todos los reportes */
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY));
  }

  /** Devuelve el reporte de un evento específico (o null) */
  function getByEvento(eventoId) {
    return getAll().find(r => r.eventoId === eventoId) || null;
  }

  /**
   * Guarda o actualiza el reporte de un evento.
   * Si ya existe uno para ese evento, lo sobreescribe.
   */
  function guardar(data) {
    if (!data.eventoId)              return { ok: false, error: 'El evento es obligatorio.' };
    if (data.ofrenda === '' || data.ofrenda === null || isNaN(Number(data.ofrenda)))
                                     return { ok: false, error: 'La ofrenda recaudada es obligatoria.' };
    if (!data.observaciones?.trim()) return { ok: false, error: 'Las observaciones son obligatorias.' };

    const reportes = getAll();
    const existeIdx = reportes.findIndex(r => r.eventoId === data.eventoId);

    const registro = {
      id:           existeIdx >= 0 ? reportes[existeIdx].id : Date.now(),
      eventoId:     data.eventoId,
      eventoTitulo: data.eventoTitulo || '',
      ofrenda:      Number(data.ofrenda),
      incidentes:   data.incidentes?.trim() || 'Ninguno',
      observaciones:data.observaciones.trim(),
      creadoPor:    data.creadoPor || 'Colaborador',
      creadoEn:     new Date().toISOString().split('T')[0]
    };

    if (existeIdx >= 0) {
      reportes[existeIdx] = registro;
    } else {
      reportes.push(registro);
    }

    localStorage.setItem(KEY, JSON.stringify(reportes));
    return { ok: true, reporte: registro };
  }

  /** Elimina el reporte de un evento */
  function eliminar(eventoId) {
    const reportes = getAll().filter(r => r.eventoId !== eventoId);
    localStorage.setItem(KEY, JSON.stringify(reportes));
    return { ok: true };
  }

  return { getAll, getByEvento, guardar, eliminar };

})();
