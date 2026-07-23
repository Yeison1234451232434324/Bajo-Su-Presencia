-- ============================================================================
--  FASE 4 · NORMALIZACIÓN Y ELIMINACIÓN DE REDUNDANCIAS
--  - Catálogo de especialidades (N:M) en vez de texto libre en usuarios
--  - QR de eventos a tabla privada (hoy es legible por anónimos)
--  - FKs reales en vez de nombres en texto libre (pqr, evaluaciones)
--  - evaluaciones: 4 criterios idénticos → una columna estrellas
--  - asistencias: colapsar banderas inscrito/asistio en "estado"
--  - disponibilidad_eventos (duplica voluntarios_eventos.disponible) → fusión
--  - sedes.miembros (dato derivado manual) → eliminado (respaldado)
--  - Tipos: dinero a numeric(12,2); token_hash char(64) → text
--  Requiere: FASES 1-3. Re-ejecutable.
-- ============================================================================

-- ===========================================
-- 4.1 Catálogo de especialidades + relación N:M usuario↔especialidad
--     (la lista blanca vivía hardcodeada en usuarios.model.js)
-- ===========================================
create table if not exists public.especialidades (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  creado_en timestamptz not null default now()
);

insert into public.especialidades (nombre)
select v.n from (values
  ('Música / Alabanza'), ('Sonido y Audio'), ('Multimedia / Proyección'),
  ('Logística'), ('Cocina'), ('Ministerio Infantil'),
  ('Predicación / Enseñanza'), ('Decoración'), ('Ujieres / Protocolo'),
  ('Primeros Auxilios'), ('Transporte'), ('Fotografía / Video')
) v(n)
where not exists (select 1 from public.especialidades e where e.nombre = v.n);

create table if not exists public.usuario_especialidades (
  usuario_id      uuid not null references public.usuarios(id)       on delete cascade,
  especialidad_id uuid not null references public.especialidades(id) on delete cascade,
  primary key (usuario_id, especialidad_id)
);

-- Migrar el valor libre usuarios.especialidad al catálogo y eliminar la columna
do $$ begin
  if not aud.col_exists('usuarios', 'especialidad') then return; end if;

  -- valores existentes que no están en el catálogo se agregan (no se pierden)
  insert into public.especialidades (nombre)
  select distinct trim(especialidad) from public.usuarios
  where especialidad is not null and trim(especialidad) <> ''
    and not exists (select 1 from public.especialidades e
                    where lower(e.nombre) = lower(trim(usuarios.especialidad)));

  insert into public.usuario_especialidades (usuario_id, especialidad_id)
  select u.id, e.id
  from public.usuarios u
  join public.especialidades e on lower(e.nombre) = lower(trim(u.especialidad))
  where u.especialidad is not null and trim(u.especialidad) <> ''
  on conflict do nothing;

  alter table public.usuarios drop column especialidad;
  raise notice 'usuarios.especialidad migrada a usuario_especialidades y eliminada';
end $$;

-- ===========================================
-- 4.2 QR de eventos → tabla privada (el secreto de asistencia NO puede ser
--     legible por anon; hoy lo es vía eventos_sel_anon)
-- ===========================================
create table if not exists public.eventos_qr (
  evento_id uuid primary key references public.eventos(id) on delete cascade,
  codigo    text not null unique,
  creado_en timestamptz not null default now()
);

do $$ begin
  if not aud.col_exists('eventos', 'codigo_qr') then return; end if;
  insert into public.eventos_qr (evento_id, codigo)
  select id, codigo_qr from public.eventos where codigo_qr is not null
  on conflict do nothing;
  alter table public.eventos drop column codigo_qr;
  raise notice 'eventos.codigo_qr migrado a eventos_qr y eliminado de eventos';
end $$;

-- ===========================================
-- 4.3 pqr.respondido_por (nombre en texto libre) → FK respondido_por_id
--     Backfill por coincidencia inequívoca de nombre; luego se elimina el texto
-- ===========================================
alter table public.pqr
  add column if not exists respondido_por_id uuid references public.usuarios(id) on delete set null;

do $$ begin
  if not aud.col_exists('pqr', 'respondido_por') then return; end if;

  update public.pqr p
     set respondido_por_id = m.id
    from (select nombre, min(id::text)::uuid as id, count(*) as n
          from public.usuarios group by nombre) m
   where m.nombre = p.respondido_por and m.n = 1
     and p.respondido_por_id is null;

  -- los nombres sin correspondencia quedan respaldados en aud.bk_pqr
  alter table public.pqr drop column respondido_por;
end $$;

-- ===========================================
-- 4.4 evaluaciones:
--     a) evaluador_nombre (texto de localStorage, falsificable) → evaluador_id FK
--     b) 4 criterios que siempre reciben el mismo valor → una columna estrellas
-- ===========================================
alter table public.evaluaciones
  add column if not exists evaluador_id uuid references public.usuarios(id) on delete set null,
  add column if not exists estrellas smallint;

do $$ begin
  if not aud.col_exists('evaluaciones', 'evaluador_nombre') then return; end if;
  update public.evaluaciones e
     set evaluador_id = m.id
    from (select nombre, min(id::text)::uuid as id, count(*) as n
          from public.usuarios group by nombre) m
   where m.nombre = e.evaluador_nombre and m.n = 1
     and e.evaluador_id is null;
  alter table public.evaluaciones drop column evaluador_nombre;
end $$;

do $$ begin
  if not aud.col_exists('evaluaciones', 'puntualidad') then return; end if;
  -- promedio de los criterios presentes (la web escribía el mismo valor en los 4)
  update public.evaluaciones set estrellas = round(
      ( coalesce(puntualidad,0) + coalesce(actitud,0)
      + coalesce(desempeno,0)   + coalesce(compromiso,0) )::numeric
      / nullif( (puntualidad is not null)::int + (actitud is not null)::int
              + (desempeno   is not null)::int + (compromiso is not null)::int, 0))
  where estrellas is null;

  alter table public.evaluaciones
    drop column puntualidad, drop column actitud,
    drop column desempeno,   drop column compromiso;
  raise notice 'evaluaciones: criterios colapsados en "estrellas" (originales en aud.bk_evaluaciones)';
end $$;

-- ===========================================
-- 4.5 asistencias: "estado" es la única fuente de verdad del ciclo de vida.
--     Las banderas inscrito/asistio lo duplicaban y podían contradecirlo
--     (la coherencia ya se restauró en la FASE 2.8)
-- ===========================================
do $$ begin
  if aud.col_exists('asistencias', 'asistio') then
    update public.asistencias set estado = 'asistida'
     where asistio = true and estado = 'confirmada';
    alter table public.asistencias drop column asistio;
  end if;
  if aud.col_exists('asistencias', 'inscrito') then
    update public.asistencias set estado = 'cancelada'
     where inscrito = false and estado <> 'cancelada';
    alter table public.asistencias drop column inscrito;
  end if;
end $$;

-- ===========================================
-- 4.6 disponibilidad_eventos duplica voluntarios_eventos.disponible:
--     fusionar y eliminar la tabla (snapshot en aud.bk_disponibilidad_eventos)
-- ===========================================
do $$
declare col_ev text;
begin
  if to_regclass('public.disponibilidad_eventos') is null then return; end if;

  col_ev := case when aud.col_exists('disponibilidad_eventos', 'evento_id')    then 'evento_id'
                 when aud.col_exists('disponibilidad_eventos', 'id_de_evento') then 'id_de_evento'
                 else null end;

  if col_ev is not null
     and aud.col_exists('disponibilidad_eventos', 'usuario_id')
     and aud.col_exists('disponibilidad_eventos', 'disponible') then
    execute format(
      'insert into public.voluntarios_eventos (evento_id, usuario_id, disponible)
         select %I, usuario_id, disponible from public.disponibilidad_eventos
         where %I is not null and usuario_id is not null
       on conflict (evento_id, usuario_id)
       do update set disponible = excluded.disponible', col_ev, col_ev);
    raise notice 'disponibilidad_eventos fusionada en voluntarios_eventos';
  else
    raise notice 'disponibilidad_eventos con estructura inesperada: solo se respalda y elimina';
  end if;

  drop table public.disponibilidad_eventos;
end $$;

-- ===========================================
-- 4.7 sedes.miembros: contador manual derivado (anomalía de actualización).
--     Se elimina; el histórico queda en aud.bk_sedes.miembros
-- ===========================================
alter table public.sedes drop column if exists miembros;

-- ===========================================
-- 4.8 Dinero con tipo exacto: ofrenda_recaudada → numeric(12,2)
--     (float/real acumula errores de redondeo)
-- ===========================================
do $$
declare t text;
begin
  select data_type into t from information_schema.columns
  where table_schema = 'public' and table_name = 'informes'
    and column_name = 'ofrenda_recaudada';
  if t in ('real', 'double precision', 'integer', 'bigint') then
    alter table public.informes
      alter column ofrenda_recaudada type numeric(12,2)
      using round(ofrenda_recaudada::numeric, 2);
    raise notice 'informes.ofrenda_recaudada migrada de % a numeric(12,2)', t;
  end if;
end $$;

-- ===========================================
-- 4.9 password_resets.token_hash: char(64) rellena con espacios y compara
--     con reglas traicioneras → text + CHECK de longitud exacta
-- ===========================================
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'password_resets'
               and column_name = 'token_hash' and data_type = 'character') then
    alter table public.password_resets
      alter column token_hash type text using rtrim(token_hash);
  end if;
  alter table public.password_resets drop constraint if exists ck_password_resets_token_len;
  alter table public.password_resets add constraint ck_password_resets_token_len
    check (char_length(token_hash) = 64);
exception when others then
  raise notice 'password_resets.token_hash: %', sqlerrm;
end $$;
