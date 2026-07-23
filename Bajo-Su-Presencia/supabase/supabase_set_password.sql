-- ============================================================================
--  FIJAR CONTRASEÑA DE SUPABASE AUTH — Bajo Su Presencia
--  La columna usuarios.contrasena_hash NO es la clave de Supabase. La clave
--  real vive en auth.users.encrypted_password. Aquí la fijamos a un valor
--  conocido para poder iniciar sesión. Cambia el correo/clave si quieres.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ► Fija la contraseña de Supabase Auth del admin
update auth.users
set encrypted_password = extensions.crypt('Admin123*', extensions.gen_salt('bf')),
    email_confirmed_at  = coalesce(email_confirmed_at, now())   -- asegura correo confirmado
where email = 'yeisonvargas8022@gmail.com';

-- Verificación: debe salir 1 fila con tiene_clave = true y email_confirmed_at con fecha
select email,
       (encrypted_password is not null) as tiene_clave,
       email_confirmed_at
from auth.users
where email = 'yeisonvargas8022@gmail.com';
