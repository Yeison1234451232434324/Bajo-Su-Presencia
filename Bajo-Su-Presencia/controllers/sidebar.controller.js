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
      <i class="bx bx-church" aria-hidden="true"></i>
      <span>Bajo Su Presencia</span>
    </div>

    <button id="btn" class="sidebar-toggle" type="button" aria-label="Expandir menú" aria-expanded="false" aria-controls="sidebar"><svg class="sidebar-toggle-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg></button>

    <div class="user">
      <div class="avatar" id="sidebar-avatar">A</div>
      <div class="user-info">
        <p class="bold" id="sidebar-name">Admin</p>
        <p id="sidebar-role">Administrador</p>
      </div>
    </div>

    <ul>
      <li>
        <a href="dashboard.html" id="nav-dashboard">
          <i class="bx bxs-grid-alt" aria-hidden="true"></i>
          <span class="nav-item">Dashboard</span>
        </a>
        <span class="tooltip">Dashboard</span>
      </li>
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
      <li id="li-usuarios" style="display:none;">
        <a href="usuarios.html" id="nav-usuarios">
          <i class="bx bx-group" aria-hidden="true"></i>
          <span class="nav-item">Gestión de Usuarios</span>
        </a>
        <span class="tooltip">Gestión de Usuarios</span>
      </li>
      <li id="li-voluntarios" style="display:none;">
        <a href="voluntarios.html" id="nav-voluntarios">
          <i class="bx bx-medal" aria-hidden="true"></i>
          <span class="nav-item">Calificar Voluntarios</span>
        </a>
        <span class="tooltip">Calificar Voluntarios</span>
      </li>
      <li id="li-recursos" style="display:none;">
        <a href="recursos.html" id="nav-recursos">
          <i class="bx bx-package" aria-hidden="true"></i>
          <span class="nav-item">Gestión de Recursos</span>
        </a>
        <span class="tooltip">Gestión de Recursos</span>
      </li>
      <li id="li-actividades" style="display:none;">
        <a href="actividades.html" id="nav-actividades">
          <i class="bx bx-task" aria-hidden="true"></i>
          <span class="nav-item">Actividades</span>
        </a>
        <span class="tooltip">Actividades</span>
      </li>
      <li id="li-reporte" style="display:none;">
        <a href="reporte.html" id="nav-reporte">
          <i class="bx bx-upload" aria-hidden="true"></i>
          <span class="nav-item">Subir Reporte</span>
        </a>
        <span class="tooltip">Subir Reporte</span>
      </li>
      <li id="li-generar-reportes" style="display:none;">
        <a href="generar-reportes.html" id="nav-generar-reportes">
          <i class="bx bx-bar-chart-alt-2" aria-hidden="true"></i>
          <span class="nav-item">Generar Reportes</span>
        </a>
        <span class="tooltip">Generar Reportes</span>
      </li>
      <li id="li-sedes" style="display:none;">
        <a href="sedes.html" id="nav-sedes">
          <i class="bx bx-buildings" aria-hidden="true"></i>
          <span class="nav-item">Gestión de Sedes</span>
        </a>
        <span class="tooltip">Gestión de Sedes</span>
      </li>
      <li id="li-pqr" style="display:none;">
        <a href="pqr.html" id="nav-pqr">
          <i class="bx bx-message-detail" aria-hidden="true"></i>
          <span class="nav-item">PQR</span>
        </a>
        <span class="tooltip">PQR</span>
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

  // ── Cierre de sesión real ─────────────────────────────────────────────────
  // El enlace por sí solo únicamente navegaba al login: el JWT y el refresh
  // token seguían vivos en localStorage. bspBindLogout destruye la sesión.
  if (window.bspBindLogout) window.bspBindLogout();

  // ── Botón flotante móvil ──────────────────────────────────────────────────
  const mobileBtn = document.createElement('button');
  mobileBtn.className   = 'sidebar-toggle-mobile';
  mobileBtn.id          = 'sidebar-toggle-mobile';
  mobileBtn.setAttribute('aria-label', 'Abrir menú');
  mobileBtn.innerHTML   = '<span></span><span></span><span></span>';
  document.body.appendChild(mobileBtn);

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

  function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const main     = document.getElementById('main');
    const isMobile = window.innerWidth <= 768;
    const abierto  = sidebar.classList.toggle('active');

    if (isMobile) {
      overlay.classList.toggle('active', abierto);
      mobileBtn.classList.toggle('open', abierto);
    } else {
      main.classList.toggle('sidebar-open', abierto);
    }
    actualizarEstadoBtn();
  }

  document.getElementById('btn').addEventListener('click', toggleSidebar);
  mobileBtn.addEventListener('click', toggleSidebar);

  // Cerrar sidebar al hacer clic en el overlay
  overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
    overlay.classList.remove('active');
    mobileBtn.classList.remove('open');
    actualizarEstadoBtn();
  });

  // ── Marcar ítem activo ────────────────────────────────────────────────────
  const path = window.location.pathname;
  if      (path.includes("dashboard.html"))  document.getElementById("nav-dashboard")?.parentElement.classList.add("active-item");
  else if (path.includes("eventos.html"))    document.getElementById("nav-eventos")?.parentElement.classList.add("active-item");
  else if (path.includes("oracion.html"))    document.getElementById("nav-oracion")?.parentElement.classList.add("active-item");
  else if (path.includes("noticias.html"))   document.getElementById("nav-noticias")?.parentElement.classList.add("active-item");
  else if (path.includes("usuarios.html"))   document.getElementById("nav-usuarios")?.parentElement.classList.add("active-item");
  else if (path.includes("voluntarios.html")) document.getElementById("nav-voluntarios")?.parentElement.classList.add("active-item");
  else if (path.includes("recursos.html"))    document.getElementById("nav-recursos")?.parentElement.classList.add("active-item");
  else if (path.includes("actividades.html")) document.getElementById("nav-actividades")?.parentElement.classList.add("active-item");
  else if (path.includes("reporte.html"))          document.getElementById("nav-reporte")?.parentElement.classList.add("active-item");
  else if (path.includes("generar-reportes.html")) document.getElementById("nav-generar-reportes")?.parentElement.classList.add("active-item");
  else if (path.includes("sedes.html"))            document.getElementById("nav-sedes")?.parentElement.classList.add("active-item");
  else if (path.includes("pqr.html"))              document.getElementById("nav-pqr")?.parentElement.classList.add("active-item");

  // ── Identidad y menú: SIEMPRE según el servidor ──────────────────────────
  // Antes esto se resolvía leyendo `usuarioLogueado` de localStorage de forma
  // SÍNCRONA. Como la verificación de sesión es asíncrona, el menú alcanzaba a
  // pintarse con la identidad del usuario ANTERIOR (la que había quedado
  // guardada) antes de que la comprobación terminase — de ahí que "apareciera
  // otro usuario" al navegar con Atrás/Adelante. Además, el rol guardado es
  // editable por el usuario, así que decidía qué secciones se mostraban.
  // Ahora ambas cosas dependen del rol firmado en el JWT.
  (async () => {
    const nombreEl = document.getElementById('sidebar-name');
    const rolEl    = document.getElementById('sidebar-role');
    const avatarEl = document.getElementById('sidebar-avatar');

    const identidad = await window.BSPSession?.identidad();
    if (!identidad) return;   // sin sesión válida el guard ya expulsa al login

    const nombre = identidad.nombre || identidad.correo || '';
    if (nombreEl) nombreEl.textContent = nombre;
    if (rolEl)    rolEl.textContent    = identidad.rol || '';
    if (avatarEl) avatarEl.textContent = nombre.charAt(0).toUpperCase();

    // Secciones exclusivas del Administrador. Es solo cosmética: cada vista
    // vuelve a exigir el rol contra el servidor al abrirse.
    if (identidad.rol === 'Administrador') {
      ['li-usuarios', 'li-voluntarios', 'li-recursos',
       'li-actividades', 'li-reporte', 'li-generar-reportes', 'li-sedes', 'li-pqr']
        .forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });
    }
  })();
});

// Las notificaciones viven EXCLUSIVAMENTE en alertify.helper.js
// (showToast, showToastError, showAlert*). La implementación local que existía
// aquí construía su propio `.toast-container` y quedaba siempre sobrescrita por
// la de alertify.helper.js —ambos son scripts clásicos que comparten el ámbito
// global y el helper se carga después—, así que nunca llegaba a ejecutarse.
