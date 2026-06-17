-- ============================================================================
--  FIX LOGIN DE UN USUARIO — Bajo Su Presencia
--  Repara una cuenta de Auth para que pueda iniciar sesión por contraseña:
--   - fija contraseña conocida
--   - confirma el correo
--   - asegura aud/role = 'authenticated'
--   - crea la identidad de email si falta (causa común de "Invalid credentials")
--  Cambia v_correo / v_pass si quieres.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_correo text := 'yeisonvargas8022@gmail.com';
  v_pass   text := 'Admin123*';
  v_id     uuid;
begin
  select id into v_id from auth.users where email = v_correo;
  if v_id is null then
    raise exception 'No existe % en auth.users', v_correo;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         aud  = 'authenticated',
         role = 'authenticated'
   where id = v_id;

  if not exists (
    select 1 from auth.identities where user_id = v_id and provider = 'email'
  ) then
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- Diagnóstico: estado final de la cuenta
select u.email,
       (u.encrypted_password is not null) as tiene_pass,
       (u.email_confirmed_at is not null) as correo_confirmado,
       u.aud, u.role,
       exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email') as tiene_identidad
from auth.users u
where u.email = 'yeisonvargas8022@gmail.com';
