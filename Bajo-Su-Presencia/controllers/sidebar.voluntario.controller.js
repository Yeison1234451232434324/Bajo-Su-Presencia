/**
 * ============================================================
 * SIDEBAR VOLUNTARIO
 * ============================================================
 * Inyecta el sidebar del panel de voluntario y carga los datos
 * del usuario logueado desde localStorage.
 * Solo accesible para usuarios con rol "Voluntario".
 * ============================================================
 */

// NOTA DE ARQUITECTURA — control de acceso
// Aquí vivía un SEGUNDO guard que solo comprobaba que el token ESTUVIERA
// presente, sin validarlo: un token inventado lo superaba. Convivía con el de
// SessionManager, que sí valida contra el servidor, y dos criterios distintos
// daban resultados incoherentes según en qué página cayera la navegación.
// El control de acceso —y su revalidación al restaurar la página con
// Atrás/Adelante— vive ahora EXCLUSIVAMENTE en session.manager.js.

document.addEventListener("DOMContentLoaded", () => {

  // ── Inyectar Boxicons si no está cargado ─────────────────────────────────
  if (!document.querySelector('link[href*="boxicons"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
    document.head.appendChild(link);
  }

  // ── HTML del sidebar del voluntario ──────────────────────────────────────
  const sidebarHTML = `
<div class="sidebar" id="sidebar">
  <div class="top">

    <div class="logo">
      <i class="bx bx-church" aria-hidden="true"></i>
      <span>Bajo Su Presencia</span>
    </div>

    <button id="btn" class="sidebar-toggle" type="button" aria-label="Expandir menú" aria-expanded="false" aria-controls="sidebar"><svg class="sidebar-toggle-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg></button>

    <div class="user">
      <div class="avatar" id="sidebar-avatar">V</div>
      <div class="user-info">
        <p class="bold" id="sidebar-name">Voluntario</p>
        <p id="sidebar-role">Voluntario</p>
      </div>
    </div>

    <ul>
      <!-- Mis calificaciones y observaciones -->
      <li>
        <a href="calificaciones.html" id="nav-calificaciones">
          <i class="bx bx-star" aria-hidden="true"></i>
          <span class="nav-item">Mis Calificaciones</span>
        </a>
        <span class="tooltip">Mis Calificaciones</span>
      </li>
      <!-- Actividades asignadas al voluntario -->
      <li>
        <a href="mis-actividades.html" id="nav-mis-actividades">
          <i class="bx bx-task" aria-hidden="true"></i>
          <span class="nav-item">Actividades Asignadas</span>
        </a>
        <span class="tooltip">Actividades Asignadas</span>
      </li>
      <!-- Mi perfil -->
      <li>
        <a href="perfil.html" id="nav-perfil">
          <i class="bx bx-id-card" aria-hidden="true"></i>
          <span class="nav-item">Mi Perfil</span>
        </a>
        <span class="tooltip">Mi Perfil</span>
      </li>
      <!-- Cerrar sesión -->
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

  // ── Botón flotante móvil ──────────────────────────────────────────────────
  const mobileBtn = document.createElement('button');
  mobileBtn.className   = 'mobile-menu-btn';
  mobileBtn.id          = 'mobile-menu-btn';
  mobileBtn.setAttribute('aria-label', 'Abrir menú');
  mobileBtn.innerHTML   = '<i class="bx bx-menu" aria-hidden="true"></i>';
  document.body.appendChild(mobileBtn);

  // ── Overlay para móvil ────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id        = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // ── Toggle sidebar ────────────────────────────────────────────────────────
  /** Refleja en el botón chevron el estado real del sidebar (a11y). */
  function actualizarEstadoBtn() {
    const btn = document.getElementById('btn');
    const sb  = document.getElementById('sidebar');
    if (!btn || !sb) return;
    const expandido = sb.classList.contains('active');
    btn.setAttribute('aria-expanded', String(expandido));
    btn.setAttribute('aria-label', expandido ? 'Contraer menú' : 'Expandir menú');
  }

  function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const main     = document.getElementById('main');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      const abierto = sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active', abierto);
    } else {
      sidebar.classList.toggle('active');
      main.classList.toggle('sidebar-open');
    }
    actualizarEstadoBtn();
  }

  document.getElementById('btn').addEventListener('click', toggleSidebar);
  mobileBtn.addEventListener('click', toggleSidebar);

  overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    overlay.classList.remove('active');
  });

  // ── Marcar ítem activo según la página actual ─────────────────────────────
  const path = window.location.pathname;
  if      (path.includes("calificaciones.html"))  document.getElementById("nav-calificaciones")?.parentElement.classList.add("active-item");
  else if (path.includes("mis-actividades.html"))   document.getElementById("nav-mis-actividades")?.parentElement.classList.add("active-item");
  else if (path.includes("perfil.html"))            document.getElementById("nav-perfil")?.parentElement.classList.add("active-item");

  // ── Cargar datos del usuario desde localStorage ───────────────────────────
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
