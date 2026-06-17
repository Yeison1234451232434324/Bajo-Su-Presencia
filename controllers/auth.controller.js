/**
 * ============================================================
 * AUTH CONTROLLER — Login con Supabase Auth
 * ============================================================
 * Flujo:
 *   1. signInWithPassword({ email, password })  → valida contra auth.users
 *   2. Lee el perfil/rol del usuario en la tabla "usuarios" (join roles)
 *   3. Guarda { nombre, rol } en localStorage (lo usa el sidebar)
 *   4. Redirige al panel según el rol
 * ============================================================
 */

const RUTAS_POR_ROL = {
  'Administrador': '../../dashboard/admin/dashboard.html',
  'Colaborador':   '../../dashboard/colaborador/eventos.html',
  'Voluntario':    '../../dashboard/voluntario/calificaciones.html'
};

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const emailVal = document.getElementById('email').value.trim();
  const pass     = document.getElementById('password').value.trim();

  if (typeof sb === 'undefined') {
    showAlertError('No se pudo conectar con el servidor. Recarga la página e intenta de nuevo.');
    return;
  }

  // ── 1. Autenticar contra Supabase Auth ──────────────────────────────────
  const { data: auth, error: authError } = await sb.auth.signInWithPassword({
    email: emailVal, password: pass
  });

  if (authError || !auth?.user) {
    showAlertError('Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.');
    return;
  }

  // ── 2. Obtener el perfil y el rol desde la tabla "usuarios" ──────────────
  const { data: perfil, error: perfilError } = await sb
    .from('usuarios')
    .select('nombre, activo, roles(nombre)')
    .eq('auth_id', auth.user.id)
    .single();

  if (perfilError || !perfil) {
    showAlertError('Tu cuenta no tiene un perfil asignado. Contacta al administrador.');
    await sb.auth.signOut();
    return;
  }

  if (perfil.activo === false) {
    showAlertError('Tu cuenta está desactivada. Contacta al administrador.');
    await sb.auth.signOut();
    return;
  }

  const rol = perfil.roles?.nombre || 'Usuario';

  // ── 3. Guardar sesión para el sidebar ───────────────────────────────────
  localStorage.setItem('usuarioLogueado', JSON.stringify({ nombre: perfil.nombre, rol: rol }));

  // ── 4. Redirigir según el rol ───────────────────────────────────────────
  const url = RUTAS_POR_ROL[rol];
  if (!url) {
    // El rol "Usuario" (miembro) pertenece a la app móvil, no al panel web.
    showAlertError('Este rol no tiene acceso al panel web.');
    await sb.auth.signOut();
    return;
  }

  window.location.href = url;
});
