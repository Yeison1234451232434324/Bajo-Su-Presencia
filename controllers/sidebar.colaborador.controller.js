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
      <div class="avatar" id="sidebar-avatar">C</div>
      <div class="user-info">
        <p class="bold" id="sidebar-name">Colaborador</p>
        <p id="sidebar-role">Colaborador</p>
      </div>
    </div>

    <ul>
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
      <li>
        <a href="actividades.html" id="nav-actividades">
          <i class="bx bx-task"></i>
          <span class="nav-item">Actividades</span>
        </a>
        <span class="tooltip">Actividades</span>
      </li>
      <li>
        <a href="reporte.html" id="nav-reporte">
          <i class="bx bx-upload"></i>
          <span class="nav-item">Subir Reporte</span>
        </a>
        <span class="tooltip">Subir Reporte</span>
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

  // ── Toggle desktop ────────────────────────────────────────────────────────
  document.getElementById('btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('main').classList.toggle('sidebar-open');
  });

  // ── Toggle móvil ──────────────────────────────────────────────────────────
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebarEl = document.getElementById('sidebar');
  const overlayEl = document.getElementById('sidebar-overlay');

  function abrirMenuMovil() {
    sidebarEl.classList.add('mobile-open');
    overlayEl.classList.add('active');
    mobileBtn.querySelector('i').className = 'bx bx-x';
    document.body.style.overflow = 'hidden';
  }
  function cerrarMenuMovil() {
    sidebarEl.classList.remove('mobile-open');
    overlayEl.classList.remove('active');
    mobileBtn.querySelector('i').className = 'bx bx-menu';
    document.body.style.overflow = '';
  }

  mobileBtn.addEventListener('click', () => {
    sidebarEl.classList.contains('mobile-open') ? cerrarMenuMovil() : abrirMenuMovil();
  });
  overlayEl.addEventListener('click', cerrarMenuMovil);

  document.querySelectorAll('.sidebar ul li a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 768) cerrarMenuMovil();
    });
  });

  // ── Marcar ítem activo ────────────────────────────────────────────────────
  const path = window.location.pathname;
  if      (path.includes("eventos.html"))  document.getElementById("nav-eventos")?.parentElement.classList.add("active-item");
  else if (path.includes("oracion.html"))  document.getElementById("nav-oracion")?.parentElement.classList.add("active-item");
  else if (path.includes("noticias.html"))   document.getElementById("nav-noticias")?.parentElement.classList.add("active-item");
  else if (path.includes("actividades.html")) document.getElementById("nav-actividades")?.parentElement.classList.add("active-item");
  else if (path.includes("reporte.html"))     document.getElementById("nav-reporte")?.parentElement.classList.add("active-item");

  // ── Cargar usuario desde localStorage ────────────────────────────────────
  const userData = localStorage.getItem('usuarioLogueado');
  if (userData) {
    const user = JSON.parse(userData);
    document.getElementById('sidebar-name').textContent   = user.nombre;
    document.getElementById('sidebar-role').textContent   = user.rol;
    document.getElementById('sidebar-avatar').textContent = user.nombre.charAt(0).toUpperCase();
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
