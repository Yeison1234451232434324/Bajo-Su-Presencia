-- ============================================================================
--  FASE 10 · LIMPIEZA FINAL
--  - Reescribe handle_new_user() sin la columna de contraseña heredada
--  - Elimina usuarios.contrasena_hash (la clave real vive en auth.users;
--    aquí solo quedaba el placeholder 'auth'). Hashes reales, si los hubiera,
--    se preservan en una tabla interna antes de eliminar la columna.
--  - Valida los CHECK que quedaron NOT VALID (si los datos ya lo permiten)
--  - Documenta el esquema con COMMENT ON
--  - Verificación final
--  Requiere: FASES 1-9. Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 10.1 handle_new_user() sin contrasena_hash (hay que actualizar el trigger
-- ANTES de eliminar la columna, o cada signup fallaría)
-- ===========================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol uuid;
begin
  begin
    select id into v_rol from public.roles where nombre = 'Usuario' limit 1;

    update public.usuarios set auth_id = new.id
     where lower(correo_electronico) = lower(new.email) and auth_id is null;

    if not found then
      insert into public.usuarios (auth_id, nombre, correo_electronico, rol_id, activo)
      values (new.id,
              coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
              lower(new.email), v_rol, true);
    end if;
  exception when others then
    -- nunca bloquea el alta en Auth, pero deja rastro del perfil no creado
    raise warning 'handle_new_user falló para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================
-- 10.2 Eliminar usuarios.contrasena_hash
-- Si existieran hashes reales (≠ placeholder), primero se preservan en
-- aud.contrasenas_legado — INTERVENCIÓN MANUAL únicamente si esa tabla
-- termina con filas: decidir si esos usuarios necesitan migración a Auth.
-- ===========================================
do $$ begin
  if not aud.col_exists('usuarios', 'contrasena_hash') then return; end if;

  create table if not exists aud.contrasenas_legado (
    usuario_id uuid primary key,
    correo     text,
    hash       text,
    guardado_en timestamptz not null default now()
  );

  insert into aud.contrasenas_legado (usuario_id, correo, hash)
  select id, correo_electronico, contrasena_hash
  from public.usuarios
  where contrasena_hash is not null
    and contrasena_hash not in ('auth', '')
  on conflict (usuario_id) do nothing;

  alter table public.usuarios drop column contrasena_hash;
  raise notice 'usuarios.contrasena_hash eliminada; hashes reales preservados: %',
    (select count(*) from aud.contrasenas_legado);
end $$;

-- ===========================================
-- 10.3 Validar todos los CHECK que quedaron NOT VALID (los que aún tengan
-- datos históricos en conflicto se reportan con NOTICE y siguen NOT VALID,
-- exigiéndose solo a los datos nuevos)
-- ===========================================
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c' and not convalidated
      and connamespace = 'public'::regnamespace
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
      raise notice 'Validada: % en %', c.conname, c.tbl;
    exception when others then
      raise notice 'Sigue NOT VALID (datos históricos): % en % — %', c.conname, c.tbl, sqlerrm;
    end;
  end loop;
end $$;

-- ===========================================
-- 10.4 Documentación del esquema (visible en el panel de Supabase)
-- ===========================================
comment on table public.usuarios     is 'Perfiles de miembros; la autenticación vive en auth.users (enlace: auth_id).';
comment on table public.roles        is 'Catálogo de roles: Administrador, Colaborador, Voluntario, Usuario.';
comment on table public.eventos      is 'Eventos/servicios. El QR de asistencia vive en eventos_qr (solo staff).';
comment on table public.asistencias  is 'Reserva y confirmación de asistencia. "estado" es la única fuente de verdad: confirmada→asistida→calificada / cancelada.';
comment on table public.evaluaciones is 'Calificación del STAFF a un VOLUNTARIO por evento (columna estrellas 1-5).';
comment on table public.calificaciones_eventos is 'Calificación del ASISTENTE al EVENTO (criterios ujieres/sonido/mensaje 1-5).';
comment on table public.pqr          is 'Peticiones, Quejas y Reclamos; el formulario público inserta como anon.';
comment on table public.especialidades is 'Catálogo de especialidades de voluntarios (antes texto libre en usuarios).';
comment on table public.usuario_especialidades is 'N:M usuario ↔ especialidad.';
do $$ begin
  comment on table public.eventos_qr is 'Código QR secreto por evento; solo staff/backends. NO exponer a anon.';
exception when undefined_table then null; end $$;

-- ===========================================
-- 10.5 Verificación final: resumen del estado del esquema
-- ===========================================
select 'tablas_public'                as indicador, count(*)::text as valor
  from pg_tables where schemaname = 'public'
union all
select 'checks_not_valid_restantes', count(*)::text
  from pg_constraint
  where contype = 'c' and not convalidated and connamespace = 'public'::regnamespace
union all
select 'tablas_sin_rls', coalesce(string_agg(tablename, ', '), '(ninguna)')
  from pg_tables t
  where schemaname = 'public'
    and not exists (select 1 from pg_class c
                    where c.oid = ('public.' || quote_ident(t.tablename))::regclass
                      and c.relrowsecurity)
union all
select 'columnas_con_tilde_o_mayuscula', coalesce(string_agg(table_name || '.' || column_name, ', '), '(ninguna)')
  from information_schema.columns
  where table_schema = 'public' and column_name ~ '[^a-z0-9_]'
order by indicador;
