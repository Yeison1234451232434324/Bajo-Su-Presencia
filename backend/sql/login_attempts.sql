-- ─────────────────────────────────────────────────────────────
--  Tabla de intentos de inicio de sesión y bloqueo por fuerza bruta.
--  Solo la usa el backend con la service_role key.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.login_attempts (
    email           text primary key,
    intentos        integer     not null default 0,
    bloqueado_hasta timestamptz null,
    actualizado_en  timestamptz not null default now()
);

-- Búsqueda por estado de bloqueo (limpieza/auditoría).
create index if not exists ix_login_attempts_bloqueo
    on public.login_attempts (bloqueado_hasta);

-- RLS activado SIN políticas públicas: ninguna clave anon/authenticated puede
-- leer ni escribir esta tabla; solo la service_role (backend) la maneja.
alter table public.login_attempts enable row level security;
