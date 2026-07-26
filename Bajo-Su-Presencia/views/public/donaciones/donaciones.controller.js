/**
 * ============================================================
 * DONACIONES — controlador (maqueta)
 * ============================================================
 * Selección de monto/método + validación + envío al backend, que registra la
 * donación (pago SIMULADO) y envía el comprobante al correo indicado.
 * ============================================================
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return '$' + Number(n).toLocaleString('es-CO') + ' COP'; };

  var metodoSel = '';

  // ── Chips de monto ────────────────────────────────────────────────────────
  document.querySelectorAll('.don-monto-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.don-monto-chip').forEach(function (c) { c.classList.remove('activo'); });
      chip.classList.add('activo');
      $('don-monto').value = chip.dataset.monto;
      actualizarTextoBoton();
      limpiarError('monto');
    });
  });
  // Escribir un monto propio deselecciona los chips.
  $('don-monto').addEventListener('input', function () {
    document.querySelectorAll('.don-monto-chip').forEach(function (c) { c.classList.remove('activo'); });
    actualizarTextoBoton();
    limpiarError('monto');
  });

  // ── Métodos ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.don-metodo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.don-metodo').forEach(function (b) { b.classList.remove('activo'); });
      btn.classList.add('activo');
      metodoSel = btn.dataset.metodo;
      limpiarError('metodo');
    });
  });

  $('don-correo').addEventListener('input', function () { limpiarError('correo'); });

  function actualizarTextoBoton() {
    var m = parseInt($('don-monto').value, 10);
    $('don-btn-texto').textContent = (m && m >= 1000) ? 'Donar ' + fmt(m) : 'Donar';
  }

  function limpiarError(campo) {
    var el = $('don-error-' + campo);
    if (el) el.textContent = '';
    var inp = $('don-' + campo);
    if (inp) inp.classList.remove('error');
  }
  function mostrarError(campo, msg) {
    var el = $('don-error-' + campo);
    if (el) el.textContent = msg;
    var inp = $('don-' + campo);
    if (inp) inp.classList.add('error');
  }

  // ── Envío ─────────────────────────────────────────────────────────────────
  $('don-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    var monto  = parseInt($('don-monto').value, 10) || 0;
    var correo = $('don-correo').value.trim();
    var nombre = $('don-nombre').value.trim();

    // Validación en el cliente (el backend revalida)
    var ok = true;
    if (!monto || monto < 1000) { mostrarError('monto', 'Ingresa un monto de al menos $1.000.'); ok = false; }
    if (!metodoSel)             { mostrarError('metodo', 'Elige un método de pago.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { mostrarError('correo', 'Escribe un correo válido.'); ok = false; }
    if (!ok) return;

    var btn = $('don-btn');
    btn.disabled = true;
    $('don-btn-texto').textContent = 'Procesando…';

    try {
      var base = window.API_BASE || ('http://' + location.hostname + ':8000');
      var r = await fetch(base + '/api/donaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correo, nombre: nombre, metodo: metodoSel, monto: monto })
      });
      var b = await r.json();

      if (!r.ok || b.status !== 'success') {
        throw new Error(b && b.message ? b.message : 'No se pudo procesar la donación.');
      }

      // Éxito → mostrar comprobante en pantalla
      var d = b.data || {};
      $('don-resumen').innerHTML =
          fila('Referencia', d.referencia || '—')
        + fila('Monto', fmt(d.monto || monto))
        + fila('Método', d.metodo || metodoSel)
        + fila('Fecha', d.fecha || '');
      $('don-exito-msg').textContent = 'Enviamos el comprobante a ' + correo + '.';
      $('don-form-section').style.display = 'none';
      $('don-exito-section').style.display = 'block';
      window.scrollTo(0, 0);
    } catch (err) {
      mostrarError('correo', err.message || 'Ocurrió un error. Inténtalo de nuevo.');
      btn.disabled = false;
      actualizarTextoBoton();
    }
  });

  function fila(k, v) {
    return '<div class="fila"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  // ── "Hacer otra donación" ───────────────────────────────────────────────────
  $('don-otra').addEventListener('click', function () {
    $('don-form').reset();
    document.querySelectorAll('.don-monto-chip, .don-metodo').forEach(function (b) { b.classList.remove('activo'); });
    metodoSel = '';
    ['monto', 'metodo', 'correo'].forEach(limpiarError);
    actualizarTextoBoton();
    $('don-btn').disabled = false;
    $('don-exito-section').style.display = 'none';
    $('don-form-section').style.display = 'block';
  });
})();
