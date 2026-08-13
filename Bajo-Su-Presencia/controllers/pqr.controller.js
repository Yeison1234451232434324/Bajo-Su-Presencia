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

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  const TIPOS_PQR_VALIDOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];

  // Cerrojo anti-doble-submit (mismo patrón que auth.controller.js).
  let enviandoPQR = false;

  // ── Submit del formulario ────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviandoPQR) return;

    /* Leer y limpiar TODOS los valores antes de validar y antes de guardar */
    const tipo        = document.getElementById('pqr-tipo').value;
    const nombre      = BSPVal.cleanText(document.getElementById('pqr-nombre').value);
    const emailVal    = document.getElementById('pqr-email').value.trim().toLowerCase();
    const telefono    = document.getElementById('pqr-telefono').value.trim();
    const asunto      = BSPVal.cleanText(document.getElementById('pqr-asunto').value);
    const descripcion = BSPVal.cleanText(document.getElementById('pqr-descripcion').value);

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('pqr-tipo','pqr-nombre','pqr-email','pqr-telefono','pqr-asunto','pqr-descripcion');
    let valido = true;
    let err;

    /* Tipo: validado contra lista blanca — previene manipulación del DOM */
    err = BSPVal.select(tipo, TIPOS_PQR_VALIDOS, { label: 'El tipo de solicitud' });
    if (err) { _err('pqr-tipo', err); valido = false; }

    /* Nombre: solo letras, mínimo 2, máximo 100 */
    err = BSPVal.txt(nombre, { min: 2, max: 100, label: 'Tu nombre' });
    if (!err) err = BSPVal.soloLetras(nombre, { label: 'Tu nombre' });
    if (err) { _err('pqr-nombre', err); valido = false; }

    /* Email: regex estricta */
    err = BSPVal.email(emailVal);
    if (err) { _err('pqr-email', err); valido = false; }

    /* Teléfono: opcional */
    err = BSPVal.tel(telefono, { required: false });
    if (err) { _err('pqr-telefono', err); valido = false; }

    /* Asunto: mínimo 5, máximo 200 */
    err = BSPVal.txt(asunto, { min: 5, max: 200, label: 'El asunto' });
    if (err) { _err('pqr-asunto', err); valido = false; }

    /* Descripción: mínimo 10, máximo 2000 */
    err = BSPVal.txt(descripcion, { min: 10, max: 2000, label: 'La descripción' });
    if (err) { _err('pqr-descripcion', err); valido = false; }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Datos limpios — NUNCA usar .value directamente desde aquí */
    const data = { tipo, nombre, email: emailVal, telefono, asunto, descripcion };

    /* Llamada async al modelo (Supabase) */
    enviandoPQR = true;
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.setAttribute('aria-busy', 'true'); }

    let resultado;
    try {
      resultado = await PQRModel.crear(data);
    } catch (ex) {
      mostrarError('Error de conexión. Revisa tu internet e intenta de nuevo.');
      enviandoPQR = false;
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.removeAttribute('aria-busy'); }
      return;
    }
    if (!resultado.ok) {
      mostrarError(resultado.error);
      enviandoPQR = false;
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.removeAttribute('aria-busy'); }
      return;
    }

    // No reactivamos el botón tras éxito: el formulario queda oculto y se
    // reemplaza por la sección de éxito. Se reactivará solo si el usuario
    // pulsa "Enviar otra solicitud" (ver btnNueva más abajo).

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
    enviandoPQR = false;
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.removeAttribute('aria-busy'); }

    // Scroll al inicio del formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Helper: mostrar error (usado por el modelo) ──────────────────────────
  function mostrarError(mensaje) {
    showAlertError(mensaje);
  }

});
