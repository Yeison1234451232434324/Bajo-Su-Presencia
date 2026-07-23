-- ============================================================================
--  SETUP TRIGGER (mínimo y seguro) — Bajo Su Presencia
--  Solo instala los cimientos + el trigger BLINDADO. No borra nada y no puede
--  fallar por datos. Córrelo COMPLETO. Re-ejecutable.
--
--  ►► PASO 1 de 3. Después de esto:
--     PASO 2: Authentication → Add user (Auto Confirm)  ← ya no dará error
--     PASO 3: corre supabase_promote_admin.sql
-- ============================================================================

-- Columna de enlace usuarios ↔ auth.users
alter table public.usuarios
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

-- Roles necesarios
insert into public.roles (nombre) select 'Usuario'
  where not exists (select 1 from public.roles where nombre = 'Usuario');
insert into public.roles (nombre) select 'Administrador'
  where not exists (select 1 from public.roles where nombre = 'Administrador');

-- Trigger BLINDADO: jamás bloquea el alta en Auth
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
              coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
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

-- Verificación: debe devolver 1 fila con 'on_auth_user_created'
select tgname as trigger_instalado
from pg_trigger
where tgname = 'on_auth_user_created';
