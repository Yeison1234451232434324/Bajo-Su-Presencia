-- ============================================================
-- FASE 22 — Corrige handle_new_user(): usuarios creados desde el panel
-- (Usuarios > Crear) no quedaban guardados.
-- ============================================================
-- Causa: fase16 (16.5) puso `usuarios.username` como NOT NULL. El trigger
-- handle_new_user() (fase15, 15.7) inserta la fila base SIN username. Ese
-- INSERT viola el NOT NULL, la excepción es atrapada por el bloque
-- "exception when others" (para no bloquear el alta en Supabase Auth) y
-- se descarta con un simple `raise warning` — invisible para el backend.
--
-- Resultado observado: la cuenta de Auth se crea, pero la fila en
-- public.usuarios nunca existe. UsuariosService::create() (backend PHP)
-- entonces no encuentra fila que actualizar y devuelve un "éxito" falso
-- con id=null — el panel dice "Usuario creado" pero no aparece en ningún
-- lado. Reproducido y verificado contra la BD real antes de este fix.
--
-- Fix: el trigger genera un username provisional único (derivado del
-- correo) cuando no viene ninguno en los metadatos, para que el INSERT
-- nunca choque con el NOT NULL. El paso 2 del backend (UsuariosService::
-- create → updateByAuthId) sigue siendo quien pone el username real que
-- el admin escribió en el formulario.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol uuid;
  v_username text;
  v_intentos int := 0;
begin
  begin
    select id into v_rol from public.roles where nombre = 'Usuario' limit 1;

    update public.usuarios set auth_id = new.id
     where lower(correo_electronico) = lower(new.email) and auth_id is null;

    if not found then
      -- Username provisional: metadato explícito si viene, si no, el local-part
      -- del correo; si ya existe (choque con lower(username) UNIQUE) se le
      -- agrega un sufijo numérico hasta encontrar uno libre.
      v_username := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''),
                              split_part(new.email, '@', 1));
      while exists (select 1 from public.usuarios where lower(username) = lower(v_username)) loop
        v_intentos := v_intentos + 1;
        v_username := split_part(new.email, '@', 1) || v_intentos::text;
      end loop;

      insert into public.usuarios
        (auth_id, nombres, apellidos, correo_electronico, username, rol_id, activo)
      values (new.id,
              coalesce(nullif(trim(new.raw_user_meta_data->>'nombres'), ''),
                       nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
                       split_part(new.email, '@', 1)),
              nullif(trim(new.raw_user_meta_data->>'apellidos'), ''),
              lower(new.email), v_username, v_rol, true);
    end if;
  exception when others then
    raise warning 'handle_new_user falló para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$;
