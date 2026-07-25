/**
 * ============================================================
 * TRAZADOR FORENSE DE SESIÓN  —  herramienta de diagnóstico
 * ============================================================
 * PARA QUÉ SIRVE
 * Registra CADA escritura y lectura de identidad, con marca de
 * tiempo y traza de pila, para responder con evidencia a:
 *
 *     ¿qué función escribió la identidad anterior?
 *     ¿desde qué archivo y qué línea?
 *     ¿qué evento del navegador la disparó?
 *
 * NO forma parte de la aplicación. Es una herramienta de auditoría
 * que se carga a mano solo mientras se investiga.
 *
 * CÓMO SE USA
 *   1. Abrir la consola del navegador (F12) en cualquier página.
 *   2. Pegar:  BSPForense.activar()
 *      (queda activo al navegar: se guarda en sessionStorage)
 *   3. Reproducir el fallo: iniciar sesión, cerrar sesión,
 *      pulsar Atrás y Adelante, cambiar de usuario…
 *   4. Pedir el informe:  BSPForense.informe()
 *      o copiarlo al portapapeles:  BSPForense.copiar()
 *
 * Para desactivarlo:  BSPForense.desactivar()
 *
 * @module BSPForense
 */
(function (global) {
  'use strict';

  const CLAVE_ACTIVO   = '__bsp_forense_activo';
  const CLAVE_REGISTRO = '__bsp_forense_registro';
  const MAX_EVENTOS    = 500;

  /** Claves cuyo valor NO debe registrarse íntegro (se resume). */
  const SENSIBLES = /token|password|contrasena|secret|refresh/i;

  class TrazadorForense {
    #instalado = false;

    /* ─────────── Registro persistente ─────────── */

    #leerRegistro() {
      try { return JSON.parse(sessionStorage.getItem(CLAVE_REGISTRO) || '[]'); }
      catch (_) { return []; }
    }

    #anotar(evento) {
      const registro = this.#leerRegistro();
      registro.push(evento);
      // Se conserva una ventana acotada para no agotar sessionStorage.
      while (registro.length > MAX_EVENTOS) registro.shift();
      try { sessionStorage.setItem(CLAVE_REGISTRO, JSON.stringify(registro)); }
      catch (_) { /* cuota agotada: se deja de registrar */ }
    }

    /** Resume un valor largo o sensible para que el informe sea legible. */
    #resumir(clave, valor) {
      if (valor === null || valor === undefined) return null;
      const texto = String(valor);
      if (SENSIBLES.test(clave)) return `«${texto.length} caracteres, no se muestra»`;
      return texto.length > 120 ? texto.slice(0, 120) + '…' : texto;
    }

    /**
     * Devuelve la línea de código que originó la llamada, saltándose
     * los marcos internos de este propio trazador.
     */
    #origen() {
      const pila = (new Error().stack || '').split('\n').map(l => l.trim());
      const util = pila.find(l =>
        l.includes('.js') && !l.includes('forense.tracer') && !l.includes('Error'));
      return util || '(origen no determinable)';
    }

    #registrar(tipo, detalle) {
      this.#anotar({
        t: new Date().toISOString().slice(11, 23),
        url: location.pathname + location.hash,
        tipo,
        ...detalle,
        origen: this.#origen(),
      });
    }

    /* ─────────── Instrumentación ─────────── */

    /** Intercepta escrituras y borrados de localStorage y sessionStorage. */
    #instrumentarAlmacenamiento() {
      [['localStorage', localStorage], ['sessionStorage', sessionStorage]].forEach(([nombre, almacen]) => {
        const setOriginal    = almacen.setItem.bind(almacen);
        const removeOriginal = almacen.removeItem.bind(almacen);
        const clearOriginal  = almacen.clear.bind(almacen);

        almacen.setItem = (clave, valor) => {
          if (String(clave).startsWith('__bsp_forense')) return setOriginal(clave, valor);
          this.#registrar('ESCRIBE', {
            almacen: nombre,
            clave,
            antes:   this.#resumir(clave, almacen.getItem(clave)),
            despues: this.#resumir(clave, valor),
          });
          return setOriginal(clave, valor);
        };

        almacen.removeItem = (clave) => {
          if (String(clave).startsWith('__bsp_forense')) return removeOriginal(clave);
          this.#registrar('BORRA', {
            almacen: nombre, clave,
            antes: this.#resumir(clave, almacen.getItem(clave)),
          });
          return removeOriginal(clave);
        };

        almacen.clear = () => {
          this.#registrar('LIMPIA_TODO', { almacen: nombre, claves: Object.keys(almacen) });
          const registro = sessionStorage.getItem(CLAVE_REGISTRO);
          const activo   = sessionStorage.getItem(CLAVE_ACTIVO);
          clearOriginal();
          // El propio registro sobrevive al borrado, o perderíamos la evidencia.
          if (registro) setOriginal.call(sessionStorage, CLAVE_REGISTRO, registro);
          if (activo)   setOriginal.call(sessionStorage, CLAVE_ACTIVO, activo);
        };
      });
    }

    /** Registra los eventos del navegador implicados en la navegación. */
    #instrumentarEventos() {
      const eventos = ['pageshow', 'pagehide', 'popstate', 'visibilitychange',
                       'storage', 'beforeunload', 'hashchange'];
      eventos.forEach((nombre) => {
        window.addEventListener(nombre, (e) => {
          const extra = {};
          if (nombre === 'pageshow' || nombre === 'pagehide') extra.persisted = e.persisted;
          if (nombre === 'storage') { extra.clave = e.key; extra.nuevo = this.#resumir(e.key, e.newValue); }
          if (nombre === 'visibilitychange') extra.estado = document.visibilityState;
          this.#registrar('EVENTO:' + nombre, extra);
        }, true);
      });
    }

    /** Registra los cambios de sesión que emite el SDK de Supabase. */
    #instrumentarSupabase() {
      if (!global.sb?.auth?.onAuthStateChange) return;
      global.sb.auth.onAuthStateChange((evento, sesion) => {
        this.#registrar('SUPABASE:' + evento, {
          usuario: sesion?.user?.email || null,
          expira: sesion?.expires_at || null,
        });
      });
    }

    /** Registra los mensajes de sincronización entre pestañas. */
    #instrumentarCanal() {
      const nombreCanal = global.sb?.auth?.storageKey;
      if (!nombreCanal || typeof BroadcastChannel !== 'function') return;
      try {
        const canal = new BroadcastChannel(nombreCanal);
        canal.addEventListener('message', (e) => {
          this.#registrar('CANAL_ENTRE_PESTAÑAS', {
            evento: e.data?.event || null,
            usuario: e.data?.session?.user?.email || null,
          });
        });
      } catch (_) { /* canal no disponible */ }
    }

    /* ─────────── API pública ─────────── */

    /** Activa el trazado. Persiste al navegar entre páginas. */
    activar() {
      sessionStorage.setItem(CLAVE_ACTIVO, '1');
      this.instalar();
      console.log('%c[FORENSE] Trazado ACTIVO. Reproduce el fallo y ejecuta BSPForense.informe()',
        'background:#1E3A8A;color:#fff;padding:3px 8px;border-radius:4px');
      return 'activo';
    }

    /** Instala la instrumentación si el trazado está activo. */
    instalar() {
      if (this.#instalado) return;
      if (sessionStorage.getItem(CLAVE_ACTIVO) !== '1') return;
      this.#instalado = true;
      this.#instrumentarAlmacenamiento();
      this.#instrumentarEventos();
      this.#instrumentarSupabase();
      this.#instrumentarCanal();
      this.#registrar('CARGA_DE_PAGINA', { titulo: document.title });
    }

    /** Detiene el trazado y borra el registro. */
    desactivar() {
      sessionStorage.removeItem(CLAVE_ACTIVO);
      sessionStorage.removeItem(CLAVE_REGISTRO);
      console.log('[FORENSE] Trazado desactivado. Recarga la página para restaurar el comportamiento normal.');
      return 'desactivado';
    }

    /** Imprime el informe en la consola, en forma de tabla. */
    informe() {
      const registro = this.#leerRegistro();
      if (registro.length === 0) {
        console.log('[FORENSE] Sin eventos. ¿Ejecutaste BSPForense.activar() antes de reproducir el fallo?');
        return [];
      }
      console.log(`%c[FORENSE] ${registro.length} eventos registrados`,
        'background:#1E3A8A;color:#fff;padding:3px 8px;border-radius:4px');
      console.table(registro);
      return registro;
    }

    /** Devuelve el registro como texto, listo para pegar en el informe. */
    texto() {
      return this.#leerRegistro()
        .map(e => `${e.t} | ${e.url} | ${e.tipo} | ${e.clave || e.usuario || e.evento || ''} `
                + `| antes=${e.antes ?? '-'} | despues=${e.despues ?? '-'} | ${e.origen}`)
        .join('\n');
    }

    /** Copia el registro al portapapeles. */
    async copiar() {
      await navigator.clipboard.writeText(this.texto());
      console.log('[FORENSE] Registro copiado al portapapeles.');
      return 'copiado';
    }
  }

  global.BSPForense = new TrazadorForense();
  // Si quedó activo en una navegación anterior, se reinstala solo.
  global.BSPForense.instalar();
})(window);
