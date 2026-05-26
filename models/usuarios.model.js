/**
 * Usuarios Model
 * Gestiona el almacenamiento y recuperación de usuarios usando localStorage.
 * Solo el administrador puede operar sobre este modelo.
 */

const UsuariosModel = (() => {

  const STORAGE_KEY = 'bsp_usuarios';

  // ── Usuarios por defecto (se cargan si localStorage está vacío) ──────────
  const DEFAULT_USERS = [
    {
      id:       1,
      nombre:   'Admin Principal',
      username: 'admin',
      email:    'admin@correo.com',
      password: '123',
      rol:      'Administrador',
      activo:   true,
      creado:   '2025-01-01'
    },
    {
      id:       2,
      nombre:   'Juan Colaborador',
      username: 'usuario',
      email:    'usuario@correo.com',
      password: '123',
      rol:      'Colaborador',
      activo:   true,
      creado:   '2025-03-15'
    },
    {
      id:       3,
      nombre:   'Pedro Voluntario',
      username: 'voluntario',
      email:    'voluntario@correo.com',
      password: '123',
      rol:      'Voluntario',
      activo:   true,
      creado:   '2025-04-10'
    }
  ];

  // ── Inicializar storage ──────────────────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    }
  }

  // ── Obtener todos los usuarios ───────────────────────────────────────────
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  }

  // ── Obtener usuario por ID ───────────────────────────────────────────────
  function getById(id) {
    return getAll().find(u => u.id === id) || null;
  }

  // ── Crear usuario ────────────────────────────────────────────────────────
  function create(data) {
    const users = getAll();

    // Validar unicidad de username y email
    if (users.some(u => u.username === data.username)) {
      return { ok: false, error: 'El nombre de usuario ya existe.' };
    }
    if (users.some(u => u.email === data.email)) {
      return { ok: false, error: 'El correo electrónico ya está registrado.' };
    }

    const newUser = {
      id:       Date.now(),
      nombre:   data.nombre.trim(),
      username: data.username.trim(),
      email:    data.email.trim(),
      password: data.password,
      rol:      data.rol,
      activo:   true,
      creado:   new Date().toISOString().split('T')[0]
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    return { ok: true, user: newUser };
  }

  // ── Actualizar usuario ───────────────────────────────────────────────────
  function update(id, data) {
    const users = getAll();
    const idx   = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'Usuario no encontrado.' };

    // Validar unicidad excluyendo el propio usuario
    if (users.some(u => u.username === data.username && u.id !== id)) {
      return { ok: false, error: 'El nombre de usuario ya existe.' };
    }
    if (users.some(u => u.email === data.email && u.id !== id)) {
      return { ok: false, error: 'El correo electrónico ya está registrado.' };
    }

    users[idx] = {
      ...users[idx],
      nombre:   data.nombre.trim(),
      username: data.username.trim(),
      email:    data.email.trim(),
      rol:      data.rol,
      // Solo actualizar contraseña si se proporcionó una nueva
      ...(data.password ? { password: data.password } : {})
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    return { ok: true, user: users[idx] };
  }

  // ── Activar / Desactivar usuario ─────────────────────────────────────────
  function toggleActivo(id) {
    const users = getAll();
    const idx   = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'Usuario no encontrado.' };

    // No permitir desactivar al admin principal (id 1)
    if (users[idx].rol === 'Administrador' && users[idx].id === 1) {
      return { ok: false, error: 'No se puede desactivar al administrador principal.' };
    }

    users[idx].activo = !users[idx].activo;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    return { ok: true, activo: users[idx].activo };
  }

  // ── Eliminar usuario ─────────────────────────────────────────────────────
  function remove(id) {
    const users = getAll();
    const target = users.find(u => u.id === id);
    if (!target) return { ok: false, error: 'Usuario no encontrado.' };
    if (target.rol === 'Administrador' && target.id === 1) {
      return { ok: false, error: 'No se puede eliminar al administrador principal.' };
    }
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { ok: true };
  }

  return { getAll, getById, create, update, toggleActivo, remove };

})();
