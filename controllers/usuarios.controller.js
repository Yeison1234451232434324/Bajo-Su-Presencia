/**
 * Usuarios Controller — con BSPDataTable v3
 * Maneja toda la lógica de la vista de gestión de usuarios (solo admin).
 * Depende de: UsuariosModel (usuarios.model.js)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Verificar que sea admin ──────────────────────────────────────────────
  const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  if (sesion.rol !== 'Administrador') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:serif;flex-direction:column;gap:1rem;">
        <h2 style="color:#1E3A8A;font-size:2rem;">Acceso Denegado</h2>
        <p style="color:#6b7280;">Solo el administrador puede acceder a esta sección.</p>
        <a href="../../public/login/login.html" style="color:#1E3A8A;font-weight:600;">Volver al inicio</a>
      </div>`;
    return;
  }

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const modal          = document.getElementById('modal-usuario');
  const modalTitle     = document.getElementById('modal-title');
  const formUsuario    = document.getElementById('form-usuario');
  const btnNuevo       = document.getElementById('btn-nuevo-usuario');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal');
  const btnCancelar    = document.getElementById('btn-cancelar');
  const modalError     = document.getElementById('modal-error');
  const passHint       = document.getElementById('pass-hint');
  const contTotal      = document.getElementById('cont-total');
  const contActivos    = document.getElementById('cont-activos');
  const contInactivos  = document.getElementById('cont-inactivos');
  const modalOverlay   = document.getElementById('modal-overlay');

  let editandoId = null;
  let dtUsuarios = null;

  // ── Helpers de estilo ────────────────────────────────────────────────────
  function rolBadge(rol) {
    const map = {
      'Administrador': '<span class="badge badge-blue">Administrador</span>',
      'Colaborador':   '<span class="badge badge-amber">Colaborador</span>',
      'Voluntario':    '<span class="badge badge-purple">Voluntario</span>'
    };
    return map[rol] || `<span class="badge">${rol}</span>`;
  }

  function colorAvatar(rol) {
    const map = {
      'Administrador': 'linear-gradient(135deg,#1E3A8A,#2D4FAF)',
      'Colaborador':   'linear-gradient(135deg,#d97706,#F5C215)',
      'Voluntario':    'linear-gradient(135deg,#059669,#10b981)'
    };
    return map[rol] || '#6b7280';
  }

  // ── Renderizar tabla con BSPDataTable ────────────────────────────────────
  function renderTabla() {
    const todos = UsuariosModel.getAll();

    // Actualizar contadores (siempre sobre el total, sin filtros)
    contTotal.textContent     = todos.length;
    contActivos.textContent   = todos.filter(u => u.activo).length;
    contInactivos.textContent = todos.filter(u => !u.activo).length;

    // Enriquecer con campo _estado para el filtro
    const usuarios = todos.map(u => ({
      ...u,
      _estado: u.activo ? 'Activo' : 'Inactivo'
    }));

    function renderRow(u) {
      const badgeRol    = rolBadge(u.rol);
      const badgeEstado = u.activo
        ? '<span class="badge badge-green">Activo</span>'
        : '<span class="badge badge-red">Inactivo</span>';

      const btnToggle = u.id === 1
        ? `<button class="btn-accion btn-toggle" disabled title="No se puede desactivar al admin principal">
             <i class="bx bx-lock"></i>
           </button>`
        : `<button class="btn-accion btn-toggle" onclick="toggleUsuario(${u.id})"
             title="${u.activo ? 'Desactivar' : 'Activar'} usuario">
             <i class="bx ${u.activo ? 'bx-toggle-right' : 'bx-toggle-left'}"></i>
           </button>`;

      const avatar      = u.nombre.charAt(0).toUpperCase();
      const avatarColor = colorAvatar(u.rol);

      // Cada fila se envuelve en una tabla para mantener el estilo existente
      return `
        <table class="usuarios-table bsp-dt-inner-table" style="margin-bottom:0;">
          <tbody>
            <tr class="${u.activo ? '' : 'fila-inactiva'}">
              <td>
                <div class="user-cell">
                  <div class="user-avatar-sm" style="background:${avatarColor}">${avatar}</div>
                  <div>
                    <p class="user-nombre">${u.nombre}</p>
                    <p class="user-username">@${u.username}</p>
                  </div>
                </div>
              </td>
              <td>${u.email}</td>
              <td>${badgeRol}</td>
              <td>${badgeEstado}</td>
              <td>${u.creado}</td>
              <td>
                <div class="acciones-cell">
                  <button class="btn-accion btn-editar" onclick="abrirEditar(${u.id})" title="Editar usuario">
                    <i class="bx bx-edit"></i>
                  </button>
                  ${btnToggle}
                </div>
              </td>
            </tr>
          </tbody>
        </table>`;
    }

    if (!dtUsuarios) {
      // Reemplazar la tabla existente con el DataTable
      const tablaWrap = document.querySelector('.table-wrap');
      if (tablaWrap) {
        // Crear contenedor para el DT
        const dtContainer = document.createElement('div');
        dtContainer.id = 'usuarios-dt-container';
        tablaWrap.parentNode.insertBefore(dtContainer, tablaWrap);
        tablaWrap.remove();
      }

      // Agregar encabezado de columnas fijo
      const thead = document.createElement('div');
      thead.className = 'usuarios-dt-thead';
      thead.innerHTML = `
        <table class="usuarios-table" style="margin-bottom:0;">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
        </table>`;
      const container = document.getElementById('usuarios-dt-container');
      if (container) container.appendChild(thead);

      // Crear contenedor para el DT body
      const dtBody = document.createElement('div');
      dtBody.id = 'usuarios-lista';
      if (container) container.appendChild(dtBody);

      dtUsuarios = new BSPDataTable({
        containerId:  'usuarios-lista',
        data:         usuarios,
        pageSize:     10,
        searchFields: ['nombre', 'username', 'email', 'rol', 'creado'],
        filters: [
          { key: 'rol',     label: 'Rol',    type: 'select', options: ['Administrador','Colaborador','Voluntario'] },
          { key: '_estado', label: 'Estado', type: 'select', options: ['Activo','Inactivo'] },
          { key: 'creado',  label: 'Desde',  type: 'date-from' },
          { key: 'creado',  label: 'Hasta',  type: 'date-to' },
        ],
        renderRow,
        exportable:   true,
        exportName:   'usuarios',
        exportFields: ['nombre', 'username', 'email', 'rol', '_estado', 'creado'],
        exportLabels: ['Nombre', 'Usuario', 'Correo', 'Rol', 'Estado', 'Fecha Creación'],
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-group"></i><p>No se encontraron usuarios con esos criterios.</p></div>`
      });
      window.__bspDT['usuarios-lista'] = dtUsuarios;
      dtUsuarios.init();
    } else {
      dtUsuarios.refresh(usuarios);
    }
  }

  // ── Abrir modal CREAR ────────────────────────────────────────────────────
  function abrirCrear() {
    editandoId = null;
    modalTitle.textContent = 'Nuevo Usuario';
    formUsuario.reset();
    passHint.style.display = 'none';
    document.getElementById('campo-password').required = true;
    modalError.style.display = 'none';
    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
  }

  // ── Abrir modal EDITAR ───────────────────────────────────────────────────
  window.abrirEditar = function(id) {
    const u = UsuariosModel.getById(id);
    if (!u) return;
    editandoId = id;
    modalTitle.textContent = 'Editar Usuario';
    document.getElementById('campo-nombre').value    = u.nombre;
    document.getElementById('campo-username').value  = u.username;
    document.getElementById('campo-email').value     = u.email;
    document.getElementById('campo-rol').value       = u.rol;
    document.getElementById('campo-password').value  = '';
    document.getElementById('campo-password').required = false;
    passHint.style.display = 'block';
    modalError.style.display = 'none';
    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
  };

  // ── Cerrar modal ─────────────────────────────────────────────────────────
  function cerrarModal() {
    modal.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    formUsuario.reset();
    editandoId = null;
  }

  // ── Submit del formulario ────────────────────────────────────────────────
  formUsuario.addEventListener('submit', (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    const data = {
      nombre:   document.getElementById('campo-nombre').value,
      username: document.getElementById('campo-username').value,
      email:    document.getElementById('campo-email').value,
      rol:      document.getElementById('campo-rol').value,
      password: document.getElementById('campo-password').value
    };

    const resultado = editandoId === null
      ? UsuariosModel.create(data)
      : UsuariosModel.update(editandoId, data);

    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    renderTabla();
    showToast(
      editandoId === null ? 'Usuario creado' : 'Usuario actualizado',
      editandoId === null
        ? `El usuario "${data.nombre}" fue creado exitosamente.`
        : `Los datos de "${data.nombre}" fueron actualizados.`
    );
  });

  // ── Toggle activo/inactivo ───────────────────────────────────────────────
  window.toggleUsuario = function(id) {
    const resultado = UsuariosModel.toggleActivo(id);
    if (!resultado.ok) {
      showToastError('No permitido', resultado.error);
      return;
    }
    renderTabla();
    showToast(
      resultado.activo ? 'Usuario activado' : 'Usuario desactivado',
      resultado.activo ? 'El usuario ahora puede iniciar sesión.' : 'El usuario ha sido desactivado.'
    );
  };

  // ── Toast de error ───────────────────────────────────────────────────────
  function showToastError(title, desc) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id        = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `<div class="toast-title">❌ ${title}</div><div class="toast-desc">${desc}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  btnNuevo.addEventListener('click', abrirCrear);
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
