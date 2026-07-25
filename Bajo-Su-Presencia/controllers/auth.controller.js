/**
 * ============================================================
 * AUTH CONTROLLER — Login vía backend PHP (+ sesión Supabase)
 * ============================================================
 * Flujo:
 *   1. POST {API_BASE}/api/auth/login  → el backend valida contra Supabase
 *      Auth, aplica el bloqueo por fuerza bruta y emite un JWT propio (5 min).
 *   2. Se guarda el JWT propio (para endpoints PHP protegidos) y se fija la
 *      sesión de Supabase con sb.auth.setSession() para que el RESTO de la app
 *      siga funcionando bajo RLS.
 *   3. Se guarda { nombre, rol } en localStorage (lo usa el sidebar).
 *   4. Se redirige al panel según el rol.
 * ============================================================
 */

const RUTAS_POR_ROL = {
  'Administrador': '../../dashboard/admin/dashboard.html',
  'Colaborador':   '../../dashboard/colaborador/eventos.html',
  'Voluntario':    '../../dashboard/voluntario/calificaciones.html'
};

/**
 * Cerrojo de envío en curso.
 *
 * Sin él, cada clic dispara una petición independiente: medido, 5 clics
 * rápidos generaban 5 inicios de sesión simultáneos en menos de un
 * milisegundo. Eso tenía dos consecuencias reales:
 *
 *   1. Cinco respuestas concurrentes escribiendo token, sesión de Supabase,
 *      `usuarioLogueado` y redirección. El orden de llegada no está
 *      garantizado, así que la identidad final la decidía la última respuesta
 *      en llegar: es la vía por la que dos usuarios podían mezclarse.
 *   2. Con la contraseña equivocada, cada clic consumía un intento del
 *      contador de fuerza bruta (3 = bloqueo de 15 minutos), de modo que un
 *      doble clic bloqueaba la cuenta en la mitad de intentos reales.
 *
 * @type {boolean}
 */
let enviandoLogin = false;

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  // Un solo inicio de sesión en vuelo a la vez.
  if (enviandoLogin) return;

  const boton = this.querySelector('button[type="submit"]');
  enviandoLogin = true;
  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }

  /** Libera el cerrojo. No se llama si la autenticación tuvo éxito: en ese
   *  caso la página se abandona y reactivar el botón solo permitiría un
   *  segundo envío durante la redirección. */
  const liberar = () => {
    enviandoLogin = false;
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
  };

  const userVal  = document.getElementById('username').value.trim();
  const emailVal = document.getElementById('email').value.trim();
  const pass     = document.getElementById('password').value.trim();

  if (!window.API_BASE) {
    showAlertError('Configuración del servidor ausente. Recarga la página e intenta de nuevo.');
    liberar();
    return;
  }
  if (!userVal || !emailVal || !pass) {
    showAlertError('Ingresa tu usuario, correo y contraseña.');
    liberar();
    return;
  }

  // ── 1. Autenticar contra el backend PHP (usuario + correo + contraseña) ──
  let res, body;
  try {
    res = await fetch(`${window.API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: userVal, correo: emailVal, contrasena: pass })
    });
    body = await res.json();
  } catch (err) {
    showAlertError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    liberar();
    return;
  }

  // El backend responde {status, data, message}. Muestra su mensaje (incluye
  // "credenciales incorrectas" y el aviso de bloqueo por fuerza bruta).
  if (!res.ok || body.status !== 'success') {
    showAlertError(body?.message || 'Usuario o contraseña incorrectos.');
    liberar();
    return;
  }

  const { token, user, supabase } = body.data;

  // ── 2a. Guardar el JWT propio (para llamar endpoints PHP protegidos) ─────
  try {
    if (window.bspAuth && token?.access_token) {
      window.bspAuth.setToken(token.access_token);
      if (supabase?.refresh_token) localStorage.setItem('bspRefresh', supabase.refresh_token);
    }
  } catch (e) { console.warn('[login] no se pudo guardar el token', e); }

  // ── 2b. Fijar la sesión de Supabase (NO bloquea el login: tope 1.5 s) ────
  if (typeof sb !== 'undefined' && supabase?.access_token && supabase?.refresh_token) {
    try {
      await Promise.race([
        sb.auth.setSession({
          access_token:  supabase.access_token,
          refresh_token: supabase.refresh_token
        }),
        new Promise((r) => setTimeout(r, 1500)) // si se cuelga, seguimos igual
      ]);
    } catch (_) { /* sesión complementaria; no aborta el login */ }
  }

  // ── 3. Guardar datos para el sidebar ────────────────────────────────────
  const rol = user?.rol || 'Usuario';
  localStorage.setItem('usuarioLogueado', JSON.stringify({ nombre: user?.nombre, rol }));

  // ── 4. Redirigir según el rol ───────────────────────────────────────────
  const url = RUTAS_POR_ROL[rol];
  if (!url) {
    showAlertError('Este rol no tiene acceso al panel web.');
    liberar();
    return;
  }
  window.location.href = url;
});
