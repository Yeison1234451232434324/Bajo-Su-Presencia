-- ============================================================================
--  RLS POR ROL — Bajo Su Presencia  (Supabase / PostgreSQL)
--  Seguridad por rol según la tabla "usuarios". A prueba de nombres: cada
--  tabla se protege solo si existe (to_regclass), así no revienta si un
--  nombre difiere.  Re-ejecutable.
-- ----------------------------------------------------------------------------
--  Roles esperados en public.roles.nombre:
--     'Administrador', 'Colaborador', 'Voluntario', 'Usuario'
--
--  REQUISITO: autenticación con Supabase Auth. Cada fila de "usuarios" se liga
--  a auth.users por la columna auth_id (se crea aquí). Mientras las apps no
--  usen Supabase Auth, auth.uid() es NULL y RLS bloqueará todo.
--
--  ►► CONFIRMA estos 2 nombres de columna de "usuarios" (salen truncados en el
--     visualizador) y ajústalos en el trigger handle_new_user() si difieren:
--        - columna de correo     → se asume  correo_electronico
--        - columna de contraseña → se asume  contraseña   (es NOT NULL)
-- ============================================================================


-- ============================================================================
-- PARTE 0 · VÍNCULO CON AUTH + FUNCIONES HELPER
-- ============================================================================

alter table public.usuarios
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

create or replace function public.mi_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_id = auth.uid() limit 1
$$;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select r.nombre
  from public.usuarios u
  join public.roles r on r.id = u.rol_id
  where u.auth_id = auth.uid()
  limit 1
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_rol() = 'Administrador'
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_rol() in ('Administrador','Colaborador')
$$;

-- Al registrarse con Supabase Auth crea la fila en "usuarios" con rol 'Usuario'.
-- contraseña recibe un placeholder porque la clave real la gestiona Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol_usuario uuid;
begin
  select id into v_rol_usuario from public.roles where nombre = 'Usuario' limit 1;

  -- Si ya existe una fila para ese correo (datos previos), solo la enlaza y
  -- CONSERVA su rol original (admin/colaborador/voluntario). Si no, crea un
  -- miembro nuevo con rol 'Usuario'.
  update public.usuarios
     set auth_id = new.id
   where correo_electronico = new.email and auth_id is null;

  if not found then
    insert into public.usuarios (auth_id, nombre, correo_electronico, contrasena_hash, rol_id, activo)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
      new.email,
      'auth',                        -- placeholder (la clave real vive en auth.users)
      v_rol_usuario,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- PARTE 1 · CONTENIDO PÚBLICO  (autenticados LEEN; solo staff escribe)
--   Incluye candidatos para la tabla puente evento(s)_recurso(s).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'eventos','noticias','oraciones','sedes','recursos','actividades',
    'evento_recursos','eventos_recursos','evento_recurso'
  ]
  loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_mod', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_staff()) with check (public.es_staff())', t||'_mod', t);
  end loop;
end $$;


-- ============================================================================
-- PARTE 2 · roles  (todos leen; solo admin escribe)
-- ============================================================================
do $$ begin
  if to_regclass('public.roles') is null then return; end if;
  alter table public.roles enable row level security;
  drop policy if exists roles_sel on public.roles;
  create policy roles_sel on public.roles for select to authenticated using (true);
  drop policy if exists roles_mod on public.roles;
  create policy roles_mod on public.roles for all to authenticated
    using (public.es_admin()) with check (public.es_admin());
end $$;


-- ============================================================================
-- PARTE 3 · usuarios  (perfil propio + staff ve todos; admin gestiona)
-- ============================================================================
do $$ begin
  if to_regclass('public.usuarios') is null then return; end if;
  alter table public.usuarios enable row level security;
  -- SELECT abierto a autenticados: NO debe llamar funciones que lean usuarios
  -- (evita recursión infinita 42P17). La escritura sí va por rol.
  drop policy if exists usuarios_sel on public.usuarios;
  create policy usuarios_sel on public.usuarios for select to authenticated
    using (true);
  drop policy if exists usuarios_ins on public.usuarios;
  create policy usuarios_ins on public.usuarios for insert to authenticated
    with check (public.es_admin());     -- el alta normal la hace el trigger
  drop policy if exists usuarios_upd on public.usuarios;
  create policy usuarios_upd on public.usuarios for update to authenticated
    using (public.es_admin() or auth_id = auth.uid())
    with check (public.es_admin() or auth_id = auth.uid());
  drop policy if exists usuarios_del on public.usuarios;
  create policy usuarios_del on public.usuarios for delete to authenticated
    using (public.es_admin());
end $$;


-- ============================================================================
-- PARTE 4 · asistencias  (miembro la suya; staff y voluntario gestionan todas)
-- ============================================================================
do $$ begin
  if to_regclass('public.asistencias') is null then return; end if;
  alter table public.asistencias enable row level security;
  drop policy if exists asis_sel on public.asistencias;
  create policy asis_sel on public.asistencias for select to authenticated
    using (public.es_staff() or public.mi_rol()='Voluntario' or usuario_id = public.mi_usuario_id());
  drop policy if exists asis_ins on public.asistencias;
  create policy asis_ins on public.asistencias for insert to authenticated
    with check (public.es_staff() or public.mi_rol()='Voluntario' or usuario_id = public.mi_usuario_id());
  drop policy if exists asis_upd on public.asistencias;
  create policy asis_upd on public.asistencias for update to authenticated
    using (public.es_staff() or public.mi_rol()='Voluntario' or usuario_id = public.mi_usuario_id())
    with check (true);
  drop policy if exists asis_del on public.asistencias;
  create policy asis_del on public.asistencias for delete to authenticated
    using (public.es_staff());
end $$;


-- ============================================================================
-- PARTE 5 · calificaciones_eventos  (miembro la suya; staff lee todo)
-- ============================================================================
do $$ begin
  if to_regclass('public.calificaciones_eventos') is null then return; end if;
  alter table public.calificaciones_eventos enable row level security;
  drop policy if exists ce_sel on public.calificaciones_eventos;
  create policy ce_sel on public.calificaciones_eventos for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists ce_ins on public.calificaciones_eventos;
  create policy ce_ins on public.calificaciones_eventos for insert to authenticated
    with check (usuario_id = public.mi_usuario_id());
  drop policy if exists ce_upd on public.calificaciones_eventos;
  create policy ce_upd on public.calificaciones_eventos for update to authenticated
    using (usuario_id = public.mi_usuario_id()) with check (usuario_id = public.mi_usuario_id());
  drop policy if exists ce_del on public.calificaciones_eventos;
  create policy ce_del on public.calificaciones_eventos for delete to authenticated
    using (public.es_staff());
end $$;


-- ============================================================================
-- PARTE 6 · notificaciones  (cada quien las suyas; staff las crea)
-- ============================================================================
do $$ begin
  if to_regclass('public.notificaciones') is null then return; end if;
  alter table public.notificaciones enable row level security;
  drop policy if exists notif_sel on public.notificaciones;
  create policy notif_sel on public.notificaciones for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists notif_ins on public.notificaciones;
  create policy notif_ins on public.notificaciones for insert to authenticated
    with check (public.es_staff());
  drop policy if exists notif_upd on public.notificaciones;
  create policy notif_upd on public.notificaciones for update to authenticated
    using (usuario_id = public.mi_usuario_id()) with check (usuario_id = public.mi_usuario_id());
  drop policy if exists notif_del on public.notificaciones;
  create policy notif_del on public.notificaciones for delete to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;


-- ============================================================================
-- PARTE 7 · pqr  (autenticado crea; staff gestiona/responde)
-- ============================================================================
do $$ begin
  if to_regclass('public.pqr') is null then return; end if;
  alter table public.pqr enable row level security;
  drop policy if exists pqr_sel on public.pqr;
  create policy pqr_sel on public.pqr for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists pqr_ins on public.pqr;
  create policy pqr_ins on public.pqr for insert to authenticated with check (true);
  drop policy if exists pqr_upd on public.pqr;
  create policy pqr_upd on public.pqr for update to authenticated
    using (public.es_staff()) with check (public.es_staff());
  drop policy if exists pqr_del on public.pqr;
  create policy pqr_del on public.pqr for delete to authenticated using (public.es_admin());
end $$;


-- ============================================================================
-- PARTE 8 · voluntarios_eventos  (staff asigna; voluntario ve y cambia su disp.)
-- ============================================================================
do $$ begin
  if to_regclass('public.voluntarios_eventos') is null then return; end if;
  alter table public.voluntarios_eventos enable row level security;
  drop policy if exists ve_sel on public.voluntarios_eventos;
  create policy ve_sel on public.voluntarios_eventos for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists ve_ins on public.voluntarios_eventos;
  create policy ve_ins on public.voluntarios_eventos for insert to authenticated
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists ve_upd on public.voluntarios_eventos;
  create policy ve_upd on public.voluntarios_eventos for update to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id()) with check (true);
  drop policy if exists ve_del on public.voluntarios_eventos;
  create policy ve_del on public.voluntarios_eventos for delete to authenticated
    using (public.es_staff());
end $$;


-- ============================================================================
-- PARTE 9 · disponibilidad_eventos  (voluntario la suya; staff lee)
-- ============================================================================
do $$ begin
  if to_regclass('public.disponibilidad_eventos') is null then return; end if;
  alter table public.disponibilidad_eventos enable row level security;
  drop policy if exists disp_sel on public.disponibilidad_eventos;
  create policy disp_sel on public.disponibilidad_eventos for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists disp_ins on public.disponibilidad_eventos;
  create policy disp_ins on public.disponibilidad_eventos for insert to authenticated
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists disp_upd on public.disponibilidad_eventos;
  create policy disp_upd on public.disponibilidad_eventos for update to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id()) with check (true);
  drop policy if exists disp_del on public.disponibilidad_eventos;
  create policy disp_del on public.disponibilidad_eventos for delete to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;


-- ============================================================================
-- PARTE 10 · asignaciones (tareas)  (staff asigna; voluntario ve/actualiza suyas)
-- ============================================================================
do $$ begin
  if to_regclass('public.asignaciones') is null then return; end if;
  alter table public.asignaciones enable row level security;
  drop policy if exists asig_sel on public.asignaciones;
  create policy asig_sel on public.asignaciones for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists asig_ins on public.asignaciones;
  create policy asig_ins on public.asignaciones for insert to authenticated
    with check (public.es_staff());
  drop policy if exists asig_upd on public.asignaciones;
  create policy asig_upd on public.asignaciones for update to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id()) with check (true);
  drop policy if exists asig_del on public.asignaciones;
  create policy asig_del on public.asignaciones for delete to authenticated
    using (public.es_staff());
end $$;


-- ============================================================================
-- PARTE 11 · evaluaciones  (staff evalúa; voluntario ve las suyas)
-- ============================================================================
do $$ begin
  if to_regclass('public.evaluaciones') is null then return; end if;
  alter table public.evaluaciones enable row level security;
  drop policy if exists eval_sel on public.evaluaciones;
  create policy eval_sel on public.evaluaciones for select to authenticated
    using (public.es_staff() or usuario_id = public.mi_usuario_id());
  drop policy if exists eval_ins on public.evaluaciones;
  create policy eval_ins on public.evaluaciones for insert to authenticated
    with check (public.es_staff());
  drop policy if exists eval_upd on public.evaluaciones;
  create policy eval_upd on public.evaluaciones for update to authenticated
    using (public.es_staff()) with check (public.es_staff());
  drop policy if exists eval_del on public.evaluaciones;
  create policy eval_del on public.evaluaciones for delete to authenticated
    using (public.es_staff());
end $$;


-- ============================================================================
-- PARTE 12 · informes  (solo staff)
-- ============================================================================
do $$ begin
  if to_regclass('public.informes') is null then return; end if;
  alter table public.informes enable row level security;
  drop policy if exists inf_all on public.informes;
  create policy inf_all on public.informes for all to authenticated
    using (public.es_staff()) with check (public.es_staff());
end $$;


-- ============================================================================
-- FIN. Permisos: Administrador=todo · Colaborador=gestión de contenido/eventos/
-- recursos/actividades/asignaciones/evaluaciones/informes/PQR/voluntarios ·
-- Voluntario=sus actividades/disponibilidad/asistencias(escaneo)/sus evaluaciones ·
-- Usuario=reservas(asistencias)/califica eventos/sus notificaciones/crea PQR.
-- ============================================================================
