-- ============================================================================
--  FASE 8 · SEGURIDAD Y RLS — cierre de los huecos detectados
--  1) usuarios: SELECT abierto exponía correos, teléfonos y hash a cualquier
--     autenticado → ahora solo staff o el propio usuario; directorio limitado
--     vía vista para las pantallas que listan nombres.
--  2) Cuatro políticas UPDATE con "with check (true)" permitían reasignar
--     filas a otros usuarios → se replica el predicado del USING.
--  3) RLS para las tablas nuevas (eventos_qr, especialidades, usuario_especialidades).
--  Requiere: FASES 1-4. Re-ejecutable.
--  Nota: las funciones es_staff()/mi_usuario_id() son SECURITY DEFINER
--  (ejecutan como dueño de la tabla y NO recursan sobre RLS de usuarios).
-- ============================================================================

-- ===========================================
-- 8.1 usuarios: SELECT restringido a staff o fila propia
-- ===========================================
do $$ begin
  if to_regclass('public.usuarios') is null then return; end if;
  alter table public.usuarios enable row level security;
  drop policy if exists usuarios_sel on public.usuarios;
  create policy usuarios_sel on public.usuarios for select to authenticated
    using (public.es_staff() or auth_id = auth.uid());
end $$;

-- ===========================================
-- 8.2 Directorio público interno: SOLO campos no sensibles, para las
-- pantallas que muestran nombres de otros usuarios (asignar voluntarios,
-- autores de noticias, etc.). La vista corre como su dueño (postgres) y
-- por eso puede leer usuarios pese a la política restrictiva; expone
-- únicamente estas columnas.
-- ===========================================
create or replace view public.usuarios_directorio as
  select u.id, u.nombre, u.foto_url,
         coalesce(array_agg(e.nombre) filter (where e.nombre is not null),
                  '{}'::text[]) as especialidades
  from public.usuarios u
  left join public.usuario_especialidades ue on ue.usuario_id = u.id
  left join public.especialidades e on e.id = ue.especialidad_id
  where u.activo
  group by u.id, u.nombre, u.foto_url;

revoke all    on public.usuarios_directorio from anon;
grant  select on public.usuarios_directorio to authenticated;

-- ===========================================
-- 8.3 UPDATE sin fuga: mismo predicado en USING y WITH CHECK
-- (antes "with check (true)" permitía cambiar usuario_id/evento_id a otro)
-- ===========================================
do $$ begin
  if to_regclass('public.asistencias') is null then return; end if;
  drop policy if exists asis_upd on public.asistencias;
  create policy asis_upd on public.asistencias for update to authenticated
    using      (public.es_staff() or public.mi_rol() = 'Voluntario'
                or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or public.mi_rol() = 'Voluntario'
                or usuario_id = public.mi_usuario_id());
end $$;

do $$ begin
  if to_regclass('public.voluntarios_eventos') is null then return; end if;
  drop policy if exists ve_upd on public.voluntarios_eventos;
  create policy ve_upd on public.voluntarios_eventos for update to authenticated
    using      (public.es_staff() or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;

do $$ begin
  if to_regclass('public.asignaciones') is null then return; end if;
  drop policy if exists asig_upd on public.asignaciones;
  create policy asig_upd on public.asignaciones for update to authenticated
    using      (public.es_staff() or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;

-- (disponibilidad_eventos ya no existe: fusionada en voluntarios_eventos, FASE 4.6)

-- ===========================================
-- 8.4 eventos_qr: el código QR es el secreto que confirma asistencia física.
-- Solo staff lo lee/gestiona; el móvil lo valida vía backend (service_role)
-- ===========================================
do $$ begin
  if to_regclass('public.eventos_qr') is null then return; end if;
  alter table public.eventos_qr enable row level security;
  drop policy if exists qr_staff on public.eventos_qr;
  create policy qr_staff on public.eventos_qr for all to authenticated
    using (public.es_staff()) with check (public.es_staff());
end $$;

-- ===========================================
-- 8.5 especialidades: catálogo — todos los autenticados leen, staff escribe
-- ===========================================
do $$ begin
  if to_regclass('public.especialidades') is null then return; end if;
  alter table public.especialidades enable row level security;
  drop policy if exists esp_sel on public.especialidades;
  create policy esp_sel on public.especialidades for select to authenticated using (true);
  drop policy if exists esp_mod on public.especialidades;
  create policy esp_mod on public.especialidades for all to authenticated
    using (public.es_staff()) with check (public.es_staff());
end $$;

-- ===========================================
-- 8.6 usuario_especialidades: cada quien gestiona las suyas; staff todas
-- ===========================================
do $$ begin
  if to_regclass('public.usuario_especialidades') is null then return; end if;
  alter table public.usuario_especialidades enable row level security;
  drop policy if exists ue_sel on public.usuario_especialidades;
  create policy ue_sel on public.usuario_especialidades for select to authenticated
    using (true);   -- solo expone pares usuario↔especialidad, sin PII
  drop policy if exists ue_mod on public.usuario_especialidades;
  create policy ue_mod on public.usuario_especialidades for all to authenticated
    using      (public.es_staff() or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;

-- ===========================================
-- 8.7 El esquema de respaldos aud queda fuera del alcance de la API
-- ===========================================
revoke all on schema aud from anon, authenticated;
