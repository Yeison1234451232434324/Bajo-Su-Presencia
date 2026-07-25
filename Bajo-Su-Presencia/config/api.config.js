/**
 * ============================================================
 * CONFIGURACIÓN DE LA API (backend PHP)
 * ============================================================
 * URL base del backend PHP que expone /api/auth/login, /refresh, /me.
 * Cámbiala por la URL de producción cuando despliegues el backend.
 * ============================================================
 */
window.API_BASE = 'http://127.0.0.1:8000';

/**
 * ============================================================
 * REGISTRO DE ERRORES SEGURO
 * ============================================================
 * Problema que resuelve:
 *  1. Los modelos hacían `console.error('Modelo.getAll:', error)` volcando el
 *     objeto de error crudo de PostgREST, que revela nombres de tablas,
 *     columnas y restricciones a cualquiera que abra las herramientas de
 *     desarrollo. Es divulgación de información sobre el esquema.
 *  2. Después devolvían `[]`, de modo que un fallo del backend se veía en
 *     pantalla EXACTAMENTE igual que "no hay registros": el error era
 *     invisible para el usuario y para quien diera soporte.
 *
 * Solución: en desarrollo (localhost) se registra el detalle completo para
 * poder depurar; fuera de localhost solo se registra un mensaje genérico.
 * En ambos casos se avisa al usuario UNA vez, para que un fallo nunca se
 * confunda con una lista vacía.
 */
window.BSPLog = (function () {
  'use strict';

  const ES_DESARROLLO = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const yaAvisado = new Set();

  /**
   * Registra un fallo de carga de datos y avisa al usuario.
   * @param {string} origen Identificador del origen (p. ej. 'EventosModel.getAll').
   * @param {*}      error  Error capturado (no se muestra al usuario).
   */
  function error(origen, detalle) {
    if (ES_DESARROLLO) {
      console.error('[BSP]', origen, detalle);
    } else {
      // Sin detalles del esquema ni trazas en producción.
      console.error('[BSP] Fallo al cargar datos (' + origen + ').');
    }
    avisar(origen);
  }

  /** Muestra un aviso al usuario, una sola vez por origen. */
  function avisar(origen) {
    if (yaAvisado.has(origen)) return;
    yaAvisado.add(origen);
    const mensaje = 'No se pudieron cargar algunos datos. Revisa tu conexión e inténtalo de nuevo.';
    try {
      if (window.alertify?.error) { window.alertify.error(mensaje); return; }
    } catch (_) { /* alertify no disponible */ }
    console.warn('[BSP]', mensaje);
  }

  return { error, esDesarrollo: ES_DESARROLLO };
})();

/**
 * Claves de sesión que la aplicación escribe en el navegador.
 * Centralizadas aquí para que el cierre de sesión no pueda olvidar ninguna:
 * cada vez que se agregue una clave nueva, debe registrarse en esta lista.
 */
window.BSP_SESSION_KEYS = Object.freeze([
  'bspToken',          // JWT propio (5 min)
  'bspRefresh',        // refresh token de Supabase
  'usuarioLogueado',   // nombre y rol mostrados en el panel
]);

/** Helpers de almacenamiento del token propio de la app (JWT de 5 min). */
window.bspAuth = {
  setToken(token) { localStorage.setItem('bspToken', token); },
  getToken()      { return localStorage.getItem('bspToken'); },
  getRefresh()    { return localStorage.getItem('bspRefresh'); },
  clear()         { localStorage.removeItem('bspToken'); localStorage.removeItem('bspRefresh'); },

  /**
   * Cierre de sesión COMPLETO. Elimina todo rastro de la sesión para que un
   * token viejo no pueda reutilizarse (ni volviendo con el botón "atrás").
   *
   * Orden de operaciones:
   *  1. Cierra la sesión en Supabase (invalida el refresh token en el servidor).
   *  2. Borra las claves conocidas de localStorage.
   *  3. Borra las claves residuales de Supabase (`sb-*`) y todo sessionStorage.
   *  4. Elimina las cookies accesibles por JavaScript.
   *  5. Redirige con `location.replace` para no dejar el panel en el historial.
   *
   * @param {string} [redirectTo] Ruta del login a la que volver.
   * @returns {Promise<void>}
   */
  async logout(redirectTo = '../../public/login/login.html') {
    // 1. Invalida la sesión en el servidor de Supabase (best-effort).
    try {
      if (window.sb?.auth?.signOut) await window.sb.auth.signOut();
    } catch (_) { /* si falla, igual se limpia el cliente */ }

    // 2 y 3. Limpieza de almacenamiento local.
    try {
      window.BSP_SESSION_KEYS.forEach(k => localStorage.removeItem(k));
      // Claves que el SDK de Supabase crea con prefijo sb-<proyecto>-auth-token
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.startsWith('bsp'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) { /* almacenamiento no disponible */ }

    // 4. Cookies visibles para JS (las HttpOnly las retira el servidor).
    try {
      document.cookie.split(';').forEach((c) => {
        const nombre = c.split('=')[0].trim();
        if (!nombre) return;
        document.cookie =
          `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
      });
    } catch (_) { /* sin cookies */ }

    // 5. Sustituye la entrada del historial: "atrás" no vuelve al panel.
    window.location.replace(redirectTo);
  },
};

/**
 * Conecta el enlace "Cerrar sesión" (#nav-logout) con el cierre real de sesión.
 * Se invoca desde los controladores de sidebar después de pintar el menú.
 *
 * Sin esto, el enlace solo navegaba al login dejando el JWT y el refresh token
 * vivos en localStorage (la sesión seguía utilizable).
 *
 * @param {string} [redirectTo] Ruta del login.
 */
window.bspBindLogout = function (redirectTo) {
  const enlace = document.getElementById('nav-logout');
  if (!enlace || enlace.dataset.bspLogoutBound === '1') return;
  enlace.dataset.bspLogoutBound = '1';
  enlace.addEventListener('click', (evento) => {
    evento.preventDefault();
    window.bspAuth.logout(redirectTo || enlace.getAttribute('href'));
  });
};

/**
 * Renueva el JWT propio usando el refresh token de Supabase guardado en login.
 * @returns {Promise<boolean>} true si se renovó correctamente.
 */
window.bspRefreshToken = async function () {
  const refresh = window.bspAuth.getRefresh();
  if (!refresh) return false;
  try {
    const r = await fetch(`${window.API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });
    const b = await r.json();
    if (r.ok && b.status === 'success' && b.data?.token?.access_token) {
      window.bspAuth.setToken(b.data.token.access_token);
      if (b.data.supabase?.refresh_token) localStorage.setItem('bspRefresh', b.data.supabase.refresh_token);
      return true;
    }
  } catch (_) { /* ignorar */ }
  return false;
};

/**
 * Llama al backend PHP adjuntando el JWT (Authorization: Bearer). Si el token
 * expiró (401), intenta renovarlo una vez y reintenta. Devuelve el objeto
 * estándar { status, data, message } o lanza un Error con el mensaje del backend.
 *
 * @param {string} path   Ruta relativa (p. ej. '/api/usuarios').
 * @param {object} [opts] Opciones: { method, body, auth }.
 * @returns {Promise<any>} El campo `data` de la respuesta.
 */
window.apiFetch = async function (path, opts = {}) {
  const { method = 'GET', body = null, auth = true } = opts;

  const doFetch = () => fetch(`${window.API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && window.bspAuth.getToken()
        ? { Authorization: `Bearer ${window.bspAuth.getToken()}` } : {})
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {})
  });

  let res  = await doFetch();
  // Token expirado (5 min): intenta refrescar una vez y reintenta.
  if (res.status === 401 && auth && await window.bspRefreshToken()) {
    res = await doFetch();
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== 'success') {
    throw new Error(json?.message || 'Error en la solicitud.');
  }
  return json.data;
};
