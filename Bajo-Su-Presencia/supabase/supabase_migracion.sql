-- ============================================================================
--  MIGRACIÓN — Bajo Su Presencia
--  Tablas nuevas + columnas faltantes para la app WEB (defbsp) y la app MÓVIL.
--  Motor: PostgreSQL (Supabase)
-- ----------------------------------------------------------------------------
--  IMPORTANTE antes de correr:
--   1. La PK de todas las tablas es "id" (el visualizador de Supabase la
--      muestra como "identificación", pero la columna real es "id").
--   2. gen_random_uuid() ya viene disponible en Supabase.
--   3. Las tablas nuevas se crean SIN RLS. Si consumes vía la API de Supabase,
--      recuerda habilitar RLS y crear políticas (ver nota al final).
--   4. Todo usa "if not exists" / "add column if not exists": es re-ejecutable.
-- ============================================================================


-- ============================================================================
-- PARTE 1 · TABLAS NUEVAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1  asistencias
--      Núcleo de ambas apps. El móvil registra reserva + confirmación por QR;
--      la web (admin) la consulta. Unifica "reserva" y "asistencia".
-- ----------------------------------------------------------------------------
create table if not exists public.asistencias (
  id     uuid        primary key default gen_random_uuid(),
  id_de_evento       uuid        not null references public.eventos(id)  on delete cascade,
  usuario_id         uuid        references public.usuarios(id)          on delete set null,
  nombre             varchar,                       -- asistente no registrado
  correo             varchar,
  teléfono           varchar,
  inscrito           boolean     not null default true,
  fecha_inscripción  timestamptz default now(),
  asistió            boolean     not null default false,
  fecha_asistencia   timestamptz,
  método             text        check (método in ('QR','reserva','manual')),
  estado             text        not null default 'confirmada'
                                 check (estado in ('confirmada','asistida','calificada','cancelada')),
  creado_en          timestamptz default now(),
  unique (id_de_evento, usuario_id)
);

-- ----------------------------------------------------------------------------
-- 1.2  calificaciones_eventos
--      Calificación que el ASISTENTE da al EVENTO (app móvil: ratings/history).
--      NO confundir con "evaluaciones" (esa es para voluntarios).
-- ----------------------------------------------------------------------------
create table if not exists public.calificaciones_eventos (
  id  uuid        primary key default gen_random_uuid(),
  id_de_evento    uuid        not null references public.eventos(id)  on delete cascade,
  usuario_id      uuid        references public.usuarios(id)          on delete set null,
  ujieres         integer     check (ujieres between 1 and 5),
  sonido          integer     check (sonido  between 1 and 5),
  mensaje         integer     check (mensaje between 1 and 5),
  testimonio      text,
  creado_en       timestamptz default now(),
  unique (id_de_evento, usuario_id)
);

-- ----------------------------------------------------------------------------
-- 1.3  notificaciones  (app móvil)
-- ----------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id  uuid        primary key default gen_random_uuid(),
  usuario_id      uuid        references public.usuarios(id) on delete cascade,
  categoría       text        not null
                              check (categoría in ('oración','reserva','evento','calificación','sistema')),
  título          varchar     not null,
  cuerpo          text,
  leída           boolean     not null default false,
  creado_en       timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 1.4  pqr  (Peticiones, Quejas y Reclamos — app web)
-- ----------------------------------------------------------------------------
create table if not exists public.pqr (
  id  uuid        primary key default gen_random_uuid(),
  tipo            text        not null default 'Petición'
                              check (tipo in ('Petición','Queja','Reclamo')),
  nombre          varchar     not null,
  correo          varchar     not null,
  teléfono        varchar,
  asunto          varchar     not null,
  descripción     text        not null,
  estado          text        not null default 'Pendiente'
                              check (estado in ('Pendiente','En proceso','Resuelto','Cerrado')),
  prioridad       text        not null default 'Media'
                              check (prioridad in ('Baja','Media','Alta')),
  respuesta       text,
  respondido_por  varchar,
  respondido_en   timestamptz,
  usuario_id      uuid        references public.usuarios(id) on delete set null,
  creado_en       timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 1.5  voluntarios_eventos
--      Asignación voluntario <-> evento con su rol y disponibilidad.
--      (disponibilidad_eventos solo guarda el booleano; asignaciones es por
--       actividad/tarea, no por evento.)
-- ----------------------------------------------------------------------------
create table if not exists public.voluntarios_eventos (
  id  uuid        primary key default gen_random_uuid(),
  id_de_evento    uuid        not null references public.eventos(id)  on delete cascade,
  usuario_id      uuid        not null references public.usuarios(id) on delete cascade,
  rol_en_evento   varchar,                          -- "Logística", "Música", ...
  disponible      boolean     not null default true,
  creado_en       timestamptz default now(),
  unique (id_de_evento, usuario_id)
);


-- ============================================================================
-- PARTE 2 · COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- ============================================================================

-- 2.1  eventos  (la más incompleta para ambas apps)
alter table public.eventos
  add column if not exists categoría          varchar,                -- Servicio Principal / Jóvenes / Cursos / Célula / Evento Especial
  add column if not exists estado             text default 'Publicado'
                                              check (estado in ('Publicado','En ejecución','Finalizado')),
  add column if not exists expositor          varchar,                -- predicador / líder / host
  add column if not exists cupos_disponibles  integer,
  add column if not exists código_qr          varchar unique,         -- lo escanea el móvil
  add column if not exists hora_fin           time,
  add column if not exists imagen_url         text,
  add column if not exists publicado_en       timestamptz default now();

-- 2.2  usuarios  (perfil web + login)
alter table public.usuarios
  add column if not exists username      varchar unique,
  add column if not exists teléfono      varchar,
  add column if not exists ubicación     varchar,
  add column if not exists ocupación     varchar,
  add column if not exists especialidad  varchar,                     -- Sonido, Música, Cocina...
  add column if not exists bio           text,
  add column if not exists foto_url      text;

-- 2.3  oraciones
alter table public.oraciones
  add column if not exists título      varchar,                       -- tema de la oración
  add column if not exists referencia  varchar;                       -- cita, ej. "Salmos 23:1"

-- 2.4  recursos
alter table public.recursos
  add column if not exists descripción  text,
  add column if not exists unidad       varchar default 'unidades',
  add column if not exists disponible   boolean default true;

-- 2.5  sedes
alter table public.sedes
  add column if not exists ciudad    varchar,
  add column if not exists miembros  integer default 0;

-- 2.6  evaluaciones  (ligar la evaluación del voluntario a un evento)
alter table public.evaluaciones
  add column if not exists id_de_evento uuid references public.eventos(id) on delete cascade;

-- 2.7  informes  (quién creó el reporte)
alter table public.informes
  add column if not exists creado_por uuid references public.usuarios(id) on delete set null;


-- ============================================================================
-- PARTE 3 · DATOS — rol "Usuario/Miembro" que usa la app móvil
--   Ajusta los nombres de columna si tu tabla "roles" los tiene distintos.
-- ============================================================================
insert into public.roles (nombre)
select 'Usuario'
where not exists (select 1 from public.roles where nombre = 'Usuario');


-- ============================================================================
-- PARTE 4 · ÍNDICES (rendimiento en filtros frecuentes por evento/usuario)
-- ============================================================================
create index if not exists idx_asistencias_evento    on public.asistencias(id_de_evento);
create index if not exists idx_asistencias_usuario   on public.asistencias(usuario_id);
create index if not exists idx_califeventos_evento   on public.calificaciones_eventos(id_de_evento);
create index if not exists idx_notificaciones_usuario on public.notificaciones(usuario_id);
create index if not exists idx_voleventos_evento     on public.voluntarios_eventos(id_de_evento);
create index if not exists idx_voleventos_usuario    on public.voluntarios_eventos(usuario_id);
create index if not exists idx_pqr_estado            on public.pqr(estado);


-- ============================================================================
-- NOTA SOBRE RLS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Si consumes estas tablas desde la API de Supabase (anon/auth key), debes
-- habilitar RLS y crear políticas, p. ej.:
--
--   alter table public.asistencias enable row level security;
--   create policy "lectura_publica" on public.asistencias
--     for select using (true);
--   create policy "insert_autenticado" on public.asistencias
--     for insert with check (auth.role() = 'authenticated');
--
-- Repite para cada tabla nueva según tus reglas de acceso.
-- ============================================================================
