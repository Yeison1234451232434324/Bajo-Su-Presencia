/* global supabase */
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

const SUPABASE_URL = 'https://jjpbmkydbdbqlynvqvcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGJta3lkYmRicWx5bnZxdmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODM5OTksImV4cCI6MjA5MjM1OTk5OX0.TeWVnAZx1AZ3T4Z_fB1D39g9QImVbe17jEhX6ZSXug4';

// El SDK UMD expone el global `supabase`; creamos el cliente como `sb`.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

/**
 * Devuelve el id (de la tabla usuarios) del usuario logueado, o null.
 * Lo usan los modelos para setear usuario_id al crear registros.
 */
window.miUsuarioId = async function miUsuarioId() {
  // 1) Preferir el id del JWT propio (sub = usuarios.id). Es fiable y no depende
  //    de la sesión de Supabase.
  try {
    const tok = window.bspAuth && window.bspAuth.getToken && window.bspAuth.getToken();
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]));
      if (payload && payload.sub) return payload.sub;
    }
  } catch (_) { /* sigue al fallback */ }

  // 2) Fallback: a partir de la sesión de Supabase.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('usuarios').select('id').eq('auth_id', user.id).single();
  return data?.id || null;
};
