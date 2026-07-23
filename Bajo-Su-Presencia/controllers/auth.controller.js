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

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const userVal  = document.getElementById('username').value.trim();
  const emailVal = document.getElementById('email').value.trim();
  const pass     = document.getElementById('password').value.trim();

  if (!window.API_BASE) {
    showAlertError('Configuración del servidor ausente. Recarga la página e intenta de nuevo.');
    return;
  }
  if (!userVal || !emailVal || !pass) {
    showAlertError('Ingresa tu usuario, correo y contraseña.');
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
    return;
  }

  // El backend responde {status, data, message}. Muestra su mensaje (incluye
  // "credenciales incorrectas" y el aviso de bloqueo por fuerza bruta).
  if (!res.ok || body.status !== 'success') {
    showAlertError(body?.message || 'Usuario o contraseña incorrectos.');
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
    return;
  }
  window.location.href = url;
});
