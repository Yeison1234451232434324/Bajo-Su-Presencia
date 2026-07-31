/**
 * ============================================================
 * DONACIONES — página única (maqueta)
 * ============================================================
 * Todo visible: datos, monto, propósito, resumen en vivo y método.
 * Al elegir el método de pago se valida, se muestra el loader y se
 * envía al backend (pago SIMULADO) que dispara el comprobante por
 * correo. Luego: confeti + pantalla de éxito.
 * ============================================================
 */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return '$' + Number(n).toLocaleString('es-CO') + ' COP'; };

  var estado = { nombre: '', correo: '', anonimo: false, monto: 0, proposito: '', metodo: '' };

  // Botón "Donar" del hero → baja al formulario (evita que el <base href> del
  // front-controller convierta el #dn-card en una navegación a un 404).
  var donarBtn = $('.dn-scroll-donar');
  if (donarBtn) donarBtn.addEventListener('click', function (e) {
    e.preventDefault();
    $('#dn-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Errores ──────────────────────────────────────────────────────────────
  function limpiarError(k) { var e = $('#dn-err-' + k); if (e) e.textContent = ''; var i = $('#dn-' + k); if (i) i.classList.remove('error'); }
  function mostrarError(k, msg) {
    var e = $('#dn-err-' + k); if (e) e.textContent = msg;
    var i = $('#dn-' + k); if (i) { i.classList.add('error'); i.focus(); }
    var host = e || i; if (host) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Paso 1: datos ────────────────────────────────────────────────────────
  var nombreEl = $('#dn-nombre');
  if (nombreEl) nombreEl.addEventListener('input', function () { estado.nombre = this.value.trim(); pintarResumen(); });
  var correoEl = $('#dn-correo');
  if (correoEl) correoEl.addEventListener('input', function () { estado.correo = this.value.trim(); limpiarError('correo'); pintarResumen(); });
  // La donación anónima es opcional en el marcado; si no existe, se omite.
  var anonEl = $('#dn-anon');
  if (anonEl) anonEl.addEventListener('change', function () { estado.anonimo = this.checked; pintarResumen(); });

  // ── Paso 2: montos ───────────────────────────────────────────────────────
  var otroField = $('#dn-otro-field');
  var otroInput = $('#dn-otro');
  $$('.dn-monto').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-monto').forEach(function (x) { x.classList.remove('is-sel'); });
      otroField.classList.remove('is-sel'); otroInput.value = '';
      b.classList.add('is-sel');
      estado.monto = parseInt(b.dataset.monto, 10);
      limpiarError('monto'); pintarResumen();
    });
  });
  otroInput.addEventListener('input', function () {
    var n = (otroInput.value || '').replace(/\D/g, '');
    otroInput.value = n ? Number(n).toLocaleString('es-CO') : '';
    $$('.dn-monto').forEach(function (x) { x.classList.remove('is-sel'); });
    otroField.classList.toggle('is-sel', !!n);
    estado.monto = parseInt(n, 10) || 0;
    limpiarError('monto'); pintarResumen();
  });

  // ── Paso 3: propósito ────────────────────────────────────────────────────
  $$('.dn-prop').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-prop').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      estado.proposito = b.dataset.prop;
      limpiarError('prop'); pintarResumen();
    });
  });

  // ── Resumen en vivo ──────────────────────────────────────────────────────
  function pintarResumen() {
    $('#dn-r-monto').textContent   = estado.monto ? fmt(estado.monto) : '—';
    $('#dn-r-prop').textContent    = estado.proposito || '—';
    $('#dn-r-donante').textContent = estado.anonimo ? 'Anónimo' : (estado.nombre || '—');
    $('#dn-r-correo').textContent  = estado.correo || '—';
    $('#dn-r-total').textContent   = estado.monto ? fmt(estado.monto) : '—';
  }

  // ── Paso 5: método → dispara el pago ─────────────────────────────────────
  $$('.dn-metodo').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-metodo').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      estado.metodo = b.dataset.metodo;
      limpiarError('metodo');
      enviar();
    });
  });

  // ── Validación previa al envío ───────────────────────────────────────────
  function validar() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(estado.correo)) { mostrarError('correo', 'Escribe un correo válido para enviarte el comprobante.'); return false; }
    if (!estado.monto || estado.monto < 1000) { mostrarError('monto', 'Elige o escribe un monto de al menos $1.000.'); return false; }
    if (!estado.proposito) { mostrarError('prop', 'Elige el propósito de tu donación.'); return false; }
    if (!estado.metodo) { mostrarError('metodo', 'Selecciona un método de pago.'); return false; }
    return true;
  }

  // ── Envío ────────────────────────────────────────────────────────────────
  async function enviar() {
    if (!validar()) return;
    $('#dn-loader').hidden = false;
    try {
      var base = window.API_BASE || ('http://' + location.hostname + ':8000');
      var r = await fetch(base + '/api/donaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: estado.correo,
          nombre: estado.anonimo ? '' : estado.nombre,
          metodo: estado.metodo, monto: estado.monto, proposito: estado.proposito
        })
      });
      var b = await r.json();
      await new Promise(function (res) { setTimeout(res, 700); });
      $('#dn-loader').hidden = true;
      if (!r.ok || b.status !== 'success') throw new Error((b && b.message) || 'No se pudo procesar la donación.');

      var d = b.data || {};
      $('#dn-success-resumen').innerHTML =
          fila('Referencia', d.referencia || '—')
        + fila('Propósito', estado.proposito)
        + fila('Monto', fmt(d.monto || estado.monto))
        + fila('Método', d.metodo || estado.metodo);
      $('#dn-success-msg').textContent = 'Enviamos el comprobante a ' + estado.correo + '.';
      $('#dn-success').hidden = false;
      lanzarConfetti();
    } catch (err) {
      $('#dn-loader').hidden = true;
      mostrarError('metodo', err.message || 'Ocurrió un error. Inténtalo de nuevo.');
    }
  }
  function fila(k, v) { return '<div class="fila"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // ── Otra donación ────────────────────────────────────────────────────────
  $('#dn-otra').addEventListener('click', function () {
    $('#dn-success').hidden = true;
    $('#dn-card').reset();
    $$('.dn-monto, .dn-prop, .dn-metodo, .dn-otro').forEach(function (x) { x.classList.remove('is-sel'); });
    estado = { nombre: '', correo: '', anonimo: false, monto: 0, proposito: '', metodo: '' };
    ['correo', 'monto', 'prop', 'metodo'].forEach(limpiarError);
    pintarResumen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Confeti (canvas, sin librerías) ──────────────────────────────────────
  function lanzarConfetti() {
    var c = $('#dn-confetti'), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    var colores = ['#D4A64A', '#0F2D68', '#e8607a', '#23b26d', '#f6c65b'];
    var piezas = [];
    for (var i = 0; i < 140; i++) {
      piezas.push({
        x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        col: colores[i % colores.length], vy: 2 + Math.random() * 3.5,
        vx: -1.5 + Math.random() * 3, rot: Math.random() * 6, vr: -0.2 + Math.random() * 0.4
      });
    }
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, c.width, c.height);
      piezas.forEach(function (p) {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (now - t0 < 3800) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, c.width, c.height);
    })(t0);
  }
})();
