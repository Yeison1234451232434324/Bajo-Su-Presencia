/**
 * Usuarios Controller — con paginación, filtros de fecha y selector de registros
 */
document.addEventListener('DOMContentLoaded', () => {

  const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  if (sesion.rol !== 'Administrador') {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:serif;flex-direction:column;gap:1rem;"><h2 style="color:#1E3A8A;">Acceso Denegado</h2><a href="../../public/login/login.html" style="color:#1E3A8A;font-weight:600;">Volver al inicio</a></div>';
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

  // ── Helpers ──────────────────────────────────────────────────────────────
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

  // ── DataTable de usuarios ────────────────────────────────────────────────
  let dtUsuarios = null;

  function renderTabla() {
    const todos = UsuariosModel.getAll();

    // Actualizar contadores
    if (contTotal)     contTotal.textContent     = todos.length;
    if (contActivos)   contActivos.textContent   = todos.filter(u => u.activo).length;
    if (contInactivos) contInactivos.textContent = todos.filter(u => !u.activo).length;

    const data = todos.map(u => ({
      ...u,
      estadoTexto: u.activo ? 'Activo' : 'Inactivo'
    }));

    function renderRow(u) {
      const badgeRol    = rolBadge(u.rol);
      const badgeEstado = u.activo
        ? '<span class="badge badge-green">Activo</span>'
        : '<span class="badge badge-red">Inactivo</span>';
      const btnToggle = u.id === 1
        ? `<button class="btn-accion btn-toggle" disabled title="No se puede desactivar al admin principal"><i class="bx bx-lock"></i></button>`
        : `<button class="btn-accion btn-toggle" onclick="toggleUsuario(${u.id})" title="${u.activo ? 'Desactivar' : 'Activar'}"><i class="bx ${u.activo ? 'bx-toggle-right' : 'bx-toggle-left'}"></i></button>`;
      const avatar      = u.nombre.charAt(0).toUpperCase();
      const avatarColor = colorAvatar(u.rol);
      return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.875rem 1.25rem;
          background:#fff;border:2px solid var(--border);border-radius:1rem;margin-bottom:0.5rem;
          flex-wrap:wrap;${u.activo ? '' : 'opacity:0.65;background:#fafafa;'}">
          <div class="user-cell" style="flex:2;min-width:180px;">
            <div class="user-avatar-sm" style="background:${avatarColor}">${avatar}</div>
            <div>
              <p class="user-nombre">${u.nombre}</p>
              <p class="user-username">@${u.username}</p>
            </div>
          </div>
          <span style="flex:2;min-width:140px;font-size:0.875rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.email}</span>
          <span style="flex-shrink:0;">${badgeRol}</span>
          <span style="flex-shrink:0;">${badgeEstado}</span>
          <span style="flex-shrink:0;font-size:0.82rem;color:var(--muted);">${u.creado}</span>
          <div class="acciones-cell" style="flex-shrink:0;margin-left:auto;">
            <button class="btn-accion btn-editar" onclick="abrirEditar(${u.id})" title="Editar usuario"><i class="bx bx-edit"></i></button>
            ${btnToggle}
          </div>
        </div>`;
    }

    if (!dtUsuarios) {
      dtUsuarios = new BSPDataTable({
        containerId:  'dt-usuarios',
        data,
        pageSize:     10,
        searchFields: ['nombre', 'username', 'email'],
        filters: [
          { key: 'rol',         label: 'Rol',    type: 'select', options: ['Administrador', 'Colaborador', 'Voluntario'] },
          { key: 'estadoTexto', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo'] },
          { key: 'creado', label: 'Desde', type: 'date-from' },
          { key: 'creado', label: 'Hasta', type: 'date-to'   },
        ],
        renderRow,
        exportable:   true,
        exportName:   'usuarios',
        exportFields: ['nombre', 'username', 'email', 'rol', 'estadoTexto', 'creado'],
        exportLabels: ['Nombre', 'Usuario', 'Correo', 'Rol', 'Estado', 'Registrado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-user-x"></i><p>No se encontraron usuarios con esos criterios.</p></div>`
      });
      window.__bspDT['dt-usuarios'] = dtUsuarios;
      dtUsuarios.init();
    } else {
      dtUsuarios.refresh(data);
    }
  }

  // ── Modal CREAR ──────────────────────────────────────────────────────────
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

  // ── Modal EDITAR ─────────────────────────────────────────────────────────
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

  function cerrarModal() {
    modal.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    formUsuario.reset();
    editandoId = null;
  }

  // ── Helpers de validación DOM ────────────────────────────────────────────
  const RX_NOMBRE   = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
  const RX_USERNAME = /^[a-zA-Z0-9_]+$/;
  const RX_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function _err(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('campo-invalido');
    const box = el.closest('.form-group') || el.parentElement;
    let s = box.querySelector('.campo-error');
    if (!s) { s = document.createElement('span'); s.className = 'campo-error'; box.appendChild(s); }
    s.textContent = msg;
  }
  function _ok(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('campo-invalido');
      const box = el.closest('.form-group') || el.parentElement;
      const s = box.querySelector('.campo-error');
      if (s) s.remove();
    });
  }

  // ── Submit formulario ────────────────────────────────────────────────────
  formUsuario.addEventListener('submit', (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    const nombre   = document.getElementById('campo-nombre').value.trim();
    const username = document.getElementById('campo-username').value.trim();
    const email    = document.getElementById('campo-email').value.trim();
    const rol      = document.getElementById('campo-rol').value;
    const password = document.getElementById('campo-password').value;

    // ── Validación DOM ────────────────────────────────────────────────────
    _ok('campo-nombre','campo-username','campo-email','campo-rol','campo-password');
    let valido = true;

    if (!nombre || nombre.length < 3) {
      _err('campo-nombre', 'El nombre debe tener al menos 3 caracteres.');
      valido = false;
    } else if (!RX_NOMBRE.test(nombre)) {
      _err('campo-nombre', 'Solo se permiten letras y espacios. Sin números.');
      valido = false;
    } else if (nombre.length > 80) {
      _err('campo-nombre', 'El nombre no puede superar 80 caracteres.');
      valido = false;
    }

    if (!username || username.length < 3) {
      _err('campo-username', 'El usuario debe tener al menos 3 caracteres.');
      valido = false;
    } else if (!RX_USERNAME.test(username)) {
      _err('campo-username', 'Solo letras, números y guión bajo. Sin espacios.');
      valido = false;
    } else if (username.length > 30) {
      _err('campo-username', 'El usuario no puede superar 30 caracteres.');
      valido = false;
    }

    if (!email || !RX_EMAIL.test(email)) {
      _err('campo-email', 'Ingresa un correo electrónico válido (ej: user@correo.com).');
      valido = false;
    }

    if (!rol) {
      _err('campo-rol', 'Selecciona un rol para el usuario.');
      valido = false;
    }

    if (editandoId === null) {
      if (!password || password.length < 6) {
        _err('campo-password', 'La contraseña debe tener al menos 6 caracteres.');
        valido = false;
      } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        _err('campo-password', 'La contraseña debe combinar letras y números.');
        valido = false;
      }
    }
    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    const data = { nombre, username, email, rol, password };
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
    showAlertSuccess(
      editandoId === null
        ? `El usuario "${data.nombre}" fue creado exitosamente.`
        : `Los datos de "${data.nombre}" fueron actualizados.`
    );
  });

  // ── Toggle activo/inactivo ───────────────────────────────────────────────
  window.toggleUsuario = function(id) {
    const resultado = UsuariosModel.toggleActivo(id);
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }
    renderTabla();
    showAlertSuccess(
      resultado.activo ? 'El usuario ahora puede iniciar sesión.' : 'El usuario ha sido desactivado.'
    );
  };

  // ── Event listeners ──────────────────────────────────────────────────────
  btnNuevo.addEventListener('click', abrirCrear);
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  // ── Restricciones HTML dinámicas ─────────────────────────────────────────
  [['campo-nombre', 80], ['campo-username', 30]].forEach(([id, max]) => {
    const el = document.getElementById(id);
    if (el) el.maxLength = max;
  });

  // ── Render inicial ────────────────────────────────────────────────────────
  renderTabla();
});
