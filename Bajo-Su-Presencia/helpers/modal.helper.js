/**
 * ============================================================
 * BSPModal — comportamiento compartido de todos los modales
 * ============================================================
 * Antes de esto, cada módulo (Recursos, Usuarios, Eventos, PQR,
 * Sedes, Actividades, Noticias, Oración, Voluntarios, Reportes)
 * reimplementaba abrir/cerrar a mano, con huecos distintos en
 * cada uno: casi ninguno cerraba con ESC, ninguno atrapaba el
 * foco (Tab podía salirse del modal hacia el fondo) ni restauraba
 * el foco al elemento que lo abrió, y algunos no bloqueaban el
 * scroll del body.
 *
 * BSPModal.abrir(cfg) / BSPModal.cerrar(cfg) centralizan:
 *   - Mostrar/ocultar (soporta el patrón de clase 'visible' y el
 *     patrón display:flex/none, según lo que use cada módulo).
 *   - Bloqueo de scroll del body mientras haya algún modal abierto
 *     (contador: si dos modales se solapan, el scroll solo se
 *     restaura cuando se cierra el último).
 *   - Cierre con tecla ESC.
 *   - Focus trap: Tab/Shift+Tab no puede salir del modal.
 *   - Foco inicial al primer elemento enfocable del modal.
 *   - Restaurar el foco al elemento que abrió el modal, al cerrar.
 *
 * Uso típico dentro de un controller:
 *   BSPModal.abrir({ overlay: elOverlay, modal: elModal });
 *   BSPModal.cerrar({ overlay: elOverlay, modal: elModal });
 *
 * Si el overlay y la caja del modal son el MISMO elemento (patrón
 * usado por eventos.controller.js, .ev-modal-overlay contiene
 * .ev-modal-box), pasa el mismo elemento en overlay y modal.
 * ============================================================
 */

const BSPModal = (() => {

  let abiertos = 0;                 // contador de modales abiertos (bloqueo de scroll anidado)
  const activos = new Map();        // modalEl -> { overlay, modal, trigger, onKeydown }

  const SELECTOR_ENFOCABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Muestra/oculta un elemento del modal. Dos patrones conviven en el
   * proyecto (ver informe del módulo 11):
   *   - 'clase'   (por defecto): toggle de la clase 'visible' + transición
   *      CSS de opacity/transform (recursos, usuarios, noticias, oración,
   *      voluntarios, pqr-admin).
   *   - 'display': alterna style.display entre 'flex' y 'none' (eventos,
   *      sedes, actividades, generar-reportes).
   * Se indica con cfg.modoDisplay = true al llamar a abrir()/cerrar().
   */
  function _muestra(el, mostrar, modoDisplay) {
    if (!el) return;
    if (modoDisplay) {
      el.style.display = mostrar ? 'flex' : 'none';
    } else {
      el.classList.toggle('visible', mostrar);
    }
  }

  function _elementosEnfocables(modal) {
    return Array.from(modal.querySelectorAll(SELECTOR_ENFOCABLE))
      .filter(el => el.offsetParent !== null); // visibles
  }

  /**
   * Abre un modal.
   * @param {Object} cfg
   * @param {HTMLElement} cfg.overlay - overlay (o el mismo modal si están combinados)
   * @param {HTMLElement} cfg.modal   - caja del modal (contenido, para el focus trap)
   * @param {HTMLElement} [cfg.trigger] - elemento a devolver el foco al cerrar
   *        (por defecto, document.activeElement en el momento de abrir)
   */
  function abrir(cfg) {
    const { overlay, modal, modoDisplay } = cfg;
    if (!modal) return;
    // Reabrir un modal ya abierto (doble clic, etc.) no debe duplicar el
    // listener de teclado ni contar dos veces para el bloqueo de scroll.
    if (activos.has(modal)) return;

    const trigger = cfg.trigger || document.activeElement;

    _muestra(overlay, true, modoDisplay);
    if (overlay !== modal) _muestra(modal, true, modoDisplay);

    if (abiertos === 0) document.body.style.overflow = 'hidden';
    abiertos++;

    // Foco inicial: primer campo enfocable, o el propio modal.
    // setTimeout (no requestAnimationFrame): rAF no se ejecuta si la pestaña
    // está en segundo plano o no está compositando frames, y el foco inicial
    // nunca llegaría a aplicarse. setTimeout sí se ejecuta en ese caso.
    const enfocables = _elementosEnfocables(modal);
    setTimeout(() => {
      (enfocables[0] || modal).focus?.();
    }, 0);

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar(cfg);
        return;
      }
      if (e.key === 'Tab') {
        const items = _elementosEnfocables(modal);
        if (items.length === 0) return;
        const primero = items[0];
        const ultimo  = items[items.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault(); ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault(); primero.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeydown, true);

    activos.set(modal, { overlay, modal, trigger, onKeydown });
  }

  /**
   * Cierra un modal previamente abierto con BSPModal.abrir().
   * Es seguro llamarla sobre un modal que no estaba abierto (algunos
   * módulos, ej. usuarios.controller.js, cierran "todos" los modales
   * de la página al hacer clic en un overlay compartido) — en ese
   * caso no hace nada, sin descontar del contador de scroll.
   */
  function cerrar(cfg) {
    const { overlay, modal, modoDisplay } = cfg;
    if (!modal) return;
    const estado = activos.get(modal);
    if (!estado) return; // este modal no estaba abierto: no-op

    _muestra(overlay, false, modoDisplay);
    if (overlay !== modal) _muestra(modal, false, modoDisplay);

    document.removeEventListener('keydown', estado.onKeydown, true);
    activos.delete(modal);
    // Restaurar el foco a quien abrió el modal (botón "Editar", "Ver", etc).
    if (estado.trigger && typeof estado.trigger.focus === 'function') {
      estado.trigger.focus();
    }

    abiertos = Math.max(0, abiertos - 1);
    if (abiertos === 0) document.body.style.overflow = '';
  }

  return { abrir, cerrar };
})();

window.BSPModal = BSPModal;
