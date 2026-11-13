/**
 * ============================================================
 * CONTROLADOR: versiculo-dia.controller.js
 * ============================================================
 * Pie de página público: reemplaza el versículo fijo por el
 * "versículo del día" que entrega el backend (GET /api/versiculo-dia).
 * El backend lo elige solo cada día; aquí solo se pinta.
 *
 * Si la petición falla (sin red, API caída) NO se toca nada: queda el
 * versículo que ya trae el HTML, así el pie nunca se ve vacío.
 *
 * Usa textContent (no innerHTML): el texto viene de una fuente externa.
 * ============================================================
 */
(function versiculoDia() {
  'use strict';

  const texto = document.getElementById('footer-versiculo-texto');
  const ref = document.getElementById('footer-versiculo-ref');
  if (!texto || !ref) return;

  const base = typeof window.API_BASE === 'string' ? window.API_BASE : '';

  fetch(`${base}/api/versiculo-dia`, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const d = json && json.status === 'success' ? json.data : null;
      if (!d || !d.texto || !d.referencia) return;
      texto.textContent = `"${d.texto}"`;
      ref.textContent = `— ${d.referencia}`;
    })
    .catch(() => { /* se conserva el versículo por defecto del HTML */ });
}());
