/**
 * ============================================================
 * ALERTIFY HELPER — Configuración Global de Alertas
 * ============================================================
 * Este archivo configura Alertify.js para mostrar alertas
 * consistentes en toda la aplicación.
 *
 * Uso:
 *   showAlertSuccess('Evento creado', 'El evento fue guardado')
 *   showAlertError('Error', 'No se pudo guardar')
 *   showAlertWarning('Advertencia', 'Verifica los datos')
 *   showAlertConfirm('¿Eliminar?', callback)
 * ============================================================
 */

// Configurar Alertify cuando esté disponible
if (typeof alertify !== 'undefined') {
  // ── Configuración global ──────────────────────────────────────
  alertify.set('notifier', 'position', 'top-right');
  alertify.set('notifier', 'delay', 6);

  // Estilos personalizados: ver helpers/alertify.overrides.css (cargado vía <link> en el HTML)
}

/**
 * Mostrar alerta de éxito (verde con checkmark)
 * @param {string} message - Mensaje a mostrar
 */
function showAlertSuccess(message) {
  if (typeof alertify !== 'undefined') {
    alertify.success(message);
  } else {
    console.log('✓ SUCCESS:', message);
  }
}

/**
 * Mostrar alerta de error (rojo con X)
 * @param {string} message - Mensaje a mostrar
 */
function showAlertError(message) {
  if (typeof alertify !== 'undefined') {
    // 9 s para que el usuario alcance a leer el error (no se esfuma rápido).
    alertify.notify(message, 'error', 9);
  } else {
    console.error('✕ ERROR:', message);
  }
}

/**
 * Mostrar alerta de advertencia (amarillo)
 * @param {string} message - Mensaje a mostrar
 */
function showAlertWarning(message) {
  if (typeof alertify !== 'undefined') {
    alertify.warning(message);
  } else {
    console.warn('⚠ WARNING:', message);
  }
}

/**
 * Mostrar alerta de información (azul)
 * @param {string} message - Mensaje a mostrar
 */
function showAlertInfo(message) {
  if (typeof alertify !== 'undefined') {
    alertify.notify(message, 'info', 4);
  } else {
    console.info('ℹ INFO:', message);
  }
}

/**
 * Mostrar diálogo de confirmación
 * @param {string} title - Título del diálogo
 * @param {string} message - Mensaje del diálogo
 * @param {function} onConfirm - Callback si usuario confirma
 * @param {function} onCancel - Callback si usuario cancela
 */
function showAlertConfirm(title, message, onConfirm, onCancel) {
  if (typeof alertify !== 'undefined') {
    alertify.confirm(message, function(e) {
      if (e) {
        if (typeof onConfirm === 'function') onConfirm();
      } else {
        if (typeof onCancel === 'function') onCancel();
      }
    }).set('title', title).set('labels', { ok: '✓ Confirmar', cancel: '✕ Cancelar' });
  } else {
    if (confirm(message)) {
      if (typeof onConfirm === 'function') onConfirm();
    } else {
      if (typeof onCancel === 'function') onCancel();
    }
  }
}

/**
 * Mostrar diálogo de alerta (con un botón Ok)
 * @param {string} title - Título del diálogo
 * @param {string} message - Mensaje del diálogo
 * @param {function} onOk - Callback cuando se hace clic en Ok
 */
function showAlert(title, message, onOk) {
  if (typeof alertify !== 'undefined') {
    alertify.alert(message, function() {
      if (typeof onOk === 'function') onOk();
    }).set('title', title).set('labels', { ok: '✓ Ok' });
  } else {
    alert(message);
    if (typeof onOk === 'function') onOk();
  }
}

/**
 * Versión mejorada de showToast para compatibilidad
 * @param {string} title - Título
 * @param {string} desc - Descripción
 */
function showToast(title, desc = '') {
  const message = desc ? `${title}: ${desc}` : title;
  showAlertSuccess(message);
}

/**
 * Versión mejorada de showToastError para compatibilidad
 * @param {string} title - Título
 * @param {string} desc - Descripción
 */
function showToastError(title, desc = '') {
  const message = desc ? `${title}: ${desc}` : title;
  showAlertError(message);
}
