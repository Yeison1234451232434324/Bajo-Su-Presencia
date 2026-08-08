// NOTA DE ARQUITECTURA — control de acceso
// Aquí vivía un SEGUNDO guard que solo comprobaba que el token ESTUVIERA
// presente, sin validarlo: un token inventado lo superaba. Convivía con el de
// SessionManager, que sí valida contra el servidor, y dos criterios distintos
// daban resultados incoherentes según en qué página cayera la navegación.
// El control de acceso —y su revalidación al restaurar la página con
// Atrás/Adelante— vive ahora EXCLUSIVAMENTE en session.manager.js.

document.addEventListener("DOMContentLoaded", () => {

  // ── Inyectar Boxicons si no está cargado ──────────────────────────────────
  if (!document.querySelector('link[href*="boxicons"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
    document.head.appendChild(link);
  }

  // ── HTML del sidebar ──────────────────────────────────────────────────────
  const sidebarHTML = `
<div class="sidebar" id="sidebar">
  <div class="top">

    <div class="logo">
      <img src="/Bajo-Su-Presencia/assets/images/logo.png" alt="" aria-hidden="true">
      <span>Bajo Su Presencia B.S.P</span>
    </div>

    <button id="btn" class="sidebar-toggle" type="button" aria-label="Expandir menú" aria-expanded="false" aria-controls="sidebar"><svg class="sidebar-toggle-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg></button>

    <div class="user">
      <div class="avatar" id="sidebar-avatar">C</div>
      <div class="user-info">
        <p class="bold" id="sidebar-name">Colaborador</p>
        <p id="sidebar-role">Colaborador</p>
      </div>
    </div>

    <ul>
      <li>
        <a href="eventos.html" id="nav-eventos">
          <i class="bx bx-calendar-event" aria-hidden="true"></i>
          <span class="nav-item">Publicar Evento</span>
        </a>
        <span class="tooltip">Publicar Evento</span>
      </li>
      <li>
        <a href="oracion.html" id="nav-oracion">
          <i class="bx bx-church" aria-hidden="true"></i>
          <span class="nav-item">Oración del Día</span>
        </a>
        <span class="tooltip">Oración del Día</span>
      </li>
      <li>
        <a href="noticias.html" id="nav-noticias">
          <i class="bx bx-news" aria-hidden="true"></i>
          <span class="nav-item">Publicar Noticia</span>
        </a>
        <span class="tooltip">Publicar Noticia</span>
      </li>
      <li>
        <a href="actividades.html" id="nav-actividades">
          <i class="bx bx-task" aria-hidden="true"></i>
          <span class="nav-item">Actividades</span>
        </a>
        <span class="tooltip">Actividades</span>
      </li>
      <li>
        <a href="reporte.html" id="nav-reporte">
          <i class="bx bx-notepad" aria-hidden="true"></i>
          <span class="nav-item">Subir Reporte</span>
        </a>
        <span class="tooltip">Subir Reporte</span>
      </li>
      <li>
        <a href="perfil.html" id="nav-perfil">
          <i class="bx bx-id-card" aria-hidden="true"></i>
          <span class="nav-item">Mi Perfil</span>
        </a>
        <span class="tooltip">Mi Perfil</span>
      </li>
      <li class="logout-li">
        <a href="../../public/login/login.html" id="nav-logout">
          <i class="bx bx-log-out" aria-hidden="true"></i>
          <span class="nav-item">Cerrar Sesión</span>
        </a>
        <span class="tooltip">Cerrar Sesión</span>
      </li>
    </ul>

  </div>
</div>
  `;

  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // ── Cierre de sesión real (destruye JWT, refresh token y storage) ─────────
  if (window.bspBindLogout) window.bspBindLogout();

  // ── Overlay para móvil ────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id        = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // ── Toggle ────────────────────────────────────────────────────────────────
  /** Refleja en el botón chevron el estado real del sidebar (a11y). */
  function actualizarEstadoBtn() {
    const btn = document.getElementById('btn');
    const sb  = document.getElementById('sidebar');
    if (!btn || !sb) return;
    const expandido = sb.classList.contains('active');
    btn.setAttribute('aria-expanded', String(expandido));
    btn.setAttribute('aria-label', expandido ? 'Contraer menú' : 'Expandir menú');
  }

  document.getElementById('btn').addEventListener('click', () => {
    const sidebar  = document.getElementById('sidebar');
    const main     = document.getElementById('main');
    const isMobile = window.innerWidth <= 768;
    sidebar.classList.toggle('active');
    if (isMobile) {
      overlay.classList.toggle('active', sidebar.classList.contains('active'));
    } else {
      main.classList.toggle('sidebar-open');
    }
    actualizarEstadoBtn();
  });
  overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
    overlay.classList.remove('active');
    actualizarEstadoBtn();
  });

  // ── Marcar ítem activo ────────────────────────────────────────────────────
  const path = window.location.pathname;
  if      (path.includes("eventos.html"))  document.getElementById("nav-eventos")?.parentElement.classList.add("active-item");
  else if (path.includes("oracion.html"))  document.getElementById("nav-oracion")?.parentElement.classList.add("active-item");
  else if (path.includes("noticias.html"))   document.getElementById("nav-noticias")?.parentElement.classList.add("active-item");
  else if (path.includes("actividades.html")) document.getElementById("nav-actividades")?.parentElement.classList.add("active-item");
  else if (path.includes("reporte.html"))     document.getElementById("nav-reporte")?.parentElement.classList.add("active-item");
  else if (path.includes("perfil.html"))      document.getElementById("nav-perfil")?.parentElement.classList.add("active-item");

  // ── Cargar usuario desde localStorage ────────────────────────────────────
  // ── Identidad mostrada: SIEMPRE la verificada por el servidor ─────────────
  // Antes se pintaba leyendo `usuarioLogueado` de localStorage de forma
  // síncrona. Como el guard es asíncrono, el menú alcanzaba a mostrar la
  // identidad del usuario ANTERIOR (la que quedó guardada) antes de que la
  // verificación terminara: de ahí que "apareciera otro usuario".
  // Ahora se espera a la identidad del JWT verificado en /api/auth/me.
  (async () => {
    const nombreEl = document.getElementById('sidebar-name');
    const rolEl    = document.getElementById('sidebar-role');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (!nombreEl || !rolEl || !avatarEl) return;

    const identidad = await window.BSPSession?.identidad();
    if (!identidad) return;   // sin sesión válida, el guard ya expulsa

    const nombre = identidad.nombre || identidad.correo || '';
    nombreEl.textContent = nombre;
    rolEl.textContent    = identidad.rol || '';
    avatarEl.textContent = nombre.charAt(0).toUpperCase();
  })();
});

// Las notificaciones viven EXCLUSIVAMENTE en alertify.helper.js
// (showToast, showToastError, showAlert*). La implementación local que existía
// aquí construía su propio `.toast-container` y quedaba siempre sobrescrita por
// la de alertify.helper.js —ambos son scripts clásicos que comparten el ámbito
// global y el helper se carga después—, así que nunca llegaba a ejecutarse.
