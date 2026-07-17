/**
 * ============================================================
 * CONFIGURACIÓN DE LA API (backend PHP)
 * ============================================================
 * URL base del backend PHP que expone /api/auth/login, /refresh, /me.
 * Cámbiala por la URL de producción cuando despliegues el backend.
 * ============================================================
 */
window.API_BASE = 'http://localhost:8000';

/** Helpers de almacenamiento del token propio de la app (JWT de 5 min). */
window.bspAuth = {
  setToken(token) { localStorage.setItem('bspToken', token); },
  getToken()      { return localStorage.getItem('bspToken'); },
  getRefresh()    { return localStorage.getItem('bspRefresh'); },
  clear()         { localStorage.removeItem('bspToken'); localStorage.removeItem('bspRefresh'); },
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
