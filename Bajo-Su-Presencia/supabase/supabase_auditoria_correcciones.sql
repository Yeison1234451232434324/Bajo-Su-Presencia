-- ============================================================================
--  AUDITORÍA — CORRECCIONES FASE 1 (no rompientes) — Bajo Su Presencia
--  Motor: PostgreSQL (Supabase). Re-ejecutable (idempotente).
--
--  Este script NO renombra columnas ni tablas (eso rompería las apps web y
--  móvil). Solo agrega restricciones, llaves, índices y arregla políticas RLS
--  inseguras. Los renombrados y cambios estructurales van en la FASE 2
--  (comentada al final) y requieren coordinar cambios en el código.
--
--  Antes de correr, puedes verificar el esquema real con:
--    select table_name, column_name, data_type, is_nullable, column_default
--    from information_schema.columns
--    where table_schema = 'public'
--    order by table_name, ordinal_position;
-- ============================================================================


-- ============================================================================
-- PARTE 1 · LLAVES ÚNICAS FALTANTES
--   Cada bloque intenta crear la unique; si hay datos duplicados avisa con
--   NOTICE en vez de reventar, para que primero depures esas filas.
-- ============================================================================

-- 1.1 roles.nombre — el script supabase_normalizar_roles.sql prueba que YA
--     hubo duplicados ('admin'/'Administrador'). Sin unique, volverán.
do $$ begin
  create unique index if not exists ux_roles_nombre on public.roles (lower(trim(nombre)));
exception when others then
  raise notice 'ux_roles_nombre NO creada: % — depura duplicados y reintenta', sqlerrm;
end $$;

-- 1.2 usuarios.correo_electronico — el trigger handle_new_user() enlaza por
--     correo; con correos duplicados enlazaría la fila equivocada.
do $$ begin
  create unique index if not exists ux_usuarios_correo
    on public.usuarios (lower(correo_electronico));
exception when others then
  raise notice 'ux_usuarios_correo NO creada: %', sqlerrm;
end $$;

-- 1.3 recursos.nombre — recursos.model.js ya asume el error 23505
--     ("Ya existe un recurso con ese nombre"), pero la unique no está en
--     ningún script del repo.
do $$ begin
  create unique index if not exists ux_recursos_nombre
    on public.recursos (lower(trim(nombre)));
exception when others then
  raise notice 'ux_recursos_nombre NO creada: %', sqlerrm;
end $$;

-- 1.4 evento_recursos (evento_id, recurso_id) — el modelo hace un "upsert"
--     manual (select y luego insert/update): condición de carrera que puede
--     duplicar filas. Primero se fusionan duplicados existentes.
do $$ begin
  if to_regclass('public.evento_recursos') is null then return; end if;

  -- fusiona duplicados quedándose con la fila de mayor cantidad
  delete from public.evento_recursos er
   using public.evento_recursos dup
   where er.evento_id = dup.evento_id
     and er.recurso_id = dup.recurso_id
     and er.id <> dup.id
     and (er.cantidad, er.id::text) < (dup.cantidad, dup.id::text);

  create unique index if not exists ux_evento_recursos_par
    on public.evento_recursos (evento_id, recurso_id);
exception when others then
  raise notice 'ux_evento_recursos_par NO creada: %', sqlerrm;
end $$;

-- 1.5 informes.evento_id — reportes.model.js dice "un informe por evento"
--     pero la unicidad solo se valida en JS (carrera → duplicados).
do $$ begin
  create unique index if not exists ux_informes_evento on public.informes (evento_id);
exception when others then
  raise notice 'ux_informes_evento NO creada: % — hay eventos con 2+ informes', sqlerrm;
end $$;

-- 1.6 evaluaciones (id_de_evento, usuario_id) — mismo patrón de upsert manual.
do $$ begin
  create unique index if not exists ux_evaluaciones_evento_usuario
    on public.evaluaciones (id_de_evento, usuario_id);
exception when others then
  raise notice 'ux_evaluaciones_evento_usuario NO creada: %', sqlerrm;
end $$;

-- 1.7 asistencias de NO registrados: unique(id_de_evento, usuario_id) no
--     aplica cuando usuario_id es NULL (NULL nunca es igual a NULL), así que
--     un invitado puede inscribirse N veces con el mismo correo.
do $$ begin
  create unique index if not exists ux_asistencias_evento_correo
    on public.asistencias (id_de_evento, lower(correo))
    where usuario_id is null and correo is not null;
exception when others then
  raise notice 'ux_asistencias_evento_correo NO creada: %', sqlerrm;
end $$;


-- ============================================================================
-- PARTE 2 · CHECKS DE DOMINIO FALTANTES
--   (hoy estas reglas viven solo en JavaScript: cualquier cliente con la API
--    puede insertar valores inválidos)
-- ============================================================================

-- Cantidades y contadores nunca negativos
do $$ begin
  alter table public.recursos drop constraint if exists ck_recursos_cantidad;
  alter table public.recursos add  constraint ck_recursos_cantidad
    check (cantidad >= 0) not valid;

  if to_regclass('public.evento_recursos') is not null then
    alter table public.evento_recursos drop constraint if exists ck_evento_recursos_cantidad;
    alter table public.evento_recursos add  constraint ck_evento_recursos_cantidad
      check (cantidad >= 1) not valid;
  end if;

  alter table public.eventos drop constraint if exists ck_eventos_cupos;
  alter table public.eventos add  constraint ck_eventos_cupos
    check (cupos_disponibles is null or cupos_disponibles >= 0) not valid;

  alter table public.sedes drop constraint if exists ck_sedes_miembros;
  alter table public.sedes add  constraint ck_sedes_miembros
    check (miembros is null or miembros >= 0) not valid;

  alter table public.informes drop constraint if exists ck_informes_ofrenda;
  alter table public.informes add  constraint ck_informes_ofrenda
    check (ofrenda_recaudada is null or ofrenda_recaudada >= 0) not valid;
end $$;

-- Coherencia temporal del evento (no aplica a eventos que cruzan medianoche;
-- si ese caso existe, elimina este check y modela inicio/fin como timestamptz)
alter table public.eventos drop constraint if exists ck_eventos_horario;
alter table public.eventos add  constraint ck_eventos_horario
  check (hora is null or hora_fin is null or hora_fin > hora) not valid;

-- asistencias: toda fila debe identificar a ALGUIEN (usuario registrado o
-- invitado con nombre/correo); y si asistió=true debe existir fecha_asistencia
alter table public.asistencias drop constraint if exists ck_asistencias_identidad;
alter table public.asistencias add  constraint ck_asistencias_identidad
  check (usuario_id is not null or nombre is not null or correo is not null) not valid;

alter table public.asistencias drop constraint if exists ck_asistencias_fecha_asistencia;
alter table public.asistencias add  constraint ck_asistencias_fecha_asistencia
  check (asistió = false or fecha_asistencia is not null) not valid;

-- calificaciones_eventos: al menos un criterio calificado
alter table public.calificaciones_eventos drop constraint if exists ck_calif_alguna;
alter table public.calificaciones_eventos add  constraint ck_calif_alguna
  check (ujieres is not null or sonido is not null or mensaje is not null) not valid;

-- evaluaciones: criterios en rango 1-5 (hoy sin CHECK; solo lo valida el JS)
do $$ begin
  alter table public.evaluaciones drop constraint if exists ck_evaluaciones_rangos;
  alter table public.evaluaciones add  constraint ck_evaluaciones_rangos
    check (
      (puntualidad is null or puntualidad between 1 and 5) and
      (actitud     is null or actitud     between 1 and 5) and
      (desempeno   is null or desempeno   between 1 and 5) and
      (compromiso  is null or compromiso  between 1 and 5)
    ) not valid;
exception when undefined_column then
  raise notice 'ck_evaluaciones_rangos omitido: nombres de columna distintos';
end $$;

-- pqr: formato mínimo de correo (el form público lo inserta como anon)
alter table public.pqr drop constraint if exists ck_pqr_correo;
alter table public.pqr add  constraint ck_pqr_correo
  check (correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid;

-- eventos.categoría: catálogo (documentado solo en un comentario del script
-- original — sin CHECK cualquier texto entra)
alter table public.eventos drop constraint if exists ck_eventos_categoria;
alter table public.eventos add  constraint ck_eventos_categoria
  check (categoría is null or categoría in
         ('Servicio Principal','Jóvenes','Cursos','Célula','Evento Especial')) not valid;

-- Validar el CHECK que quedó NOT VALID en supabase_ajustes_eventos_recursos.sql
-- (los datos ya fueron normalizados a 'Otros' en ese script, así que es seguro)
do $$ begin
  alter table public.recursos validate constraint recursos_categoria_check;
exception when others then
  raise notice 'recursos_categoria_check no validada: %', sqlerrm;
end $$;


-- ============================================================================
-- PARTE 3 · NOT NULL FALTANTES
-- ============================================================================

-- Una notificación sin destinatario no significa nada
do $$ begin
  delete from public.notificaciones where usuario_id is null;
  alter table public.notificaciones alter column usuario_id set not null;
exception when others then
  raise notice 'notificaciones.usuario_id NOT NULL no aplicado: %', sqlerrm;
end $$;


-- ============================================================================
-- PARTE 4 · FOREIGN KEYS FALTANTES (defensivo: solo si la tabla/col existe
--   y la FK no está ya declarada)
-- ============================================================================
do $$
begin
  if to_regclass('public.evento_recursos') is not null and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.evento_recursos'::regclass and contype = 'f'
        and conname = 'fk_evento_recursos_evento') then
    alter table public.evento_recursos
      add constraint fk_evento_recursos_evento
      foreign key (evento_id) references public.eventos(id) on delete cascade;
  end if;

  if to_regclass('public.evento_recursos') is not null and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.evento_recursos'::regclass and contype = 'f'
        and conname = 'fk_evento_recursos_recurso') then
    alter table public.evento_recursos
      add constraint fk_evento_recursos_recurso
      foreign key (recurso_id) references public.recursos(id) on delete cascade;
  end if;
exception when others then
  raise notice 'FKs de evento_recursos: % (¿registros huérfanos? depúralos primero)', sqlerrm;
end $$;

do $$
begin
  if to_regclass('public.actividades') is not null and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.actividades'::regclass and contype = 'f') then
    alter table public.actividades
      add constraint fk_actividades_evento
      foreign key (evento_id) references public.eventos(id) on delete cascade;
    alter table public.actividades
      add constraint fk_actividades_voluntario
      foreign key (voluntario_id) references public.usuarios(id) on delete set null;
  end if;
exception when others then
  raise notice 'FKs de actividades: %', sqlerrm;
end $$;


-- ============================================================================
-- PARTE 5 · ÍNDICES
-- ============================================================================

-- 5.1 Redundantes: la UNIQUE (id_de_evento, usuario_id) ya indexa por
--     id_de_evento como prefijo; estos índices solo encarecen cada INSERT.
drop index if exists idx_asistencias_evento;
drop index if exists idx_voleventos_evento;
drop index if exists idx_califeventos_evento;

-- 5.2 Faltantes (FKs y filtros frecuentes)
create index if not exists idx_eventos_fecha          on public.eventos (fecha);
create index if not exists idx_eventos_estado         on public.eventos (estado);
create index if not exists idx_usuarios_rol           on public.usuarios (rol_id);
create index if not exists idx_evaluaciones_usuario   on public.evaluaciones (usuario_id);
create index if not exists idx_evaluaciones_evento    on public.evaluaciones (id_de_evento);
create index if not exists idx_informes_creado_por    on public.informes (creado_por);
create index if not exists idx_noticias_publicado     on public.noticias (publicado_en desc);
create index if not exists idx_oraciones_publicado    on public.oraciones (publicado_en desc);
create index if not exists idx_pqr_creado             on public.pqr (creado_en desc);
-- bandeja de no leídas: índice parcial (pequeño y ultrarrápido)
create index if not exists idx_notif_usuario_noleidas
  on public.notificaciones (usuario_id) where leída = false;

do $$ begin
  if to_regclass('public.evento_recursos') is not null then
    create index if not exists idx_evento_recursos_recurso
      on public.evento_recursos (recurso_id);
  end if;
  if to_regclass('public.actividades') is not null then
    create index if not exists idx_actividades_evento
      on public.actividades (evento_id);
    create index if not exists idx_actividades_voluntario
      on public.actividades (voluntario_id);
  end if;
end $$;


-- ============================================================================
-- PARTE 6 · RLS — CIERRE DE HUECOS
-- ============================================================================

-- 6.1 Las políticas de UPDATE con "with check (true)" permiten que quien puede
--     editar SU fila la reasigne a OTRO usuario u otro evento. Se replica el
--     mismo predicado del USING en el WITH CHECK.
do $$ begin
  if to_regclass('public.asistencias') is null then return; end if;
  drop policy if exists asis_upd on public.asistencias;
  create policy asis_upd on public.asistencias for update to authenticated
    using      (public.es_staff() or public.mi_rol()='Voluntario' or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or public.mi_rol()='Voluntario' or usuario_id = public.mi_usuario_id());
end $$;

do $$ begin
  if to_regclass('public.voluntarios_eventos') is null then return; end if;
  drop policy if exists ve_upd on public.voluntarios_eventos;
  create policy ve_upd on public.voluntarios_eventos for update to authenticated
    using      (public.es_staff() or usuario_id = public.mi_usuario_id())
    with check (public.es_staff() or usuario_id = public.mi_usuario_id());
end $$;

do $$ begin
  if to_regclass('public.disponibilidad_eventos') is null then return; end if;
  drop policy if exists disp_upd on public.disponibilidad_eventos;
  create policy disp_upd on public.disponibilidad_eventos for update to authenticated
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

-- 6.2 usuarios: el SELECT abierto expone contrasena_hash, correo y teléfono de
--     TODOS los usuarios a CUALQUIER autenticado. Las funciones es_staff()/
--     mi_usuario_id() son SECURITY DEFINER (dueño de la tabla), por lo que NO
--     recursan: es seguro restringir.
do $$ begin
  if to_regclass('public.usuarios') is null then return; end if;
  drop policy if exists usuarios_sel on public.usuarios;
  create policy usuarios_sel on public.usuarios for select to authenticated
    using (public.es_staff() or auth_id = auth.uid());
  -- Si alguna pantalla necesita listar nombres de otros usuarios (p. ej.
  -- asignar voluntarios), créala sobre esta vista y NO sobre la tabla:
  --   create view public.usuarios_directorio as
  --     select id, nombre, especialidad, foto_url from public.usuarios where activo;
end $$;


-- ============================================================================
-- FASE 2 (COMENTADA) — CAMBIOS ESTRUCTURALES QUE REQUIEREN TOCAR LAS APPS
--   Ejecutar UNA sección a la vez, junto con el cambio de código correspondiente.
-- ============================================================================

-- -- 2.1 Unificar nombres: sin tildes/eñes ni mayúsculas, y una sola convención
-- --     para FKs (evento_id, no id_de_evento). Ejemplos:
-- alter table public.asistencias  rename column id_de_evento        to evento_id;
-- alter table public.asistencias  rename column "teléfono"          to telefono;
-- alter table public.asistencias  rename column "fecha_inscripción" to fecha_inscripcion;
-- alter table public.asistencias  rename column "asistió"           to asistio;
-- alter table public.asistencias  rename column "método"            to metodo;
-- alter table public.calificaciones_eventos rename column id_de_evento to evento_id;
-- alter table public.voluntarios_eventos    rename column id_de_evento to evento_id;
-- alter table public.evaluaciones           rename column id_de_evento to evento_id;
-- alter table public.notificaciones rename column "categoría" to categoria;
-- alter table public.notificaciones rename column "título"    to titulo;
-- alter table public.notificaciones rename column "leída"     to leida;
-- alter table public.pqr      rename column "teléfono"    to telefono;
-- alter table public.pqr      rename column "descripción" to descripcion;
-- alter table public.usuarios rename column "teléfono"    to telefono;
-- alter table public.usuarios rename column "ubicación"   to ubicacion;
-- alter table public.usuarios rename column "ocupación"   to ocupacion;
-- alter table public.eventos  rename column "categoría"   to categoria;
-- alter table public.eventos  rename column "código_qr"   to codigo_qr;
-- alter table public.recursos rename column "descripción" to descripcion;
-- alter table public.oraciones rename column "título"     to titulo_oracion; -- ojo si ya hay "titulo"
-- alter table public.noticias rename column "Descripcion" to descripcion;

-- -- 2.2 Eliminar la columna heredada de contraseñas (la clave real vive en
-- --     auth.users; hoy solo guarda el placeholder 'auth'):
-- -- ANTES verifica que no queden hashes reales que necesites migrar:
-- --   select count(*) from public.usuarios where contrasena_hash <> 'auth';
-- alter table public.usuarios drop column contrasena_hash;

-- -- 2.3 Mover el QR fuera de la lectura anónima (hoy cualquier anónimo puede
-- --     leer eventos.código_qr y falsificar asistencias):
-- create table public.eventos_qr (
--   evento_id uuid primary key references public.eventos(id) on delete cascade,
--   codigo    text not null unique,
--   creado_en timestamptz not null default now()
-- );
-- insert into public.eventos_qr (evento_id, codigo)
--   select id, "código_qr" from public.eventos where "código_qr" is not null;
-- alter table public.eventos drop column "código_qr";
-- alter table public.eventos_qr enable row level security;
-- create policy qr_staff on public.eventos_qr for all to authenticated
--   using (public.es_staff()) with check (public.es_staff());

-- -- 2.4 Un solo origen de verdad para el estado de la asistencia: los booleanos
-- --     inscrito/asistió duplican lo que ya dice "estado" y pueden contradecirse.
-- --     Migrar a solo "estado" + fechas, y borrar los booleanos:
-- -- update public.asistencias set estado='asistida' where "asistió" and estado='confirmada';
-- -- alter table public.asistencias drop column inscrito, drop column "asistió";

-- -- 2.5 Referencias por FK en lugar de nombres en texto libre:
-- alter table public.pqr add column respondido_por_id uuid references public.usuarios(id) on delete set null;
-- -- (backfill por nombre y luego)  alter table public.pqr drop column respondido_por;
-- alter table public.evaluaciones add column evaluador_id uuid references public.usuarios(id) on delete set null;
-- -- (backfill)                     alter table public.evaluaciones drop column evaluador_nombre;

-- -- 2.6 Catálogo de especialidades (hoy la lista blanca vive en usuarios.model.js):
-- create table public.especialidades (
--   id uuid primary key default gen_random_uuid(),
--   nombre text not null unique
-- );
-- create table public.usuario_especialidades (
--   usuario_id      uuid not null references public.usuarios(id) on delete cascade,
--   especialidad_id uuid not null references public.especialidades(id) on delete cascade,
--   primary key (usuario_id, especialidad_id)
-- );

-- -- 2.7 sedes.miembros es un dato derivado (contador manual que se desactualiza).
-- --     Sustituir por una vista que cuente usuarios por sede cuando exista esa
-- --     relación, o documentar que es un estimado manual.

-- -- 2.8 Dinero con tipo exacto (si ofrenda_recaudada quedó como float/real):
-- -- alter table public.informes
-- --   alter column ofrenda_recaudada type numeric(12,2)
-- --   using round(ofrenda_recaudada::numeric, 2);
