/**
 * ============================================================
 * CONTROLADOR: pqr.controller.js
 * ============================================================
 * Maneja la lógica del formulario público de PQR.
 * Depende de: PQRModel (pqr.model.js)
 *
 * Funciones:
 *   - Validación del formulario al submit
 *   - Llamada a PQRModel.crear()
 *   - Mostrar mensaje de éxito y limpiar formulario
 *   - Botón "Enviar otra solicitud" para reiniciar
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const form       = document.getElementById('form-pqr');
  const successBox = document.getElementById('pqr-success');
  const btnNueva   = document.getElementById('pqr-btn-nueva');
  const btnSubmit  = document.getElementById('pqr-btn-submit');

  // ── Helpers de validación DOM ────────────────────────────────────────────
  function _err(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('campo-invalido');
    const box = el.closest('.pqr-form-group, .form-group') || el.parentElement;
    let s = box.querySelector('.campo-error');
    if (!s) { s = document.createElement('span'); s.className = 'campo-error'; box.appendChild(s); }
    s.textContent = msg;
  }
  function _ok(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('campo-invalido');
      const box = el.closest('.pqr-form-group, .form-group') || el.parentElement;
      const s = box.querySelector('.campo-error');
      if (s) s.remove();
    });
  }

  // ── Submit del formulario ────────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();


    // Recoger datos del formulario
    const data = {
      tipo:        document.getElementById('pqr-tipo').value,
      nombre:      document.getElementById('pqr-nombre').value,
      email:       document.getElementById('pqr-email').value,
      telefono:    document.getElementById('pqr-telefono').value,
      asunto:      document.getElementById('pqr-asunto').value,
      descripcion: document.getElementById('pqr-descripcion').value
    };

    // ── Validación DOM ────────────────────────────────────────────────────
    const RX_NOMBRE   = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
    const RX_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const RX_TELEFONO = /^[\d\s\+\-\(\)]{7,20}$/;
    _ok('pqr-tipo','pqr-nombre','pqr-email','pqr-telefono','pqr-asunto','pqr-descripcion');
    let valido = true;

    if (!data.tipo) {
      _err('pqr-tipo', 'Selecciona el tipo de solicitud.');                            valido = false;
    }
    if (!data.nombre || data.nombre.trim().length < 2) {
      _err('pqr-nombre', 'Tu nombre debe tener al menos 2 caracteres.');               valido = false;
    } else if (!RX_NOMBRE.test(data.nombre.trim())) {
      _err('pqr-nombre', 'El nombre solo puede contener letras y espacios. Sin números.'); valido = false;
    } else if (data.nombre.trim().length > 100) {
      _err('pqr-nombre', 'El nombre no puede superar 100 caracteres.');                valido = false;
    }
    if (!data.email || !RX_EMAIL.test(data.email)) {
      _err('pqr-email', 'Ingresa un correo electrónico válido (ej: usuario@correo.com).'); valido = false;
    }
    if (data.telefono && !RX_TELEFONO.test(data.telefono)) {
      _err('pqr-telefono', 'Teléfono inválido. Usa solo dígitos, +, -, () y espacios (mín. 7 dígitos).'); valido = false;
    }
    if (!data.asunto || data.asunto.trim().length < 5) {
      _err('pqr-asunto', 'El asunto debe tener al menos 5 caracteres.');               valido = false;
    } else if (data.asunto.trim().length > 200) {
      _err('pqr-asunto', 'El asunto no puede superar 200 caracteres.');                valido = false;
    }
    if (!data.descripcion || data.descripcion.trim().length < 10) {
      _err('pqr-descripcion', 'La descripción debe tener al menos 10 caracteres.');   valido = false;
    } else if (data.descripcion.trim().length > 2000) {
      _err('pqr-descripcion', 'La descripción no puede superar 2000 caracteres.');    valido = false;
    }
    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    // Llamar al modelo
    const resultado = PQRModel.crear(data);

    if (!resultado.ok) {
      mostrarError(resultado.error);
      return;
    }

    // Éxito: notificación alertify + mostrar sección de éxito
    showAlertSuccess('¡Tu solicitud fue enviada exitosamente! Te contactaremos pronto.');
    form.style.display = 'none';
    successBox.classList.add('visible');
    successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ── Botón "Enviar otra solicitud" ────────────────────────────────────────
  btnNueva.addEventListener('click', () => {
    form.reset();
    form.style.display = '';
    successBox.classList.remove('visible');

    // Scroll al inicio del formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Helper: mostrar error (usado por el modelo) ──────────────────────────
  function mostrarError(mensaje) {
    showAlertError(mensaje);
  }

});
