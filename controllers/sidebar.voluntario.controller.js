/**
 * ============================================================
 * SIDEBAR VOLUNTARIO
 * ============================================================
 * Inyecta el sidebar del panel de voluntario y carga los datos
 * del usuario logueado desde localStorage.
 * Solo accesible para usuarios con rol "Voluntario".
 * ============================================================
 */

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
      <i class="bx bx-church"></i>
      <span>Bajo Su Presencia</span>
    </div>

    <i class="bx bx-menu" id="btn"></i>

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
          <i class="bx bx-star"></i>
          <span class="nav-item">Mis Calificaciones</span>
        </a>
        <span class="tooltip">Mis Calificaciones</span>
      </li>
      <!-- Disponibilidad en eventos publicados -->
      <li>
        <a href="disponibilidad.html" id="nav-disponibilidad">
          <i class="bx bx-calendar-check"></i>
          <span class="nav-item">Mis Eventos</span>
        </a>
        <span class="tooltip">Mis Eventos</span>
      </li>
      <!-- Cerrar sesión -->
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

  // ── Toggle sidebar ────────────────────────────────────────────────────────
  document.getElementById('btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('main').classList.toggle('sidebar-open');
  });

  // ── Marcar ítem activo según la página actual ─────────────────────────────
  const path = window.location.pathname;
  if      (path.includes("calificaciones.html"))  document.getElementById("nav-calificaciones")?.parentElement.classList.add("active-item");
  else if (path.includes("disponibilidad.html"))  document.getElementById("nav-disponibilidad")?.parentElement.classList.add("active-item");

  // ── Cargar datos del usuario desde localStorage ───────────────────────────
  const userData = localStorage.getItem('usuarioLogueado');
  if (userData) {
    const user = JSON.parse(userData);
    document.getElementById('sidebar-name').textContent   = user.nombre;
    document.getElementById('sidebar-role').textContent   = user.rol;
    document.getElementById('sidebar-avatar').textContent = user.nombre.charAt(0).toUpperCase();
  }
});

// ── Toast global (reutilizado en todos los controllers del voluntario) ────
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
