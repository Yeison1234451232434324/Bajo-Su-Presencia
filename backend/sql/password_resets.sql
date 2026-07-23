-- ─────────────────────────────────────────────────────────────
--  Tokens de recuperación de contraseña.
--  El token se guarda HASHEADO (sha256 hex = 64 chars); nunca en claro.
--  Solo lo usa el backend con la service_role key.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.password_resets (
    id          uuid primary key default gen_random_uuid(),
    usuario_id  uuid not null references public.usuarios(id) on delete cascade,
    token_hash  char(64) not null,
    expira_en   timestamptz not null,
    usado       boolean not null default false,
    creado_en   timestamptz not null default now()
);

create unique index if not exists ux_password_resets_token_hash
    on public.password_resets (token_hash);

create index if not exists ix_password_resets_usuario_activo
    on public.password_resets (usuario_id) where usado = false;

alter table public.password_resets enable row level security;
