/**
 * ============================================================
 * MODELO: usuarios.model.js  (backend PHP)
 * ============================================================
 * CRUD de usuarios contra el backend PHP (/api/usuarios), que a su vez habla
 * con Supabase (Auth admin + tabla usuarios) usando la service_role key.
 * Métodos ASÍNCRONOS (devuelven Promesas).
 *
 * Mantiene la MISMA interfaz y forma de datos que la versión anterior, por lo
 * que usuarios.controller.js no requiere cambios.
 *
 * Mapeo app ↔ BD (esquema certificado):
 *   email (app) ↔ correo_electronico (BD)
 *   rol   (app) ↔ roles.nombre (vía rol_id)
 *   foto  (app) ↔ foto_url (BD)
 *   telefono/ubicacion/ocupacion coinciden (ya sin tildes en BD)
 *   especialidad (app) ↔ usuario_especialidades → especialidades.nombre
 *     (catálogo N:M; el backend embebe la relación y sincroniza al guardar)
 *
 * Requiere window.apiFetch (config/api.config.js) y una sesión iniciada
 * (JWT propio) con rol Administrador.
 * ============================================================
 */

const UsuariosModel = (() => {

  // Catálogo de especialidades (lista blanca para el formulario)
  const ESPECIALIDADES = [
    'Música / Alabanza', 'Sonido y Audio', 'Multimedia / Proyección', 'Logística',
    'Cocina', 'Ministerio Infantil', 'Predicación / Enseñanza', 'Decoración',
    'Ujieres / Protocolo', 'Primeros Auxilios', 'Transporte', 'Fotografía / Video'
  ];

  // ── Mapear fila BD → objeto de la vista ──────────────────────────────────
  function _fromRow(r) {
    return {
      id:           r.id,
      auth_id:      r.auth_id || null,
      nombre:       r.nombre_completo || r.nombre || '',  // generada en BD: nombres + apellidos (solo lectura)
      nombres:      r.nombres || '',
      apellidos:    r.apellidos || '',
      username:     r.username || '',
      email:        r.correo_electronico || '',
      rol:          r.roles?.nombre || 'Usuario',
      telefono:     r.telefono  || '',
      ubicacion:    r.ubicacion || '',
      ocupacion:    r.ocupacion || '',
      especialidad: r.usuario_especialidades?.[0]?.especialidades?.nombre || '',
      bio:          r.bio || '',
      foto:         r.foto_url || '',
      activo:       r.activo !== false,
      creado:       (r.creado_en || r.created_at || r.creado || '').toString().slice(0, 10)
    };
  }

  // ── Lectura ────────────────────────────────────────────────────────────────
  async function getAll() {
    try {
      const rows = await apiFetch('/api/usuarios');
      return (rows || []).map(_fromRow);
    } catch (e) { (window.BSPLog ? window.BSPLog.error('UsuariosModel.getAll', e.message) : console.error('UsuariosModel.getAll')); return []; }
  }

  async function getById(id) {
    try {
      const row = await apiFetch(`/api/usuarios/${id}`);
      return row ? _fromRow(row) : null;
    } catch (_) { return null; }
  }

  async function getByUsername(username) {
    if (!username) return null;
    const todos = await getAll();
    const u = todos.find(x => (x.username || '').toLowerCase() === username.toLowerCase());
    return u || null;
  }

  // ── Perfil propio (cualquier usuario autenticado) ────────────────────────
  async function getMiPerfil() {
    try {
      const row = await apiFetch('/api/usuarios/mi-perfil');
      return row ? _fromRow(row) : null;
    } catch (_) { return null; }
  }

  async function updateMiPerfil(data) {
    try {
      const row = await apiFetch('/api/usuarios/mi-perfil', { method: 'PUT', body: data });
      return { ok: true, user: row ? _fromRow(row) : null };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Crear (cuenta Auth + perfil, vía backend) ────────────────────────────
  async function crear(data) {
    if (!data.email?.trim()) return { ok: false, error: 'El correo es obligatorio.' };
    if (!data.password)      return { ok: false, error: 'La contraseña es obligatoria.' };
    try {
      const row = await apiFetch('/api/usuarios', { method: 'POST', body: data });
      return { ok: true, user: row ? _fromRow(row) : null };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Actualizar perfil ────────────────────────────────────────────────────
  async function actualizar(id, data) {
    try {
      const row = await apiFetch(`/api/usuarios/${id}`, { method: 'PUT', body: data });
      return { ok: true, user: row ? _fromRow(row) : null };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Activar / Desactivar ─────────────────────────────────────────────────
  async function toggleActivo(id) {
    try {
      const data = await apiFetch(`/api/usuarios/${id}/activo`, { method: 'PATCH' });
      return { ok: true, activo: data?.activo };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Eliminar perfil ──────────────────────────────────────────────────────
  async function eliminar(id) {
    try {
      await apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Especialistas (usuarios activos con especialidad) ────────────────────
  async function getEspecialistas() {
    try {
      const rows = await apiFetch('/api/usuarios/especialistas');
      return (rows || []).map(_fromRow);
    } catch (_) { return []; }
  }

  return { getAll, getById, getByUsername, getMiPerfil, updateMiPerfil, crear, actualizar, toggleActivo, eliminar, getEspecialistas, ESPECIALIDADES };

})();
