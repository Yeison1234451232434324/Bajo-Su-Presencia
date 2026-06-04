/**
 * ================================================================
 *  BSP VALIDATORS — Módulo de validación y sanitización compartido
 * ================================================================
 *  Expone el objeto global window.BSPVal con:
 *    · Helpers de DOM (_err / _ok) con aria-invalid incluido
 *    · Funciones de validación por tipo de campo
 *    · Sanitización básica anti-XSS
 *    · Bloqueo de teclas peligrosas en inputs numéricos
 *    · Wrapper try-catch para llamadas a modelos
 *
 *  Cómo se usa:
 *    Cargarlo ANTES de cualquier controlador que valide formularios:
 *    <script src="../../../controllers/validators.helper.js"></script>
 * ================================================================
 */
(function (global) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     1. SANITIZACIÓN — prevención XSS básica
        Escapa caracteres HTML peligrosos antes de insertar
        cualquier dato de usuario en el DOM con innerHTML.
  ══════════════════════════════════════════════════════════════ */
  const HTML_ESCAPE_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
  };

  /**
   * Escapa caracteres HTML peligrosos en un string.
   * Úsalo antes de insertar datos de usuario en innerHTML.
   */
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`/]/g, c => HTML_ESCAPE_MAP[c]);
  }

  /**
   * Limpia un string de espacios, tabs y saltos de línea extremos.
   * También colapsa espacios internos múltiples.
   */
  function cleanText(str) {
    return (str || '').replace(/\s+/g, ' ').trim();
  }

  /* ══════════════════════════════════════════════════════════════
     2. DOM HELPERS — feedback visual + accesibilidad ARIA
  ══════════════════════════════════════════════════════════════ */

  /**
   * Marca un campo como inválido:
   *  · Añade clase 'campo-invalido' al input
   *  · Establece aria-invalid="true"
   *  · Muestra el mensaje de error bajo el campo
   *  · Asigna aria-describedby apuntando al span de error
   */
  function _err(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('campo-invalido');
    el.setAttribute('aria-invalid', 'true');

    const box = el.closest(
      '.form-group, .sed-field, .pqr-form-group, .act-form-group, .or-form-group'
    ) || el.parentElement;

    const errorId = `${id}-error`;
    let s = box.querySelector('.campo-error');
    if (!s) {
      s = document.createElement('span');
      s.className = 'campo-error';
      s.setAttribute('role', 'alert');
      s.id = errorId;
      box.appendChild(s);
    }
    s.id = errorId;
    s.textContent = msg;
    el.setAttribute('aria-describedby', errorId);
  }

  /**
   * Limpia el estado de error de uno o varios campos:
   *  · Quita clase 'campo-invalido'
   *  · Establece aria-invalid="false"
   *  · Elimina el span de mensaje de error
   */
  function _ok(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('campo-invalido');
      el.setAttribute('aria-invalid', 'false');
      const box = el.closest(
        '.form-group, .sed-field, .pqr-form-group, .act-form-group, .or-form-group'
      ) || el.parentElement;
      const s = box.querySelector('.campo-error');
      if (s) s.remove();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     3. VALIDATORS POR TIPO DE CAMPO
        Todas las funciones retornan:
          · null  → sin error (valor válido)
          · string → mensaje de error legible para el usuario
  ══════════════════════════════════════════════════════════════ */

  /* ── 3a. Texto libre ──────────────────────────────────────────
     Aplica: títulos, nombres, descripciones, asuntos, comentarios.
  ────────────────────────────────────────────────────────────── */
  function txt(val, {
    min    = 1,
    max    = 500,
    label  = 'El campo',
    regex  = null,         // regex adicional a comprobar
    regexMsg = null,       // mensaje si regex falla
    iniciaLetra = false    // obliga a comenzar con letra
  } = {}) {
    const v = cleanText(val);
    if (!v) return `${label} es obligatorio.`;
    if (v.length < min) return `${label} debe tener al menos ${min} carácter${min !== 1 ? 'es' : ''}.`;
    if (v.length > max) return `${label} no puede superar ${max} caracteres.`;
    if (iniciaLetra && !/^[a-zA-ZÀ-ÿñÑ]/.test(v))
      return `${label} debe comenzar con una letra, no con un número o símbolo.`;
    if (regex && !regex.test(v))
      return regexMsg || `${label} contiene caracteres no permitidos.`;
    return null;
  }

  /* ── 3b. Solo letras (nombres de personas, ciudades, pastores) ─ */
  const RX_SOLO_LETRAS = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
  function soloLetras(val, { label = 'El campo' } = {}) {
    const v = cleanText(val);
    if (!v) return null; // obligatoriedad se valida con txt()
    if (!RX_SOLO_LETRAS.test(v))
      return `${label} solo puede contener letras, espacios, apóstrofes o guiones. Sin números.`;
    return null;
  }

  /* ── 3c. Email ────────────────────────────────────────────────
     Regex estricta:
       · Solo alfanuméricos + ._%+- antes del @
       · Dominio real (letras, números, guiones)
       · TLD de al menos 2 caracteres
     Rechaza: a@b.c, test@.com, @domain.com, doble punto, etc.
  ────────────────────────────────────────────────────────────── */
  const RX_EMAIL = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,}$/;
  function email(val) {
    const v = (val || '').trim().toLowerCase();
    if (!v) return 'El correo electrónico es obligatorio.';
    if (v.length > 254) return 'El correo no puede superar 254 caracteres.';
    if (v.includes('..')) return 'El correo no puede contener puntos consecutivos.';
    if (!RX_EMAIL.test(v)) return 'Ingresa un correo válido (ej: usuario@correo.com).';
    return null;
  }

  /* ── 3d. URL ──────────────────────────────────────────────────
     Requiere protocolo + dominio + al menos 4 chars después del ://
     Rechaza: https:// solo, sin dominio, con espacios, etc.
  ────────────────────────────────────────────────────────────── */
  const RX_URL = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]{3,}$/;
  function url(val, { required = false, label = 'La URL' } = {}) {
    const v = (val || '').trim();
    if (!v) return required ? `${label} es obligatoria.` : null;
    if (!RX_URL.test(v)) return `${label} debe ser válida y comenzar con https:// o http:// (ej: https://ejemplo.com/img.jpg).`;
    if (v.length > 2048) return `${label} no puede superar 2048 caracteres.`;
    return null;
  }

  /* ── 3e. Número ───────────────────────────────────────────────
     Valida enteros o decimales dentro de un rango.
     Bloquea: NaN, negativos (si min=0), decimales (si entero=true)
  ────────────────────────────────────────────────────────────── */
  function num(val, {
    min    = 0,
    max    = Infinity,
    entero = true,
    label  = 'El valor'
  } = {}) {
    const raw = String(val ?? '').trim();
    if (raw === '') return `${label} es obligatorio.`;
    /* Bloquea notación científica (1e5) y signos (parseFloat los acepta) */
    if (/[eE+]/.test(raw)) return `${label} no puede contener exponentes ni signos.`;
    const n = entero ? parseInt(raw, 10) : parseFloat(raw);
    if (isNaN(n)) return `${label} debe ser un número válido.`;
    if (entero && !Number.isInteger(n)) return `${label} debe ser un número entero sin decimales.`;
    if (n < min) return `${label} no puede ser menor que ${min}.`;
    if (n > max) return `${label} no puede ser mayor que ${max.toLocaleString()}.`;
    return null;
  }

  /* ── 3f. Teléfono ─────────────────────────────────────────────
     Acepta: dígitos, espacios, +, -, () — entre 7 y 20 chars.
     Valida que haya al menos 7 dígitos reales.
  ────────────────────────────────────────────────────────────── */
  const RX_TEL = /^[\d\s\+\-\(\)]{7,20}$/;
  function tel(val, { required = false } = {}) {
    const v = (val || '').trim();
    if (!v) return required ? 'El teléfono es obligatorio.' : null;
    if (!RX_TEL.test(v)) return 'Teléfono inválido. Usa solo dígitos, +, -, () y espacios (entre 7 y 20 caracteres).';
    const soloDigitos = v.replace(/\D/g, '');
    if (soloDigitos.length < 7) return 'El teléfono debe tener al menos 7 dígitos.';
    return null;
  }

  /* ── 3g. Fecha (YYYY-MM-DD) ───────────────────────────────────
     Valida formato, coherencia del calendario y rango permitido.
  ────────────────────────────────────────────────────────────── */
  function fecha(val, {
    minDate = null,   // 'YYYY-MM-DD' — fecha mínima permitida
    maxDate = null,   // 'YYYY-MM-DD' — fecha máxima permitida
    label   = 'La fecha'
  } = {}) {
    if (!val) return `${label} es obligatoria.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${label} tiene un formato inválido.`;
    const d = new Date(`${val}T00:00:00`);
    if (isNaN(d.getTime())) return `${label} no corresponde a una fecha real del calendario.`;
    if (minDate && val < minDate) return `${label} no puede ser anterior a ${minDate}.`;
    if (maxDate && val > maxDate) return `${label} no puede ser posterior a ${maxDate}.`;
    return null;
  }

  /* ── 3h. Selector / Dropdown ──────────────────────────────────
     Valida que el valor no sea el placeholder Y que esté en la
     lista blanca de valores permitidos (previene manipulación DOM).
  ────────────────────────────────────────────────────────────── */
  function select(val, allowed = null, { label = 'Este campo' } = {}) {
    if (!val || val.trim() === '') return `${label}: debes seleccionar una opción válida.`;
    if (allowed !== null && !allowed.includes(val))
      return `${label}: valor no reconocido. Por favor recarga la página.`;
    return null;
  }

  /* ── 3i. Contraseña ───────────────────────────────────────────
     Mínimo 6 chars, al menos 1 letra y 1 dígito, sin espacios.
  ────────────────────────────────────────────────────────────── */
  function password(val, { min = 6 } = {}) {
    if (!val || !val.length) return 'La contraseña es obligatoria.';
    if (val.length < min) return `La contraseña debe tener al menos ${min} caracteres.`;
    if (/\s/.test(val)) return 'La contraseña no puede contener espacios.';
    if (!/[a-zA-Z]/.test(val)) return 'La contraseña debe incluir al menos una letra.';
    if (!/[0-9]/.test(val)) return 'La contraseña debe incluir al menos un número.';
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
     4. BLOQUEO DE TECLAS EN INPUTS NUMÉRICOS
        Previene que el usuario escriba 'e', 'E', '+', '-' en un
        <input type="number">, que son aceptados por el browser
        como notación científica y signos pero inválidos en nuestro
        contexto (cantidades, miembros, asistentes, voluntarios).
  ══════════════════════════════════════════════════════════════ */
  const BLOCKED_KEYS = new Set(['e', 'E', '+', '-', '.']);

  /**
   * Llama esta función pasando el elemento input numérico.
   * También corrige el valor en blur si quedó fuera del rango.
   *
   * @param {HTMLInputElement} el
   * @param {object} [opts] — { allowDecimal: false } si el campo acepta decimales
   */
  function blockNumericChars(el, { allowDecimal = false } = {}) {
    if (!el) return;
    const blockedSet = allowDecimal
      ? new Set(['e', 'E', '+', '-'])
      : BLOCKED_KEYS; // bloquea '.' también para enteros

    el.addEventListener('keydown', e => {
      if (blockedSet.has(e.key)) e.preventDefault();
    });

    el.addEventListener('paste', e => {
      const pasted = (e.clipboardData || global.clipboardData).getData('text');
      if (/[eE+\-]/.test(pasted) || (!allowDecimal && pasted.includes('.'))) {
        e.preventDefault();
      }
    });

    el.addEventListener('blur', () => {
      const raw = el.value;
      if (raw === '' || raw === null) return;
      const n = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
      if (isNaN(n)) { el.value = el.min || '0'; return; }
      const minVal = el.min !== '' ? parseFloat(el.min) : -Infinity;
      const maxVal = el.max !== '' ? parseFloat(el.max) : Infinity;
      if (n < minVal) el.value = el.min;
      if (n > maxVal) el.value = el.max;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     5. WRAPPER TRY-CATCH PARA LLAMADAS A MODELOS
        Envuelve la llamada al modelo en try-catch.
        Si localStorage falla (modo privado lleno, error de cuota),
        muestra un error amigable en lugar de romper la app.
  ══════════════════════════════════════════════════════════════ */

  /**
   * @param {Function} fn — función que llama al modelo
   * @param {Function} [onError] — callback opcional con el error capturado
   * @returns {object} — resultado del modelo o { ok: false, error: '...' }
   */
  function safeCall(fn, onError) {
    try {
      return fn();
    } catch (err) {
      console.error('[BSP Validators] Error en llamada al modelo:', err);
      const msg = err.name === 'QuotaExceededError'
        ? 'El almacenamiento local está lleno. Por favor elimina datos antiguos e intenta de nuevo.'
        : 'Ocurrió un error inesperado al guardar los datos. Recarga la página e intenta de nuevo.';
      if (typeof onError === 'function') {
        onError(msg, err);
      } else if (typeof showAlertError === 'function') {
        showAlertError(msg);
      }
      return { ok: false, error: msg };
    }
  }

  /* ══════════════════════════════════════════════════════════════
     6. EXPORTAR AL SCOPE GLOBAL
  ══════════════════════════════════════════════════════════════ */
  global.BSPVal = {
    /* DOM */
    _err, _ok,
    /* Sanitización */
    sanitize, cleanText,
    /* Validators */
    txt, soloLetras, email, url, num, tel, fecha, select, password,
    /* Numérico */
    blockNumericChars,
    /* Try-catch */
    safeCall
  };

})(window);
