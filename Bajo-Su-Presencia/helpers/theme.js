/**
 * ============================================================
 * MODO OSCURO — botón flotante + persistencia
 * ============================================================
 * - Aplica el tema guardado ANTES de pintar (sin parpadeo): este script se
 *   carga en el <head> y ejecuta aplicar() de inmediato, no en DOMContentLoaded.
 * - El botón (sol/luna) alterna entre claro/oscuro y guarda la preferencia en
 *   localStorage bajo 'bspTheme'.
 * - El tema se expresa con el atributo data-theme="dark" en <html>; los estilos
 *   viven en helpers/theme.css (selectores :root[data-theme="dark"] / [data-theme]).
 * ============================================================
 */
(function () {
  'use strict';

  var KEY  = 'bspTheme';
  var root = document.documentElement;

  var LUNA = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SOL  = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

  /** Aplica el tema al <html> (dark = atributo presente). */
  function aplicar(tema) {
    if (tema === 'dark') { root.setAttribute('data-theme', 'dark'); }
    else { root.removeAttribute('data-theme'); }
  }

  // 1) Aplicar de inmediato el tema guardado (antes de pintar el body).
  aplicar(localStorage.getItem(KEY) || 'light');

  // 2) Insertar el botón cuando el body exista.
  function montarBoton() {
    if (document.getElementById('bsp-theme-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'bsp-theme-toggle';
    btn.className = 'bsp-theme-toggle';
    btn.type = 'button';

    function refrescar() {
      var oscuro = root.getAttribute('data-theme') === 'dark';
      // Mostramos el icono del modo AL QUE cambiará: en oscuro → sol; en claro → luna.
      btn.innerHTML = oscuro ? SOL : LUNA;
      btn.setAttribute('aria-pressed', String(oscuro));
      btn.setAttribute('aria-label', oscuro ? 'Activar modo claro' : 'Activar modo oscuro');
      btn.setAttribute('title', oscuro ? 'Modo claro' : 'Modo oscuro');
    }

    btn.addEventListener('click', function () {
      var nuevo = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      aplicar(nuevo);
      try { localStorage.setItem(KEY, nuevo); } catch (_) { /* almacenamiento no disponible */ }
      refrescar();
    });

    document.body.appendChild(btn);
    refrescar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montarBoton);
  } else {
    montarBoton();
  }
})();
