-- ============================================================================
--  FIX LOGIN — Bajo Su Presencia
--  Soluciona "Database error saving new user" al crear usuarios en Auth.
--  El trigger queda BLINDADO: si algo falla creando la fila en "usuarios",
--  NO bloquea la creación de la cuenta en Auth (solo deja un warning).
--  Re-ejecutable.
-- ============================================================================

-- 1) Asegura que exista el rol 'Usuario' (lo necesita el trigger)
insert into public.roles (nombre)
select 'Usuario'
where not exists (select 1 from public.roles where nombre = 'Usuario');

-- 2) Trigger blindado
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol uuid;
begin
  begin
    select id into v_rol from public.roles where nombre = 'Usuario' limit 1;

    -- Si ya existe fila con ese correo, solo la enlaza (conserva su rol)
    update public.usuarios
       set auth_id = new.id
     where correo_electronico = new.email and auth_id is null;

    -- Si no existía, crea un miembro nuevo
    if not found then
      insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
        new.email,
        'auth',
        v_rol,
        true
      );
    end if;
  exception when others then
    -- Nunca bloquear el alta en Auth. El perfil se puede enlazar luego (paso 4).
    raise warning 'handle_new_user falló para %: %', new.email, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- 3) Crea el usuario ADMIN en:  Authentication → Users → Add user
--    - Email:    pon tu correo (ej. yeisonvargas8022@gmail.com)
--    - Password: la que quieras
--    - Marca "Auto Confirm User"
--    (con el trigger blindado ya NO dará "Database error")
-- ============================================================================


-- ============================================================================
-- 4) Enlaza ese usuario a "usuarios" con rol Administrador.
--    Reemplaza 'TU_CORREO' por el correo que usaste en el paso 3.
-- ============================================================================
do $$
declare
  v_correo text := 'TU_CORREO';   -- <<< CAMBIA ESTO
  v_auth   uuid;
  v_admin  uuid;
begin
  select id into v_auth  from auth.users  where email = v_correo;
  select id into v_admin from public.roles where nombre = 'Administrador';

  if v_auth is null then
    raise exception 'No existe un usuario de Auth con el correo %. Créalo primero (paso 3).', v_correo;
  end if;

  -- Si ya hay fila con ese correo, la enlaza y la hace admin
  update public.usuarios
     set auth_id = v_auth, rol_id = v_admin, activo = true
   where correo_electronico = v_correo;

  -- Si no existía, la crea
  if not found then
    insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
    values (v_auth, 'Administrador', v_correo, 'auth', v_admin, true);
  end if;
end $$;


-- 5) Verifica:
--    select u.nombre, u.correo_electronico, r.nombre as rol, u.auth_id
--    from usuarios u left join roles r on r.id = u.rol_id
--    where u.auth_id is not null;
-- ============================================================================
