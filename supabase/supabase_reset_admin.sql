-- ============================================================================
--  RESET ADMIN — Bajo Su Presencia
--  Objetivo: dejar UN solo usuario administrador funcional para volver a entrar
--  y desde ahí crear los demás.
--
--  ⚠️  DESTRUCTIVO: borra TODOS los usuarios (auth.users + tabla usuarios).
--  Córrelo COMPLETO en el SQL Editor de Supabase (una sola ejecución).
--  Robusto y re-ejecutable.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- DIAGNÓSTICO (antes) — mira los NOTICE en la pestaña "Results/Messages"
-- ----------------------------------------------------------------------------
do $$
declare
  v_trig int; v_authu int; v_perf int; v_roladmin int;
begin
  select count(*) into v_trig     from pg_trigger where tgname = 'on_auth_user_created';
  select count(*) into v_authu    from auth.users;
  select count(*) into v_perf     from public.usuarios;
  select count(*) into v_roladmin from public.roles where nombre = 'Administrador';
  raise notice 'DIAGNOSTICO -> trigger on_auth_user_created: % | auth.users: % | usuarios: % | rol Administrador existe: %',
    (case when v_trig>0 then 'SI' else 'NO' end), v_authu, v_perf,
    (case when v_roladmin>0 then 'SI' else 'NO' end);
end $$;

-- ----------------------------------------------------------------------------
-- 0) Cimientos: columna de enlace + roles necesarios
-- ----------------------------------------------------------------------------
alter table public.usuarios
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

insert into public.roles (nombre) select 'Usuario'
  where not exists (select 1 from public.roles where nombre = 'Usuario');
insert into public.roles (nombre) select 'Administrador'
  where not exists (select 1 from public.roles where nombre = 'Administrador');

-- ----------------------------------------------------------------------------
-- 1) Trigger BLINDADO: jamás bloquea el alta en Auth
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol uuid;
begin
  begin
    select id into v_rol from public.roles where nombre = 'Usuario' limit 1;

    update public.usuarios set auth_id = new.id
     where correo_electronico = new.email and auth_id is null;

    if not found then
      insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
      values (new.id,
              coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
              new.email, 'auth', v_rol, true);
    end if;
  exception when others then
    raise warning 'handle_new_user falló para %: %', new.email, sqlerrm;  -- no bloquea el signup
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2) LIMPIEZA TOTAL
--    OJO: por las llaves foráneas, para poder borrar los usuarios también se
--    borra el CONTENIDO enlazado a ellos (oraciones, noticias, actividades,
--    asignaciones, evaluaciones, asistencias, etc.). Es un arranque en limpio.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Hijos primero (orden de dependencias). Se salta tablas inexistentes.
  foreach t in array array[
    'calificaciones_eventos','notificaciones','asistencias','voluntarios_eventos',
    'disponibilidad_eventos','evaluaciones','asignaciones','actividades',
    'oraciones','noticias','pqr'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;

  -- informes referencia usuarios por creado_por → desvincular (no borrar informes)
  if to_regclass('public.informes') is not null then
    begin
      execute 'update public.informes set creado_por = null';
    exception when undefined_column then null;
    end;
  end if;
end $$;

delete from public.usuarios;
delete from auth.users;     -- cascada borra auth.identities

-- ----------------------------------------------------------------------------
-- 3) Crea el ADMIN directamente (no depende del dashboard ni del trigger)
--    Cambia el correo y la contraseña si quieres.
-- ----------------------------------------------------------------------------
do $$
declare
  v_email text := 'admin@correo.com';
  v_pass  text := 'Admin123*';
  v_id    uuid := gen_random_uuid();
  v_admin uuid;
begin
  select id into v_admin from public.roles where nombre = 'Administrador';

  -- Cuenta de Auth (email confirmado)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_pass, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre','Administrador')
  );

  -- Identidad de email (necesaria para login por contraseña)
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- Perfil en usuarios. El trigger blindado ya pudo haber creado esta fila al
  -- insertar el auth user; por eso usamos UPSERT para solo fijar rol Administrador.
  insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
  values (v_id, 'Administrador', v_email, 'auth', v_admin, true)
  on conflict (correo_electronico) do update
    set auth_id = excluded.auth_id,
        rol_id  = excluded.rol_id,
        nombre  = excluded.nombre,
        activo  = true;

  raise notice 'ADMIN creado: %  /  %', v_email, v_pass;
end $$;

-- ----------------------------------------------------------------------------
-- 4) VERIFICACIÓN (después): debe salir EXACTAMENTE 1 fila
-- ----------------------------------------------------------------------------
select u.email, p.nombre, r.nombre as rol, p.activo
from auth.users u
join public.usuarios p on p.auth_id = u.id
join public.roles r    on r.id = p.rol_id;
