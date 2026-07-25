/**
 * ============================================================
 * HELPER DE HORARIO — parseo y formato de horas de eventos
 * ============================================================
 * Funciones PURAS (entrada → salida, sin DOM ni estado compartido) extraídas
 * de eventos.controller.js para separar la responsabilidad de manipular
 * cadenas de hora de la orquestación de la interfaz del formulario.
 *
 * Se conserva la lógica EXACTA que vivía en el controlador; solo cambian su
 * ubicación y el espacio de nombres (window.BSPHorario). No se añade ni se
 * quita ningún caso: mismos formatos aceptados, mismas salidas.
 * ============================================================
 */
(function (global) {
  'use strict';

  /** Une "HH:MM" de inicio y fin en "HH:MM - HH:MM" (tolera valores vacíos). */
  function combinar(inicio, fin) {
    if (!inicio && !fin) return '';
    if (!fin)    return inicio;
    if (!inicio) return fin;
    return `${inicio} - ${fin}`;
  }

  /** Normaliza una hora ("9:00", "09:00 PM") a formato 24 h "HH:MM". */
  function convertir24h(str) {
    if (!str) return '';
    str = str.trim();
    if (/^\d{1,2}:\d{2}$/.test(str)) { const [h, m] = str.split(':'); return `${h.padStart(2,'0')}:${m}`; }
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1]); const min = match[2], mer = match[3].toUpperCase();
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${min}`;
    }
    return str;
  }

  /** Separa "HH:MM - HH:MM" en { inicio, fin } normalizados a 24 h. */
  function parse(horario) {
    if (!horario) return { inicio: '', fin: '' };
    const parts = horario.split(' - ');
    if (parts.length >= 2) return { inicio: convertir24h(parts[0].trim()), fin: convertir24h(parts[1].trim()) };
    return { inicio: convertir24h(parts[0].trim()), fin: '' };
  }

  global.BSPHorario = { combinar, convertir24h, parse };
})(window);
