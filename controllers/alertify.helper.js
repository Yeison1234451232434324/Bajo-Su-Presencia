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
  alertify.set('notifier', 'delay', 4);

  // Estilos personalizados
  const style = document.createElement('style');
  style.textContent = `
    /* ── Contenedor de notificaciones ── */
    .alertify-notifier {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 9999;
    }

    /* ── Base del mensaje ── */
    .ajs-message {
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
      border-radius: 12px !important;
      min-width: 330px;
      max-width: 420px;
      padding: 14px 18px !important;
      animation: ajs-slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex !important;
      align-items: center;
    }

    @keyframes ajs-slideIn {
      from { transform: translateX(120px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    /* ── Icono base (::before compartido) ── */
    .ajs-message::before {
      font-size: 22px;
      font-weight: 900;
      margin-right: 12px;
      flex-shrink: 0;
      text-shadow: 0 1px 4px rgba(0,0,0,0.25);
      line-height: 1;
    }

    /* ── SUCCESS — Verde vívido con chulito ✓ ── */
    .ajs-success {
      background: linear-gradient(135deg, #00b37e 0%, #047857 100%) !important;
      color: white !important;
      border-left: 5px solid #34d399 !important;
      box-shadow: 0 8px 28px rgba(0, 179, 126, 0.5), 0 2px 8px rgba(0,0,0,0.18) !important;
    }
    .ajs-success::before { content: '✓'; }

    /* ── ERROR — Rojo vívido con X ✕ ── */
    .ajs-error {
      background: linear-gradient(135deg, #e11d48 0%, #9f1239 100%) !important;
      color: white !important;
      border-left: 5px solid #fb7185 !important;
      box-shadow: 0 8px 28px rgba(225, 29, 72, 0.5), 0 2px 8px rgba(0,0,0,0.18) !important;
    }
    .ajs-error::before { content: '✕'; }

    /* ── WARNING — Ámbar dorado (color acento de la app) ── */
    .ajs-warning {
      background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%) !important;
      color: white !important;
      border-left: 5px solid #fcd34d !important;
      box-shadow: 0 8px 28px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0,0,0,0.18) !important;
    }
    .ajs-warning::before { content: '⚠'; }

    /* ── INFO — Azul marino de la app (#1E3A8A) con borde dorado (#F5C215) ── */
    .ajs-info {
      background: linear-gradient(135deg, #1E3A8A 0%, #0F1E5A 100%) !important;
      color: white !important;
      border-left: 5px solid #F5C215 !important;
      box-shadow: 0 8px 28px rgba(30, 58, 138, 0.55), 0 2px 8px rgba(0,0,0,0.18) !important;
    }
    .ajs-info::before { content: 'ℹ'; }

    /* ── Diálogos (Confirm, Prompt, Alert) ── */
    .ajs-dialog {
      border-radius: 12px !important;
      font-family: 'Cormorant Garamond', serif;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25) !important;
      overflow: hidden;
    }

    .ajs-dialog .ajs-header {
      background: linear-gradient(135deg, #1E3A8A, #0F1E5A) !important;
      color: white !important;
      font-weight: 700;
      font-size: 17px;
      letter-spacing: 0.02em;
      padding: 16px 22px !important;
      border-bottom: 3px solid #F5C215 !important;
    }

    .ajs-dialog .ajs-content {
      padding: 20px 22px !important;
      color: #1f2937;
      font-size: 15px;
      line-height: 1.6;
    }

    .ajs-dialog .ajs-footer {
      padding: 14px 22px !important;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #f9fafb;
    }

    .ajs-dialog .ajs-button {
      border-radius: 8px !important;
      padding: 9px 20px !important;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none !important;
      font-family: 'Cormorant Garamond', serif;
      letter-spacing: 0.02em;
    }

    /* Botón Ok / Confirmar — verde vívido */
    .ajs-button.ajs-ok {
      background: linear-gradient(135deg, #00b37e, #047857) !important;
      color: white !important;
      box-shadow: 0 4px 12px rgba(0, 179, 126, 0.35);
    }
    .ajs-button.ajs-ok:hover {
      background: linear-gradient(135deg, #059669, #065f46) !important;
      transform: scale(1.03);
      box-shadow: 0 6px 16px rgba(0, 179, 126, 0.45);
    }

    /* Botón Cancelar — neutro */
    .ajs-button.ajs-cancel {
      background: linear-gradient(135deg, #e5e7eb, #d1d5db) !important;
      color: #374151 !important;
    }
    .ajs-button.ajs-cancel:hover {
      background: linear-gradient(135deg, #d1d5db, #9ca3af) !important;
      transform: scale(1.02);
    }

    /* Botón Resend — azul marino de la app */
    .ajs-button.ajs-resend {
      background: linear-gradient(135deg, #1E3A8A, #0F1E5A) !important;
      color: white !important;
    }
    .ajs-button.ajs-resend:hover {
      background: linear-gradient(135deg, #0F1E5A, #070e2a) !important;
      transform: scale(1.02);
    }

    /* Input en diálogos */
    .ajs-dialog input {
      padding: 10px 14px;
      border: 2px solid #d1d5db !important;
      border-radius: 8px !important;
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .ajs-dialog input:focus {
      outline: none;
      border-color: #1E3A8A !important;
      box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.15);
    }
  `;
  document.head.appendChild(style);
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
    alertify.error(message);
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
