-- ============================================================================
--  PROMOVER A ADMIN — Bajo Su Presencia
--  Úsalo DESPUÉS de crear el usuario en Authentication → Add user.
--  Lo enlaza a "usuarios" y le pone rol Administrador. Re-ejecutable.
--  Cambia 'admin@correo.com' por el correo que creaste si usaste otro.
-- ============================================================================

do $$
declare
  v_correo text := 'admin@correo.com';   -- <<< el correo que creaste en el dashboard
  v_auth   uuid;
  v_admin  uuid;
begin
  select id into v_auth  from auth.users  where email = v_correo;
  select id into v_admin from public.roles where nombre = 'Administrador';

  if v_auth is null then
    raise exception 'No existe usuario de Auth con el correo %. Créalo primero en Authentication → Add user.', v_correo;
  end if;
  if v_admin is null then
    insert into public.roles (nombre) values ('Administrador') returning id into v_admin;
  end if;

  -- Si ya hay fila para ese correo (la creó el trigger), la enlaza y la hace admin
  update public.usuarios
     set auth_id = v_auth, rol_id = v_admin, activo = true
   where correo_electronico = v_correo;

  -- Si no existía, la crea
  if not found then
    insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
    values (v_auth, 'Administrador', v_correo, 'auth', v_admin, true);
  end if;
end $$;

-- Verifica: debe salir la fila del admin enlazada
select u.email, p.nombre, r.nombre as rol, p.activo
from auth.users u
join public.usuarios p on p.auth_id = u.id
join public.roles    r on r.id = p.rol_id
where u.email = 'admin@correo.com';
