-- ============================================================================
--  FASE 1 · PREPARACIÓN — Bajo Su Presencia (PostgreSQL 16+ / Supabase)
--  - Crea el esquema "aud" (utilidades + respaldos internos)
--  - Funciones helper para scripts idempotentes
--  - Respaldo (snapshot) de TODAS las tablas de public antes de tocar nada
--  Re-ejecutable: no duplica respaldos ya tomados.
-- ============================================================================

-- ===========================================
-- Esquema interno de auditoría (helpers + respaldos)
-- Inaccesible para anon/authenticated (solo service_role/postgres)
-- ===========================================
create schema if not exists aud;
revoke all on schema aud from anon, authenticated;

-- ===========================================
-- Helper: ¿existe la columna?
-- ===========================================
create or replace function aud.col_exists(p_tbl text, p_col text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_tbl and column_name = p_col
  );
$$;

-- ===========================================
-- Helper: renombrar columna solo si el nombre viejo existe
-- y el nuevo todavía no (idempotente)
-- ===========================================
create or replace function aud.rename_col(p_tbl text, p_old text, p_new text)
returns void language plpgsql as $$
begin
  if to_regclass('public.' || quote_ident(p_tbl)) is null then return; end if;
  if aud.col_exists(p_tbl, p_old) and not aud.col_exists(p_tbl, p_new) then
    execute format('alter table public.%I rename column %I to %I', p_tbl, p_old, p_new);
    raise notice 'Renombrada %.% -> %', p_tbl, p_old, p_new;
  end if;
end;
$$;

-- ===========================================
-- Helper: agrega un CHECK reemplazando el anterior del mismo nombre;
-- si los datos lo violan, avisa con NOTICE y lo deja NOT VALID
-- ===========================================
create or replace function aud.add_check(p_tbl text, p_name text, p_expr text)
returns void language plpgsql as $$
begin
  if to_regclass('public.' || quote_ident(p_tbl)) is null then return; end if;
  execute format('alter table public.%I drop constraint if exists %I', p_tbl, p_name);
  begin
    execute format('alter table public.%I add constraint %I check (%s)', p_tbl, p_name, p_expr);
  exception when check_violation then
    execute format('alter table public.%I add constraint %I check (%s) not valid', p_tbl, p_name, p_expr);
    raise notice 'CHECK % en % quedó NOT VALID: hay filas históricas que lo violan', p_name, p_tbl;
  end;
end;
$$;

-- ===========================================
-- Respaldo: snapshot de todas las tablas de public en aud.bk_<tabla>
-- Solo la primera vez (IF NOT EXISTS): conserva el estado PREVIO a la migración
-- ===========================================
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('create table if not exists aud.%I as select * from public.%I',
                   'bk_' || t.tablename, t.tablename);
  end loop;
  raise notice 'Respaldo completo en el esquema aud (tablas bk_*)';
end $$;
