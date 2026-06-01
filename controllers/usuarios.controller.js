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
  const tablaBody      = document.getElementById('usuarios-tbody');
  const modal          = document.getElementById('modal-usuario');
  const modalTitle     = document.getElementById('modal-title');
  const formUsuario    = document.getElementById('form-usuario');
  const btnNuevo       = document.getElementById('btn-nuevo-usuario');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal');
  const btnCancelar    = document.getElementById('btn-cancelar');
  const inputBuscar    = document.getElementById('input-buscar');
  const filtroRol      = document.getElementById('filtro-rol');
  const filtroEstado   = document.getElementById('filtro-estado');
  const modalError     = document.getElementById('modal-error');
  const passHint       = document.getElementById('pass-hint');
  const contTotal      = document.getElementById('cont-total');
  const contActivos    = document.getElementById('cont-activos');
  const contInactivos  = document.getElementById('cont-inactivos');
  const modalOverlay   = document.getElementById('modal-overlay');

  let editandoId = null;
  let paginaActual = 1;
  let registrosPorPagina = 10;
  let datosFiltrados = [];

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

  // ── Aplicar filtros y renderizar ─────────────────────────────────────────
  function renderTabla() {
    const buscar  = (inputBuscar?.value || '').toLowerCase();
    const rol     = filtroRol?.value || '';
    const estado  = filtroEstado?.value || '';
    const desde   = document.getElementById('filtro-desde')?.value || '';
    const hasta   = document.getElementById('filtro-hasta')?.value || '';

    let todos = UsuariosModel.getAll();

    // Actualizar contadores (siempre sobre el total sin filtros)
    if (contTotal)     contTotal.textContent     = todos.length;
    if (contActivos)   contActivos.textContent   = todos.filter(u => u.activo).length;
    if (contInactivos) contInactivos.textContent = todos.filter(u => !u.activo).length;

    // Aplicar filtros
    datosFiltrados = todos.filter(u => {
      if (buscar && !(
        u.nombre.toLowerCase().includes(buscar) ||
        u.username.toLowerCase().includes(buscar) ||
        u.email.toLowerCase().includes(buscar)
      )) return false;
      if (rol && u.rol !== rol) return false;
      if (estado === 'activo'   && !u.activo) return false;
      if (estado === 'inactivo' &&  u.activo) return false;
      if (desde && u.creado < desde) return false;
      if (hasta && u.creado > hasta) return false;
      return true;
    });

    paginaActual = 1;
    renderPagina();
  }

  // ── Renderizar página actual ─────────────────────────────────────────────
  function renderPagina() {
    if (!tablaBody) return;

    const total  = datosFiltrados.length;
    const todos  = UsuariosModel.getAll().length;
    const pages  = Math.max(1, Math.ceil(total / registrosPorPagina));
    paginaActual = Math.min(paginaActual, pages);
    const start  = (paginaActual - 1) * registrosPorPagina;
    const end    = Math.min(start + registrosPorPagina, total);
    const page   = datosFiltrados.slice(start, end);

    // Info de registros
    const info = document.getElementById('usr-info');
    if (info) {
      if (total === 0) {
        info.innerHTML = '<span style="color:#9ca3af;font-style:italic;">Sin resultados para los filtros aplicados</span>';
      } else if (total < todos) {
        info.innerHTML = `Mostrando <strong>${start+1}–${end}</strong> de <strong>${total}</strong> filtrados <span style="color:#9ca3af;">(${todos} total)</span>`;
      } else {
        info.innerHTML = `Mostrando <strong>${start+1}–${end}</strong> de <strong>${total}</strong> registros`;
      }
    }

    // Filas
    if (total === 0) {
      tablaBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#9ca3af;">No se encontraron usuarios con esos criterios.</td></tr>`;
    } else {
      tablaBody.innerHTML = page.map(u => {
        const badgeRol    = rolBadge(u.rol);
        const badgeEstado = u.activo
          ? '<span class="badge badge-green">Activo</span>'
          : '<span class="badge badge-red">Inactivo</span>';
        const btnToggle = u.id === 1
          ? `<button class="btn-accion btn-toggle" disabled title="No se puede desactivar al admin principal"><i class="bx bx-lock"></i></button>`
          : `<button class="btn-accion btn-toggle" onclick="toggleUsuario(${u.id})" title="${u.activo ? 'Desactivar' : 'Activar'} usuario"><i class="bx ${u.activo ? 'bx-toggle-right' : 'bx-toggle-left'}"></i></button>`;
        const avatar      = u.nombre.charAt(0).toUpperCase();
        const avatarColor = colorAvatar(u.rol);
        return `<tr class="${u.activo ? '' : 'fila-inactiva'}">
          <td><div class="user-cell">
            <div class="user-avatar-sm" style="background:${avatarColor}">${avatar}</div>
            <div><p class="user-nombre">${u.nombre}</p><p class="user-username">@${u.username}</p></div>
          </div></td>
          <td>${u.email}</td>
          <td>${badgeRol}</td>
          <td>${badgeEstado}</td>
          <td>${u.creado}</td>
          <td><div class="acciones-cell">
            <button class="btn-accion btn-editar" onclick="abrirEditar(${u.id})" title="Editar usuario"><i class="bx bx-edit"></i></button>
            ${btnToggle}
          </div></td>
        </tr>`;
      }).join('');
    }

    // Paginación
    const pag = document.getElementById('usr-pag');
    if (pag) {
      if (pages <= 1) { pag.innerHTML = ''; return; }
      let html = '';
      html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${paginaActual===1?'disabled':''} onclick="window._usrGoPage(1)">«</button>`;
      html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${paginaActual===1?'disabled':''} onclick="window._usrGoPage(${paginaActual-1})">‹</button>`;
      for (let i = Math.max(1, paginaActual-2); i <= Math.min(pages, paginaActual+2); i++) {
        html += `<button class="bsp-dt-pag-btn ${i===paginaActual?'bsp-dt-pag-active':''}" onclick="window._usrGoPage(${i})">${i}</button>`;
      }
      html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${paginaActual===pages?'disabled':''} onclick="window._usrGoPage(${paginaActual+1})">›</button>`;
      html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${paginaActual===pages?'disabled':''} onclick="window._usrGoPage(${pages})">»</button>`;
      pag.innerHTML = html;
    }
  }

  window._usrGoPage = function(n) {
    paginaActual = n;
    renderPagina();
  };

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

  // ── Submit formulario ────────────────────────────────────────────────────
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
      showToast('No permitido', resultado.error);
      return;
    }
    renderTabla();
    showToast(
      resultado.activo ? 'Usuario activado' : 'Usuario desactivado',
      resultado.activo ? 'El usuario ahora puede iniciar sesión.' : 'El usuario ha sido desactivado.'
    );
  };

  // ── Event listeners ──────────────────────────────────────────────────────
  btnNuevo.addEventListener('click', abrirCrear);
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  inputBuscar.addEventListener('input', renderTabla);
  filtroRol.addEventListener('change', renderTabla);
  filtroEstado.addEventListener('change', renderTabla);
  document.getElementById('filtro-desde')?.addEventListener('change', renderTabla);
  document.getElementById('filtro-hasta')?.addEventListener('change', renderTabla);

  // Selector de registros por página
  document.getElementById('usr-page-size')?.addEventListener('change', (e) => {
    registrosPorPagina = parseInt(e.target.value);
    paginaActual = 1;
    renderPagina();
  });

  // Limpiar todos los filtros
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
    inputBuscar.value = '';
    filtroRol.value   = '';
    filtroEstado.value = '';
    const d = document.getElementById('filtro-desde');
    const h = document.getElementById('filtro-hasta');
    if (d) d.value = '';
    if (h) h.value = '';
    renderTabla();
  });

  // ── Render inicial ────────────────────────────────────────────────────────
  renderTabla();
});
