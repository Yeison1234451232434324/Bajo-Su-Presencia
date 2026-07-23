-- ============================================================================
--  BACKFILL DE PERFILES — Bajo Su Presencia
--  Crea/enlaza la fila en "usuarios" para cada usuario de Auth que no la tenga
--  (los 6 huérfanos creados antes de que el trigger funcionara).
--  Seguro y re-ejecutable.
-- ============================================================================

do $$
declare
  a     record;
  v_rol uuid;
begin
  select id into v_rol from public.roles where nombre = 'Usuario';

  for a in select id, email, raw_user_meta_data from auth.users loop
    -- ya tiene perfil enlazado → saltar
    if exists (select 1 from public.usuarios where auth_id = a.id) then
      continue;
    end if;

    -- ¿existe una fila con ese correo sin enlazar? → enlazarla (conserva su rol)
    update public.usuarios set auth_id = a.id
     where correo_electronico = a.email and auth_id is null;

    -- si no, crear perfil nuevo con rol 'Usuario'
    if not found then
      insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
      values (a.id,
              coalesce(a.raw_user_meta_data->>'nombre', split_part(a.email, '@', 1)),
              a.email, 'auth', v_rol, true);
    end if;
  end loop;
end $$;

-- Lista TODOS los usuarios de Auth con su perfil y rol.
-- Elige de aquí cuál será el admin (usa un correo cuya contraseña conozcas).
select u.email,
       p.nombre,
       coalesce(r.nombre, '(sin rol)') as rol,
       (p.auth_id is not null)         as tiene_perfil
from auth.users u
left join public.usuarios p on p.auth_id = u.id
left join public.roles    r on r.id = p.rol_id
order by u.email;
