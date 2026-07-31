/**
 * ============================================================
 * DONACIONES — wizard premium (maqueta)
 * ============================================================
 * 5 pasos guiados (datos → monto → propósito → resumen → método).
 * Valida por paso, muestra progreso, y al confirmar envía al backend
 * (pago SIMULADO) que dispara el comprobante por correo. Confeti + éxito.
 * ============================================================
 */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return '$' + Number(n).toLocaleString('es-CO') + ' COP'; };
  var TOTAL_PASOS = 5;

  var estado = { paso: 1, nombre: '', correo: '', anonimo: false, monto: 0, proposito: '', metodo: '' };

  // ── Navbar: sombra al hacer scroll ───────────────────────────────────────
  var nav = $('#dn-nav');
  window.addEventListener('scroll', function () {
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
  }, { passive: true });

  // Smooth scroll a los anclas de "Donar"
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ── Paso 1: switch anónimo + nota ────────────────────────────────────────
  var anon = $('#dn-anon');
  anon.addEventListener('change', function () {
    estado.anonimo = anon.checked;
    $('#dn-anon-note').hidden = !anon.checked;
  });
  $('#dn-correo').addEventListener('input', function () { limpiarError('correo'); });

  // ── Paso 2: montos ───────────────────────────────────────────────────────
  var otroWrap = $('#dn-otro-wrap');
  var otroInput = $('#dn-otro');
  $$('.dn-monto').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-monto').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      limpiarError('monto');
      if (b.id === 'dn-monto-otro') {
        otroWrap.hidden = false; otroInput.focus();
        estado.monto = parseInt((otroInput.value || '').replace(/\D/g, ''), 10) || 0;
      } else {
        otroWrap.hidden = true;
        estado.monto = parseInt(b.dataset.monto, 10);
      }
    });
  });
  otroInput.addEventListener('input', function () {
    var n = (otroInput.value || '').replace(/\D/g, '');
    otroInput.value = n ? Number(n).toLocaleString('es-CO') : '';
    estado.monto = parseInt(n, 10) || 0;
    limpiarError('monto');
  });

  // ── Paso 3: propósito ────────────────────────────────────────────────────
  $$('.dn-prop').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-prop').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      estado.proposito = b.dataset.prop;
      limpiarError('prop');
    });
  });

  // ── Paso 5: método ───────────────────────────────────────────────────────
  $$('.dn-metodo').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dn-metodo').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      estado.metodo = b.dataset.metodo;
      limpiarError('metodo');
    });
  });

  // ── Errores ──────────────────────────────────────────────────────────────
  function limpiarError(k) { var e = $('#dn-err-' + k); if (e) e.textContent = ''; var i = $('#dn-' + k); if (i) i.classList.remove('error'); }
  function mostrarError(k, msg) { var e = $('#dn-err-' + k); if (e) e.textContent = msg; var i = $('#dn-' + k); if (i) i.classList.add('error'); }

  // ── Validación por paso ──────────────────────────────────────────────────
  function validarPaso(p) {
    if (p === 1) {
      estado.nombre = $('#dn-nombre').value.trim();
      estado.correo = $('#dn-correo').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(estado.correo)) { mostrarError('correo', 'Escribe un correo válido para enviarte el comprobante.'); return false; }
      return true;
    }
    if (p === 2) {
      if (!estado.monto || estado.monto < 1000) { mostrarError('monto', 'Elige o escribe un monto de al menos $1.000.'); return false; }
      return true;
    }
    if (p === 3) {
      if (!estado.proposito) { mostrarError('prop', 'Elige el propósito de tu donación.'); return false; }
      return true;
    }
    if (p === 5) {
      if (!estado.metodo) { mostrarError('metodo', 'Selecciona un método de pago.'); return false; }
      return true;
    }
    return true;
  }

  // ── Navegación de pasos ──────────────────────────────────────────────────
  function irA(p) {
    estado.paso = p;
    $$('.dn-panel').forEach(function (pn) { pn.classList.toggle('is-active', +pn.dataset.panel === p); });
    // barra + dots
    $$('#dn-steps li').forEach(function (li) {
      var s = +li.dataset.step;
      li.classList.toggle('is-active', s === p);
      li.classList.toggle('is-done', s < p);
    });
    $('#dn-steps-fill').style.width = ((p - 1) / (TOTAL_PASOS - 1) * 100) + '%';
    // botones
    $('#dn-back').hidden = p === 1;
    $('#dn-next').hidden = p === TOTAL_PASOS;
    $('#dn-submit').hidden = p !== TOTAL_PASOS;
    if (p === 4) pintarResumen();
    // llevar la vista al inicio de la tarjeta
    $('#dn-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#dn-next').addEventListener('click', function (e) {
    ripple(e, this);
    if (!validarPaso(estado.paso)) return;
    if (estado.paso < TOTAL_PASOS) irA(estado.paso + 1);
  });
  $('#dn-back').addEventListener('click', function () { if (estado.paso > 1) irA(estado.paso - 1); });

  function pintarResumen() {
    $('#dn-r-nombre').textContent = estado.anonimo ? 'Anónimo' : (estado.nombre || 'Sin nombre');
    $('#dn-r-correo').textContent = estado.correo || '—';
    $('#dn-r-prop').textContent   = estado.proposito || '—';
    $('#dn-r-monto').textContent  = estado.monto ? fmt(estado.monto) : '—';
    $('#dn-r-total').textContent  = estado.monto ? fmt(estado.monto) : '—';
  }

  // ── Ripple ───────────────────────────────────────────────────────────────
  function ripple(e, btn) {
    var r = document.createElement('span'); r.className = 'dn-ripple';
    var rect = btn.getBoundingClientRect(); var d = Math.max(rect.width, rect.height);
    r.style.width = r.style.height = d + 'px';
    r.style.left = (e.clientX - rect.left - d / 2) + 'px';
    r.style.top  = (e.clientY - rect.top - d / 2) + 'px';
    btn.appendChild(r); setTimeout(function () { r.remove(); }, 600);
  }

  // ── Envío ────────────────────────────────────────────────────────────────
  $('#dn-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validarPaso(5)) return;

    $('#dn-loader').hidden = false;
    try {
      var base = window.API_BASE || ('http://' + location.hostname + ':8000');
      var r = await fetch(base + '/api/donaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: estado.correo,
          nombre: estado.anonimo ? '' : estado.nombre,
          metodo: estado.metodo,
          monto: estado.monto,
          proposito: estado.proposito
        })
      });
      var b = await r.json();
      // Pequeña espera para que el loader se sienta elegante
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
      irA(5);
      mostrarError('metodo', err.message || 'Ocurrió un error. Inténtalo de nuevo.');
    }
  });

  function fila(k, v) { return '<div class="fila"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // ── Otra donación ────────────────────────────────────────────────────────
  $('#dn-otra').addEventListener('click', function () {
    $('#dn-success').hidden = true;
    $('#dn-form').reset();
    $$('.dn-monto, .dn-prop, .dn-metodo').forEach(function (x) { x.classList.remove('is-sel'); });
    otroWrap.hidden = true; $('#dn-anon-note').hidden = true;
    estado = { paso: 1, nombre: '', correo: '', anonimo: false, monto: 0, proposito: '', metodo: '' };
    ['correo', 'monto', 'prop', 'metodo'].forEach(limpiarError);
    irA(1);
    $('#dn-wizard').scrollIntoView({ behavior: 'smooth' });
  });

  // ── Confeti (canvas, sin librerías) ──────────────────────────────────────
  function lanzarConfetti() {
    var c = $('#dn-confetti'), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    var colores = ['#D4A64A', '#0F2D68', '#e8607a', '#1a9e6a', '#f6c65b'];
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
        ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (now - t0 < 3800) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, c.width, c.height);
    })(t0);
  }
})();
