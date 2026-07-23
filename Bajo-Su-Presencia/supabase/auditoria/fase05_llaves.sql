-- ============================================================================
--  FASE 5 · LLAVES — UNIQUE y FOREIGN KEYS faltantes
--  Los duplicados y huérfanos ya se depuraron en la FASE 2, así que estas
--  restricciones aplican limpias. Cada bloque avisa con NOTICE si aún queda
--  algo que impida crearla (sin abortar el script).
--  Requiere: FASES 1-4. Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 5.1 UNIQUE roles.nombre (insensible a mayúsculas/espacios)
-- Evita que reaparezcan duplicados 'admin'/'Administrador'
-- ===========================================
do $$ begin
  create unique index if not exists ux_roles_nombre
    on public.roles (lower(trim(nombre)));
exception when others then
  raise notice 'ux_roles_nombre: %', sqlerrm;
end $$;

-- ===========================================
-- 5.2 UNIQUE usuarios.correo_electronico
-- El trigger handle_new_user enlaza por correo: sin esto, con correos
-- duplicados enlazaría la fila (y el ROL) equivocados
-- ===========================================
do $$ begin
  create unique index if not exists ux_usuarios_correo
    on public.usuarios (lower(correo_electronico));
exception when others then
  raise notice 'ux_usuarios_correo: %', sqlerrm;
end $$;

-- ===========================================
-- 5.3 UNIQUE recursos.nombre (el modelo JS ya asumía el error 23505)
-- ===========================================
do $$ begin
  create unique index if not exists ux_recursos_nombre
    on public.recursos (lower(trim(nombre)));
exception when others then
  raise notice 'ux_recursos_nombre: %', sqlerrm;
end $$;

-- ===========================================
-- 5.4 UNIQUE evento_recursos(evento_id, recurso_id)
-- Cierra la condición de carrera del upsert manual del modelo JS
-- ===========================================
do $$ begin
  if to_regclass('public.evento_recursos') is null then return; end if;
  create unique index if not exists ux_evento_recursos_par
    on public.evento_recursos (evento_id, recurso_id);
exception when others then
  raise notice 'ux_evento_recursos_par: %', sqlerrm;
end $$;

-- ===========================================
-- 5.5 UNIQUE informes.evento_id (un informe por evento — antes solo en JS)
-- ===========================================
do $$ begin
  create unique index if not exists ux_informes_evento
    on public.informes (evento_id);
exception when others then
  raise notice 'ux_informes_evento: %', sqlerrm;
end $$;

-- ===========================================
-- 5.6 UNIQUE evaluaciones(evento_id, usuario_id)
-- ===========================================
do $$ begin
  create unique index if not exists ux_evaluaciones_evento_usuario
    on public.evaluaciones (evento_id, usuario_id);
exception when others then
  raise notice 'ux_evaluaciones_evento_usuario: %', sqlerrm;
end $$;

-- ===========================================
-- 5.7 UNIQUE parcial: invitados no registrados no pueden inscribirse dos
-- veces al mismo evento con el mismo correo (la UNIQUE (evento_id, usuario_id)
-- no aplica cuando usuario_id es NULL)
-- ===========================================
do $$ begin
  create unique index if not exists ux_asistencias_evento_correo
    on public.asistencias (evento_id, lower(correo))
    where usuario_id is null and correo is not null;
exception when others then
  raise notice 'ux_asistencias_evento_correo: %', sqlerrm;
end $$;

-- ===========================================
-- 5.8 FKs de evento_recursos con ON DELETE CASCADE
-- (los modelos JS hacían la cascada a mano: no atómica)
-- ===========================================
do $$ begin
  if to_regclass('public.evento_recursos') is null then return; end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.evento_recursos'::regclass and c.contype = 'f'
      and c.conkey = (select array[attnum] from pg_attribute
                      where attrelid = c.conrelid and attname = 'evento_id')) then
    alter table public.evento_recursos
      add constraint fk_evento_recursos_evento
      foreign key (evento_id) references public.eventos(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.evento_recursos'::regclass and c.contype = 'f'
      and c.conkey = (select array[attnum] from pg_attribute
                      where attrelid = c.conrelid and attname = 'recurso_id')) then
    alter table public.evento_recursos
      add constraint fk_evento_recursos_recurso
      foreign key (recurso_id) references public.recursos(id) on delete cascade;
  end if;
exception when others then
  raise notice 'FKs evento_recursos: %', sqlerrm;
end $$;

-- ===========================================
-- 5.9 FKs de actividades
-- ===========================================
do $$ begin
  if to_regclass('public.actividades') is null then return; end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.actividades'::regclass and c.contype = 'f'
      and c.conkey = (select array[attnum] from pg_attribute
                      where attrelid = c.conrelid and attname = 'evento_id')) then
    alter table public.actividades
      add constraint fk_actividades_evento
      foreign key (evento_id) references public.eventos(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.actividades'::regclass and c.contype = 'f'
      and c.conkey = (select array[attnum] from pg_attribute
                      where attrelid = c.conrelid and attname = 'voluntario_id')) then
    alter table public.actividades
      add constraint fk_actividades_voluntario
      foreign key (voluntario_id) references public.usuarios(id) on delete set null;
  end if;
exception when others then
  raise notice 'FKs actividades: %', sqlerrm;
end $$;

-- ===========================================
-- 5.10 FKs defensivas en tablas base (solo si faltan):
--      evaluaciones.usuario_id, informes.evento_id,
--      noticias.usuario_id, oraciones.usuario_id
-- ===========================================
do $$
declare
  spec text[];
  specs constant text[][] := array[
    ['evaluaciones', 'usuario_id', 'usuarios', 'set null'],
    ['informes',     'evento_id',  'eventos',  'cascade'],
    ['noticias',     'usuario_id', 'usuarios', 'set null'],
    ['oraciones',    'usuario_id', 'usuarios', 'set null']
  ];
begin
  foreach spec slice 1 in array specs loop
    if to_regclass('public.' || spec[1]) is null then continue; end if;
    if not aud.col_exists(spec[1], spec[2]) then continue; end if;
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = ('public.' || spec[1])::regclass and c.contype = 'f'
        and c.conkey = (select array[attnum] from pg_attribute
                        where attrelid = c.conrelid and attname = spec[2])) then
      begin
        execute format(
          'alter table public.%I add constraint %I foreign key (%I)
             references public.%I(id) on delete %s',
          spec[1], 'fk_' || spec[1] || '_' || spec[2], spec[2], spec[3], spec[4]);
        raise notice 'FK creada: %.%', spec[1], spec[2];
      exception when others then
        raise notice 'FK %.% no creada: %', spec[1], spec[2], sqlerrm;
      end;
    end if;
  end loop;
end $$;
