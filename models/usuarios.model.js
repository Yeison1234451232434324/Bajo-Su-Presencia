/**
 * ============================================================
 * MODELO: usuarios.model.js  (Supabase)
 * ============================================================
 * CRUD de usuarios contra public.usuarios + Supabase Auth.
 * Métodos ASÍNCRONOS (devuelven Promesas).
 *
 * Crear un usuario implica crear su cuenta en Auth (signUp con un cliente
 * secundario para NO cerrar la sesión del admin) y luego ajustar su rol y
 * datos de perfil. El trigger handle_new_user crea la fila base en usuarios.
 *
 * Mapeo app ↔ BD:
 *   email (app) ↔ correo_electronico (BD)
 *   rol   (app) ↔ roles.nombre (vía rol_id)
 *   foto  (app) ↔ foto_url (BD)
 *   telefono/ubicacion/ocupacion (app) ↔ teléfono/ubicación/ocupación (BD, con tilde)
 *
 * Requiere window.sb y window.sbAuthTmp (controllers/supabase.client.js).
 * ============================================================
 */

const UsuariosModel = (() => {

  const TABLA = 'usuarios';

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
      nombre:       r.nombre || '',
      username:     r.username || '',
      email:        r.correo_electronico || '',
      rol:          r.roles?.nombre || 'Usuario',
      telefono:     r['teléfono']  || '',
      ubicacion:    r['ubicación'] || '',
      ocupacion:    r['ocupación'] || '',
      especialidad: r.especialidad || '',
      bio:          r.bio || '',
      foto:         r.foto_url || '',
      activo:       r.activo !== false,
      creado:       (r.creado_en || r.created_at || r.creado || '').toString().slice(0, 10)
    };
  }

  function _msg(error) {
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return 'No tienes permisos para realizar esta acción.';
    }
    return error?.message || 'Ocurrió un error al procesar la solicitud.';
  }

  function _msgAuth(error) {
    const m = (error?.message || '').toLowerCase();
    if (m.includes('already registered') || m.includes('already been registered')) {
      return 'El correo electrónico ya está registrado.';
    }
    if (m.includes('password')) return 'La contraseña no cumple los requisitos.';
    return error?.message || 'No se pudo crear la cuenta.';
  }

  // Busca el id del rol por nombre
  async function _rolId(nombreRol) {
    const { data } = await sb.from('roles').select('id').eq('nombre', nombreRol).single();
    return data?.id || null;
  }

  // ── Lectura ────────────────────────────────────────────────────────────────
  async function getAll() {
    const { data, error } = await sb
      .from(TABLA)
      .select('*, roles(nombre)')
      .order('nombre', { ascending: true });
    if (error) { console.error('UsuariosModel.getAll:', error); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await sb.from(TABLA).select('*, roles(nombre)').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function getByUsername(username) {
    if (!username) return null;
    const { data } = await sb.from(TABLA).select('*, roles(nombre)').ilike('username', username).limit(1);
    return data && data[0] ? _fromRow(data[0]) : null;
  }

  // ── Crear (Auth signUp + perfil) ─────────────────────────────────────────
  async function create(data) {
    if (!data.email?.trim())    return { ok: false, error: 'El correo es obligatorio.' };
    if (!data.password)         return { ok: false, error: 'La contraseña es obligatoria.' };

    // 1) Crear la cuenta en Auth con un cliente secundario (no cierra la sesión del admin)
    const tmp = window.sbAuthTmp();
    const { data: signUp, error: signUpError } = await tmp.auth.signUp({
      email:    data.email.trim().toLowerCase(),
      password: data.password,
      options:  { data: { nombre: data.nombre } }
    });
    if (signUpError)        return { ok: false, error: _msgAuth(signUpError) };
    const authId = signUp.user?.id;
    if (!authId)            return { ok: false, error: 'No se pudo crear la cuenta de acceso.' };

    // 2) El trigger ya creó la fila base; la actualizamos con rol + datos de perfil
    const rolId = await _rolId(data.rol);
    const { data: upd, error: updError } = await sb
      .from(TABLA)
      .update({
        nombre:        data.nombre,
        username:      data.username || null,
        rol_id:        rolId,
        'teléfono':    data.telefono || null,
        'ubicación':   data.ubicacion || null,
        'ocupación':   data.ocupacion || null,
        especialidad:  data.especialidad || null,
        bio:           data.bio || null,
        activo:        true
      })
      .eq('auth_id', authId)
      .select('*, roles(nombre)')
      .single();

    if (updError) return { ok: false, error: _msg(updError) };
    return { ok: true, user: upd ? _fromRow(upd) : null };
  }

  // ── Actualizar perfil (no cambia correo ni contraseña de Auth) ───────────
  async function update(id, data) {
    const rolId = await _rolId(data.rol);
    const campos = {
      nombre:       data.nombre,
      username:     data.username || null,
      rol_id:       rolId,
      'teléfono':   data.telefono || null,
      'ubicación':  data.ubicacion || null,
      'ocupación':  data.ocupacion || null,
      especialidad: data.especialidad || null,
      bio:          data.bio || null,
      // foto solo si el formulario la envía (perfil); el admin no la toca
      ...(data.foto !== undefined ? { foto_url: data.foto || null } : {})
    };
    const { data: upd, error } = await sb
      .from(TABLA).update(campos).eq('id', id).select('*, roles(nombre)').single();
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, user: upd ? _fromRow(upd) : null };
  }

  // ── Activar / Desactivar ─────────────────────────────────────────────────
  async function toggleActivo(id) {
    const actual = await getById(id);
    if (!actual) return { ok: false, error: 'Usuario no encontrado.' };
    const nuevo = !actual.activo;
    const { error } = await sb.from(TABLA).update({ activo: nuevo }).eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true, activo: nuevo };
  }

  // ── Eliminar perfil ──────────────────────────────────────────────────────
  // Nota: borra la fila de usuarios. La cuenta de Auth permanece (eliminarla
  // requiere service role / Edge Function); para purga total bórrala también
  // desde Authentication en el dashboard.
  async function remove(id) {
    const { error } = await sb.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  // ── Especialistas (usuarios activos con especialidad) ────────────────────
  async function getEspecialistas() {
    const todos = await getAll();
    return todos.filter(u => u.activo && u.especialidad && u.especialidad.trim() !== '');
  }

  return { getAll, getById, getByUsername, create, update, toggleActivo, remove, getEspecialistas, ESPECIALIDADES };

})();
