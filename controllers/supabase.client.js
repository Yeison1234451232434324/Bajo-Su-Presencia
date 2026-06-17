/**
 * ============================================================
 * CLIENTE SUPABASE COMPARTIDO
 * ============================================================
 * Crea una única instancia del cliente de Supabase para toda la
 * app web y la expone como `window.sb`.
 *
 * Requiere que ANTES se haya cargado el SDK por CDN:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="../../../controllers/supabase.client.js"></script>
 *
 * IMPORTANTE: aquí va SOLO la "anon key" (es pública y segura para el
 * navegador). NUNCA pongas la "service/secret key" en el frontend.
 * ============================================================
 */

const SUPABASE_URL      = 'https://jjpbmkydbdbqlynvqvcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGJta3lkYmRicWx5bnZxdmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODM5OTksImV4cCI6MjA5MjM1OTk5OX0.TeWVnAZx1AZ3T4Z_fB1D39g9QImVbe17jEhX6ZSXug4';

// El SDK UMD expone el global `supabase`; creamos el cliente como `sb`.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

/**
 * Cliente secundario para registrar usuarios (signUp) SIN tocar la sesión del
 * admin actual. Usa persistSession:false para no sobrescribir el token guardado.
 * Lo usa el módulo de usuarios al crear cuentas desde el panel.
 */
window.sbAuthTmp = function () {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

/**
 * Devuelve el id (de la tabla usuarios) del usuario logueado, o null.
 * Lo usan los modelos para setear usuario_id al crear registros.
 */
window.miUsuarioId = async function () {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('usuarios').select('id').eq('auth_id', user.id).single();
  return data?.id || null;
};
