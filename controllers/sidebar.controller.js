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
      <i class="bx bx-church"></i>
      <span>Bajo Su Presencia</span>
    </div>

    <i class="bx bx-menu" id="btn"></i>

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
          <i class="bx bxs-grid-alt"></i>
          <span class="nav-item">Dashboard</span>
        </a>
        <span class="tooltip">Dashboard</span>
      </li>
      <li>
        <a href="eventos.html" id="nav-eventos">
          <i class="bx bx-calendar-event"></i>
          <span class="nav-item">Publicar Evento</span>
        </a>
        <span class="tooltip">Publicar Evento</span>
      </li>
      <li>
        <a href="oracion.html" id="nav-oracion">
          <i class="bx bx-church"></i>
          <span class="nav-item">Oración del Día</span>
        </a>
        <span class="tooltip">Oración del Día</span>
      </li>
      <li>
        <a href="noticias.html" id="nav-noticias">
          <i class="bx bx-news"></i>
          <span class="nav-item">Publicar Noticia</span>
        </a>
        <span class="tooltip">Publicar Noticia</span>
      </li>
      <li id="li-usuarios" style="display:none;">
        <a href="usuarios.html" id="nav-usuarios">
          <i class="bx bx-group"></i>
          <span class="nav-item">Gestión de Usuarios</span>
        </a>
        <span class="tooltip">Gestión de Usuarios</span>
      </li>
      <li id="li-voluntarios" style="display:none;">
        <a href="voluntarios.html" id="nav-voluntarios">
          <i class="bx bx-medal"></i>
          <span class="nav-item">Calificar Voluntarios</span>
        </a>
        <span class="tooltip">Calificar Voluntarios</span>
      </li>
      <li id="li-recursos" style="display:none;">
        <a href="recursos.html" id="nav-recursos">
          <i class="bx bx-package"></i>
          <span class="nav-item">Gestión de Recursos</span>
        </a>
        <span class="tooltip">Gestión de Recursos</span>
      </li>
      <li id="li-actividades" style="display:none;">
        <a href="actividades.html" id="nav-actividades">
          <i class="bx bx-task"></i>
          <span class="nav-item">Actividades</span>
        </a>
        <span class="tooltip">Actividades</span>
      </li>
      <li id="li-reporte" style="display:none;">
        <a href="reporte.html" id="nav-reporte">
          <i class="bx bx-upload"></i>
          <span class="nav-item">Subir Reporte</span>
        </a>
        <span class="tooltip">Subir Reporte</span>
      </li>
      <li id="li-generar-reportes" style="display:none;">
        <a href="generar-reportes.html" id="nav-generar-reportes">
          <i class="bx bx-bar-chart-alt-2"></i>
          <span class="nav-item">Generar Reportes</span>
        </a>
        <span class="tooltip">Generar Reportes</span>
      </li>
      <li id="li-sedes" style="display:none;">
        <a href="sedes.html" id="nav-sedes">
          <i class="bx bx-buildings"></i>
          <span class="nav-item">Gestión de Sedes</span>
        </a>
        <span class="tooltip">Gestión de Sedes</span>
      </li>
      <li class="logout-li">
        <a href="../../public/login/login.html" id="nav-logout">
          <i class="bx bx-log-out"></i>
          <span class="nav-item">Cerrar Sesión</span>
        </a>
        <span class="tooltip">Cerrar Sesión</span>
      </li>
    </ul>

  </div>
</div>
  `;

  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // ── Inyectar botón hamburguesa y overlay para móvil ───────────────────────
  document.body.insertAdjacentHTML('afterbegin', `
    <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Abrir menú">
      <i class="bx bx-menu"></i>
    </button>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `);

  // ── Toggle desktop (botón dentro del sidebar) ─────────────────────────────
  document.getElementById('btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('main').classList.toggle('sidebar-open');
  });

  // ── Toggle móvil (botón hamburguesa externo) ──────────────────────────────
  const mobileBtn     = document.getElementById('mobile-menu-btn');
  const sidebarEl     = document.getElementById('sidebar');
  const overlayEl     = document.getElementById('sidebar-overlay');

  function abrirMenuMovil() {
    sidebarEl.classList.add('mobile-open');
    overlayEl.classList.add('active');
    mobileBtn.querySelector('i').className = 'bx bx-x';
  }
  function cerrarMenuMovil() {
    sidebarEl.classList.remove('mobile-open');
    overlayEl.classList.remove('active');
    mobileBtn.querySelector('i').className = 'bx bx-menu';
  }

  mobileBtn.addEventListener('click', () => {
    sidebarEl.classList.contains('mobile-open') ? cerrarMenuMovil() : abrirMenuMovil();
  });
  overlayEl.addEventListener('click', cerrarMenuMovil);

  // Cerrar menú al navegar en móvil
  document.querySelectorAll('.sidebar ul li a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 768) cerrarMenuMovil();
    });
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

  // ── Cargar usuario desde localStorage ────────────────────────────────────
  const userData = localStorage.getItem('usuarioLogueado');
  if (userData) {
    const user = JSON.parse(userData);
    document.getElementById('sidebar-name').textContent   = user.nombre;
    document.getElementById('sidebar-role').textContent   = user.rol;
    document.getElementById('sidebar-avatar').textContent = user.nombre.charAt(0).toUpperCase();

    // Mostrar ítem "Gestión de Usuarios" solo si es Administrador
    if (user.rol === 'Administrador') {
      const liUsuarios = document.getElementById('li-usuarios');
      if (liUsuarios) liUsuarios.style.display = '';

      const liVoluntarios = document.getElementById('li-voluntarios');
      if (liVoluntarios) liVoluntarios.style.display = '';

      const liRecursos = document.getElementById('li-recursos');
      if (liRecursos) liRecursos.style.display = '';

      const liActividades = document.getElementById('li-actividades');
      if (liActividades) liActividades.style.display = '';

      const liReporte = document.getElementById('li-reporte');
      if (liReporte) liReporte.style.display = '';

      const liGenerarReportes = document.getElementById('li-generar-reportes');
      if (liGenerarReportes) liGenerarReportes.style.display = '';

      const liSedes = document.getElementById('li-sedes');
      if (liSedes) liSedes.style.display = '';
    }
  }
});

// ── Toast global ──────────────────────────────────────────────────────────
function showToast(title, desc) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id        = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-title">✅ ${title}</div><div class="toast-desc">${desc}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
