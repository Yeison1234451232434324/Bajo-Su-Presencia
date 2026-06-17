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

  // Modal de perfil
  const modalPerfil      = document.getElementById('modal-perfil');
  const btnCerrarPerfil  = document.getElementById('btn-cerrar-perfil');
  const btnPerfilCerrar  = document.getElementById('btn-perfil-cerrar');
  const btnPerfilEditar  = document.getElementById('btn-perfil-editar');

  let editandoId = null;

  // ── Poblar las sugerencias de especialidad (texto libre permitido) ───────
  const datalistEsp = document.getElementById('especialidades-sugeridas');
  if (datalistEsp && Array.isArray(UsuariosModel.ESPECIALIDADES)) {
    UsuariosModel.ESPECIALIDADES.forEach(esp => {
      const opt = document.createElement('option');
      opt.value = esp;
      datalistEsp.appendChild(opt);
    });
  }

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

  async function renderTabla() {
    const todos = await UsuariosModel.getAll();

    // Actualizar contadores
    if (contTotal)     contTotal.textContent     = todos.length;
    if (contActivos)   contActivos.textContent   = todos.filter(u => u.activo).length;
    if (contInactivos) contInactivos.textContent = todos.filter(u => !u.activo).length;

    const data = todos.map(u => ({
      ...u,
      estadoTexto: u.activo ? 'Activo' : 'Inactivo'
    }));

    // Opciones del filtro de especialidad: derivadas de los datos reales
    // (texto libre) combinadas con las sugerencias del catálogo.
    const especialidadesUsadas = [...new Set(todos.map(u => u.especialidad).filter(Boolean))];
    const opcionesEspecialidad = [...new Set([...especialidadesUsadas, ...(UsuariosModel.ESPECIALIDADES || [])])].sort();

    function renderRow(u) {
      const badgeRol    = rolBadge(u.rol);
      const badgeEstado = u.activo
        ? '<span class="badge badge-green">Activo</span>'
        : '<span class="badge badge-red">Inactivo</span>';
      const btnToggle = u.id === 1
        ? `<button class="btn-accion btn-toggle" disabled title="No se puede desactivar al admin principal"><i class="bx bx-lock"></i></button>`
        : `<button class="btn-accion btn-toggle" onclick="toggleUsuario('${u.id}')" title="${u.activo ? 'Desactivar' : 'Activar'}"><i class="bx ${u.activo ? 'bx-toggle-right' : 'bx-toggle-left'}"></i></button>`;
      const avatar      = u.nombre.charAt(0).toUpperCase();
      const avatarColor = colorAvatar(u.rol);
      const avatarHTML  = u.foto
        ? `<div class="user-avatar-sm user-avatar-foto"><img src="${u.foto}" alt="${u.nombre}" /></div>`
        : `<div class="user-avatar-sm" style="background:${avatarColor}">${avatar}</div>`;
      return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.875rem 1.25rem;
          background:#fff;border:2px solid var(--border);border-radius:1rem;margin-bottom:0.5rem;
          flex-wrap:wrap;${u.activo ? '' : 'opacity:0.65;background:#fafafa;'}">
          <div class="user-cell" style="flex:2;min-width:180px;">
            ${avatarHTML}
            <div>
              <p class="user-nombre">${u.nombre}</p>
              <p class="user-username">@${u.username}</p>
            </div>
          </div>
          <span style="flex:2;min-width:140px;font-size:0.875rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.email}</span>
          <span style="flex-shrink:0;">${badgeRol}</span>
          <span style="flex-shrink:0;">${u.especialidad ? `<span class="badge badge-especialidad">${u.especialidad}</span>` : ''}</span>
          <span style="flex-shrink:0;">${badgeEstado}</span>
          <span style="flex-shrink:0;font-size:0.82rem;color:var(--muted);">${u.creado}</span>
          <div class="acciones-cell" style="flex-shrink:0;margin-left:auto;">
            <button class="btn-accion btn-ver" onclick="verPerfil('${u.id}')" title="Ver perfil"><i class="bx bx-id-card"></i></button>
            <button class="btn-accion btn-editar" onclick="abrirEditar('${u.id}')" title="Editar usuario"><i class="bx bx-edit"></i></button>
            ${btnToggle}
          </div>
        </div>`;
    }

    if (!dtUsuarios) {
      dtUsuarios = new BSPDataTable({
        containerId:  'dt-usuarios',
        data,
        pageSize:     10,
        searchFields: ['nombre', 'username', 'email', 'especialidad', 'ocupacion', 'ubicacion'],
        filters: [
          { key: 'rol',          label: 'Rol',          type: 'select', options: ['Administrador', 'Colaborador', 'Voluntario'] },
          { key: 'especialidad', label: 'Especialidad', type: 'select', options: opcionesEspecialidad },
          { key: 'estadoTexto',  label: 'Estado',       type: 'select', options: ['Activo', 'Inactivo'] },
          { key: 'creado', label: 'Desde', type: 'date-from' },
          { key: 'creado', label: 'Hasta', type: 'date-to'   },
        ],
        renderRow,
        exportable:   true,
        exportName:   'usuarios',
        exportFields: ['nombre', 'username', 'email', 'rol', 'especialidad', 'ocupacion', 'ubicacion', 'telefono', 'estadoTexto', 'creado'],
        exportLabels: ['Nombre', 'Usuario', 'Correo', 'Rol', 'Especialidad', 'Ocupación', 'Ubicación', 'Teléfono', 'Estado', 'Registrado'],
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
  window.abrirEditar = async function(id) {
    const u = await UsuariosModel.getById(id);
    if (!u) return;
    editandoId = id;
    modalTitle.textContent = 'Editar Usuario';
    document.getElementById('campo-nombre').value    = u.nombre;
    document.getElementById('campo-username').value  = u.username;
    document.getElementById('campo-email').value     = u.email;
    document.getElementById('campo-rol').value       = u.rol;
    document.getElementById('campo-telefono').value    = u.telefono     || '';
    document.getElementById('campo-ubicacion').value   = u.ubicacion    || '';
    document.getElementById('campo-ocupacion').value   = u.ocupacion    || '';
    document.getElementById('campo-especialidad').value = u.especialidad || '';
    document.getElementById('campo-bio').value         = u.bio          || '';
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

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const RX_USERNAME = /^[a-zA-Z0-9_]+$/;
  const ROLES_VALIDOS = ['Administrador', 'Colaborador', 'Voluntario'];

  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids) => BSPVal._ok(...ids);

  // ── Submit formulario ────────────────────────────────────────────────────
  formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    /* Leer valores — todos trimados antes de validar y antes de guardar */
    const nombre   = BSPVal.cleanText(document.getElementById('campo-nombre').value);
    const username = document.getElementById('campo-username').value.trim().toLowerCase();
    const emailVal = document.getElementById('campo-email').value.trim().toLowerCase();
    const rol      = document.getElementById('campo-rol').value;
    const password = document.getElementById('campo-password').value; // sin trim: los espacios son intencionales como error
    const telefono    = BSPVal.cleanText(document.getElementById('campo-telefono').value);
    const ubicacion   = BSPVal.cleanText(document.getElementById('campo-ubicacion').value);
    const ocupacion   = BSPVal.cleanText(document.getElementById('campo-ocupacion').value);
    const especialidad = BSPVal.cleanText(document.getElementById('campo-especialidad').value);
    const bio         = BSPVal.cleanText(document.getElementById('campo-bio').value);

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('campo-nombre','campo-username','campo-email','campo-rol','campo-password','campo-especialidad');
    let valido = true;

    /* Nombre completo: mínimo 3, máximo 80, solo letras */
    let err;
    err = BSPVal.txt(nombre, { min: 3, max: 80, label: 'El nombre' });
    if (err) { _err('campo-nombre', err); valido = false; }
    else {
      err = BSPVal.soloLetras(nombre, { label: 'El nombre' });
      if (err) { _err('campo-nombre', err); valido = false; }
    }

    /* Username: mínimo 3, máximo 30, solo alfanumérico + _ */
    if (!username || username.length < 3) {
      _err('campo-username', 'El usuario debe tener al menos 3 caracteres.'); valido = false;
    } else if (!RX_USERNAME.test(username)) {
      _err('campo-username', 'Solo letras, números y guión bajo (_). Sin espacios.'); valido = false;
    } else if (username.length > 30) {
      _err('campo-username', 'El usuario no puede superar 30 caracteres.'); valido = false;
    }

    /* Email: regex estricta, máximo 254 chars */
    err = BSPVal.email(emailVal);
    if (err) { _err('campo-email', err); valido = false; }

    /* Rol: validado contra lista blanca — previene manipulación del DOM */
    err = BSPVal.select(rol, ROLES_VALIDOS, { label: 'El rol' });
    if (err) { _err('campo-rol', err); valido = false; }

    /* Contraseña (solo obligatoria al crear): mínimo 6, mezcla letras+números, sin espacios */
    if (editandoId === null) {
      err = BSPVal.password(password, { min: 6 });
      if (err) { _err('campo-password', err); valido = false; }
    }

    /* Especialidad: texto libre opcional, máximo 80 caracteres */
    if (especialidad.length > 80) {
      _err('campo-especialidad', 'La especialidad no puede superar 80 caracteres.'); valido = false;
    }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Enviar datos limpios al modelo — never raw .value */
    const data = { nombre, username, email: emailVal, rol, password, telefono, ubicacion, ocupacion, especialidad, bio };

    /* Llamada async al modelo (Supabase) */
    let resultado;
    try {
      resultado = editandoId === null
        ? await UsuariosModel.create(data)
        : await UsuariosModel.update(editandoId, data);
    } catch (ex) {
      modalError.textContent = 'Error de conexión. Revisa tu internet e intenta de nuevo.';
      modalError.style.display = 'block';
      return;
    }
    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }
    cerrarModal();
    await renderTabla();
    showAlertSuccess(
      editandoId === null
        ? `El usuario "${data.nombre}" fue creado exitosamente.`
        : `Los datos de "${data.nombre}" fueron actualizados.`
    );
  });

  // ── Toggle activo/inactivo ───────────────────────────────────────────────
  window.toggleUsuario = async function(id) {
    const resultado = await UsuariosModel.toggleActivo(id);
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }
    await renderTabla();
    showAlertSuccess(
      resultado.activo ? 'El usuario ahora puede iniciar sesión.' : 'El usuario ha sido desactivado.'
    );
  };

  // ── Modal VER PERFIL ───────────────────────────────────────────────────
  let perfilViendoId = null;

  function _filaPerfil(icono, label, valor) {
    if (!valor) return '';
    return `
      <div class="perfil-row">
        <i class="bx ${icono}"></i>
        <div>
          <p class="perfil-row-label">${label}</p>
          <p class="perfil-row-valor">${valor}</p>
        </div>
      </div>`;
  }

  window.verPerfil = async function(id) {
    const u = await UsuariosModel.getById(id);
    if (!u) return;
    perfilViendoId = id;

    const avatar      = document.getElementById('perfil-avatar');
    if (u.foto) {
      avatar.innerHTML        = `<img src="${u.foto}" alt="${u.nombre}" class="perfil-avatar-img" />`;
      avatar.style.background = 'transparent';
    } else {
      avatar.innerHTML        = '';
      avatar.textContent      = u.nombre.charAt(0).toUpperCase();
      avatar.style.background = colorAvatar(u.rol);
    }

    document.getElementById('perfil-nombre').textContent   = u.nombre;
    document.getElementById('perfil-username').textContent = '@' + u.username;

    const estadoBadge = u.activo
      ? '<span class="badge badge-green">Activo</span>'
      : '<span class="badge badge-red">Inactivo</span>';
    const espBadge = u.especialidad ? `<span class="badge badge-especialidad">${u.especialidad}</span>` : '';
    document.getElementById('perfil-badges').innerHTML = rolBadge(u.rol) + espBadge + estadoBadge;

    document.getElementById('perfil-info').innerHTML =
      _filaPerfil('bx-envelope',  'Correo',        u.email) +
      _filaPerfil('bx-phone',     'Teléfono',      u.telefono) +
      _filaPerfil('bx-map',       'Ubicación',     u.ubicacion) +
      _filaPerfil('bx-briefcase', 'A qué se dedica', u.ocupacion) +
      _filaPerfil('bx-star',      'Especialidad',  u.especialidad || 'Ninguna') +
      _filaPerfil('bx-note',      'Información adicional', u.bio) +
      _filaPerfil('bx-calendar',  'Registrado',    u.creado);

    modalPerfil.classList.add('visible');
    modalOverlay.classList.add('visible');
  };

  function cerrarPerfil() {
    modalPerfil.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    perfilViendoId = null;
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  btnNuevo.addEventListener('click', abrirCrear);
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', () => { cerrarModal(); cerrarPerfil(); });
  btnCerrarPerfil.addEventListener('click', cerrarPerfil);
  btnPerfilCerrar.addEventListener('click', cerrarPerfil);
  btnPerfilEditar.addEventListener('click', () => {
    const id = perfilViendoId;
    cerrarPerfil();
    if (id !== null) window.abrirEditar(id);
  });

  // ── Restricciones HTML dinámicas ─────────────────────────────────────────
  [['campo-nombre', 80], ['campo-username', 30], ['campo-telefono', 20],
   ['campo-ubicacion', 120], ['campo-ocupacion', 100], ['campo-bio', 500]].forEach(([id, max]) => {
    const el = document.getElementById(id);
    if (el) el.maxLength = max;
  });

  // ── Render inicial ────────────────────────────────────────────────────────
  renderTabla();
});
