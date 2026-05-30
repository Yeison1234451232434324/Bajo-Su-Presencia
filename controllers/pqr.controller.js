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
  const errorMsg   = document.getElementById('pqr-error-msg');
  const successBox = document.getElementById('pqr-success');
  const btnNueva   = document.getElementById('pqr-btn-nueva');
  const btnSubmit  = document.getElementById('pqr-btn-submit');

  // ── Submit del formulario ────────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Ocultar error previo
    errorMsg.textContent = '';
    errorMsg.classList.remove('visible');

    // Recoger datos del formulario
    const data = {
      tipo:        document.getElementById('pqr-tipo').value,
      nombre:      document.getElementById('pqr-nombre').value,
      email:       document.getElementById('pqr-email').value,
      telefono:    document.getElementById('pqr-telefono').value,
      asunto:      document.getElementById('pqr-asunto').value,
      descripcion: document.getElementById('pqr-descripcion').value
    };

    // Validación del tipo
    if (!data.tipo) {
      mostrarError('Por favor selecciona el tipo de solicitud.');
      return;
    }

    // Llamar al modelo
    const resultado = PQRModel.crear(data);

    if (!resultado.ok) {
      mostrarError(resultado.error);
      return;
    }

    // Éxito: ocultar formulario y mostrar mensaje
    form.style.display       = 'none';
    successBox.classList.add('visible');

    // Scroll suave al mensaje de éxito
    successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ── Botón "Enviar otra solicitud" ────────────────────────────────────────
  btnNueva.addEventListener('click', () => {
    // Limpiar formulario
    form.reset();
    errorMsg.textContent = '';
    errorMsg.classList.remove('visible');

    // Mostrar formulario y ocultar éxito
    form.style.display = '';
    successBox.classList.remove('visible');

    // Scroll al inicio del formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Helper: mostrar error ────────────────────────────────────────────────
  function mostrarError(mensaje) {
    errorMsg.textContent = mensaje;
    errorMsg.classList.add('visible');
    errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

});
