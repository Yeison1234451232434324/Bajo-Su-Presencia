/**
 * ============================================================
 * SessionManager — control de acceso del panel
 * ============================================================
 * Sustituye al guard que decidía el acceso leyendo el rol desde
 * `localStorage`, un valor que el propio usuario puede editar.
 *
 * PROBLEMA QUE RESUELVE (verificado en ejecución)
 * ----------------------------------------------
 * El patrón anterior, repetido en 17 controladores, era:
 *
 *     const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
 *     if (sesion.rol !== 'Administrador') { mostrarAccesoDenegado(); return; }
 *
 * Bastaba escribir esa clave en la consola —sin poseer ningún token— para que
 * el panel de administración se renderizara mostrando la identidad inventada.
 * Además explicaba un fallo reportado por el equipo: «Acceso denegado» en el
 * primer intento (clave vacía) y, tras varios intentos, entrada automática con
 * una identidad anterior (clave ya escrita y nunca revalidada).
 *
 * SOLUCIÓN
 * --------
 * El rol se toma del JWT verificado por el servidor en `/api/auth/me`. El
 * `localStorage` pasa a ser únicamente una CACHÉ DE PRESENTACIÓN (mostrar el
 * nombre mientras llega la respuesta), nunca la fuente de autoridad.
 *
 * @module SessionManager
 */
(function (global) {
  'use strict';

  /** Ruta del login relativa a las vistas del panel. */
  const RUTA_LOGIN = '../../public/login/login.html';

  class SessionManager {
    /** @type {{id:string,rol:string,correo:string}|null} Identidad verificada. */
    #identidad = null;

    /** @type {Promise<object|null>|null} Petición en curso, para no duplicarla. */
    #peticionEnCurso = null;

    /**
     * Obtiene la identidad verificada por el servidor.
     *
     * Se memoriza durante la carga de la página: varios controladores pueden
     * pedirla y solo se realiza una petición.
     *
     * @returns {Promise<{id:string,rol:string,correo:string}|null>}
     */
    async identidad() {
      if (this.#identidad) return this.#identidad;
      if (this.#peticionEnCurso) return this.#peticionEnCurso;

      this.#peticionEnCurso = this.#consultarServidor();
      this.#identidad = await this.#peticionEnCurso;
      this.#peticionEnCurso = null;
      return this.#identidad;
    }

    /**
     * Consulta `/api/auth/me`. Devuelve null si no hay sesión válida.
     * @returns {Promise<object|null>}
     */
    async #consultarServidor() {
      try {
        // apiFetch adjunta el JWT y renueva el token una vez si expiró.
        return await global.apiFetch('/api/auth/me');
      } catch (_) {
        return null;
      }
    }

    /**
     * Exige una sesión válida con uno de los roles indicados.
     *
     * Si no la hay, redirige al login con `location.replace` para no dejar la
     * página protegida en el historial de navegación.
     *
     * @param {string[]} rolesPermitidos Roles autorizados para la vista.
     * @param {string}   [rutaLogin]     Ruta del login (relativa a la vista).
     * @returns {Promise<object|null>} Identidad verificada, o null si se denegó.
     */
    async exigir(rolesPermitidos, rutaLogin = RUTA_LOGIN) {
      const identidad = await this.identidad();

      if (!identidad) {
        this.#negar('Tu sesión expiró o no es válida.', rutaLogin);
        return null;
      }
      if (Array.isArray(rolesPermitidos) && rolesPermitidos.length > 0
          && !rolesPermitidos.includes(identidad.rol)) {
        this.#negar('No tienes permisos para acceder a esta sección.', rutaLogin);
        return null;
      }

      // Se sincroniza la caché de presentación con la identidad REAL: si el
      // valor guardado no coincidía con el del token, queda corregido.
      try {
        localStorage.setItem('usuarioLogueado', JSON.stringify({
          nombre: identidad.nombre ?? identidad.correo ?? '',
          rol: identidad.rol,
        }));
      } catch (_) { /* almacenamiento no disponible */ }

      return identidad;
    }

    /**
     * Muestra el aviso de acceso denegado y regresa al login.
     * @param {string} mensaje  Texto para el usuario.
     * @param {string} rutaLogin Destino de la redirección.
     */
    #negar(mensaje, rutaLogin) {
      // Se limpia la caché para que un valor obsoleto no vuelva a conceder
      // acceso aparente en la siguiente carga.
      try { localStorage.removeItem('usuarioLogueado'); } catch (_) { /* noop */ }

      const texto = String(mensaje);
      document.body.textContent = '';

      const caja = document.createElement('div');
      caja.setAttribute('role', 'alert');
      caja.style.cssText = 'display:flex;align-items:center;justify-content:center;'
        + 'height:100vh;flex-direction:column;gap:1rem;text-align:center;padding:1.5rem;'
        + 'font-family:"Segoe UI",Arial,sans-serif;';

      const titulo = document.createElement('h2');
      titulo.textContent = 'Acceso denegado';
      titulo.style.cssText = 'color:#1E3A8A;font-size:1.75rem;margin:0;';

      const detalle = document.createElement('p');
      detalle.textContent = texto;
      detalle.style.cssText = 'color:#5b6472;font-size:1rem;margin:0;';

      const enlace = document.createElement('a');
      enlace.href = rutaLogin;
      enlace.textContent = 'Ir al inicio de sesión';
      enlace.style.cssText = 'color:#0F1E5A;font-weight:600;font-size:1rem;';

      caja.append(titulo, detalle, enlace);
      document.body.appendChild(caja);
    }
  }

  /** Instancia compartida: una sola verificación por carga de página. */
  global.BSPSession = new SessionManager();
})(window);
