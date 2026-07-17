-- ============================================================================
--  FASE 11 · AJUSTES POST-CERTIFICACIÓN
--  Corrige los hallazgos NUEVOS de la segunda auditoría (columnas legadas que
--  ningún script anterior conocía + defectos demostrados con sondeos reales).
--  Idempotente. Requiere FASE 1 (helpers aud.*).
-- ============================================================================

-- ===========================================
-- 11.1 [ALTA — demostrado con sondeo] actividades.prioridad:
-- DEFAULT 'Media' viola su propio CHECK ('alta','media','baja').
-- Cualquier INSERT que confíe en el default falla con 23514.
-- ===========================================
alter table public.actividades alter column prioridad set default 'media';

-- ===========================================
-- 11.2 [ALTA — demostrado con sondeo] usuarios.correo_electronico acepta
-- correos con espacios y sin formato (entró '  x@y.com '). Se normaliza lo
-- existente y se exige formato a lo nuevo.
-- ===========================================
update public.usuarios
   set correo_electronico = lower(trim(correo_electronico))
 where correo_electronico <> lower(trim(correo_electronico));

select aud.add_check('usuarios', 'ck_usuarios_correo',
  $$correo_electronico = lower(trim(correo_electronico))
    and correo_electronico ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'$$);

-- ===========================================
-- 11.3 [MEDIA] Índice único redundante: usuarios_email_key (exacto) convive
-- con ux_usuarios_correo (lower()). El de lower() es más estricto: el otro
-- sobra y encarece cada INSERT/UPDATE.
-- ===========================================
alter table public.usuarios drop constraint if exists usuarios_email_key;
drop index if exists public.usuarios_email_key;

-- ===========================================
-- 11.4 [MEDIA] roles."ID_rol": columna legada con datos basura ('ID_1','ID_3',
-- NULL) que duplica la PK. Respaldada en aud.bk_roles → se elimina.
-- ===========================================
alter table public.roles drop column if exists "ID_rol";

-- ===========================================
-- 11.5 [MEDIA] usuarios.area_voluntario: texto libre legado que duplica el
-- catálogo usuario_especialidades. Se migra lo que tenga valor y se elimina.
-- ===========================================
do $$ begin
  if not aud.col_exists('usuarios', 'area_voluntario') then return; end if;

  insert into public.especialidades (nombre)
  select distinct trim(area_voluntario) from public.usuarios
  where area_voluntario is not null and trim(area_voluntario) <> ''
    and not exists (select 1 from public.especialidades e
                    where lower(e.nombre) = lower(trim(usuarios.area_voluntario)));

  insert into public.usuario_especialidades (usuario_id, especialidad_id)
  select u.id, e.id
  from public.usuarios u
  join public.especialidades e on lower(e.nombre) = lower(trim(u.area_voluntario))
  where u.area_voluntario is not null and trim(u.area_voluntario) <> ''
  on conflict do nothing;

  alter table public.usuarios drop column area_voluntario;
end $$;

-- ===========================================
-- 11.6 [MEDIA] informes: evento_id nullable no tiene sentido (un informe sin
-- evento no es de nada). Filas huérfanas → respaldo aud.bk_informes y fuera.
-- ===========================================
delete from public.informes where evento_id is null;
do $$ begin
  alter table public.informes alter column evento_id set not null;
exception when others then raise notice 'informes.evento_id NOT NULL: %', sqlerrm;
end $$;

-- ===========================================
-- 11.7 [MEDIA] asignaciones: registrado_en duplica creado_en (redundancia) y
-- estado no tiene dominio. Tabla vacía hoy (0 filas): cambio sin riesgo.
-- ===========================================
do $$ begin
  if aud.col_exists('asignaciones', 'registrado_en') and aud.col_exists('asignaciones', 'creado_en') then
    update public.asignaciones set creado_en = registrado_en
     where registrado_en is not null and creado_en is distinct from registrado_en;
    alter table public.asignaciones drop column registrado_en;
  end if;
end $$;
select aud.add_check('asignaciones', 'ck_asignaciones_estado',
  $$estado in ('pendiente','en progreso','completada','cancelada')$$);

-- ===========================================
-- 11.8 [BAJA] timestamps legados sin zona horaria → timestamptz (los nuevos
-- creado_en/actualizado_en ya la tienen; estos quedaron del esquema original).
-- Interpretación: los valores existentes se asumen UTC.
-- ===========================================
do $$
declare
  par text[];
  pares constant text[][] := array[
    ['usuarios',     'creado_en'],
    ['noticias',     'publicado_en'],
    ['oraciones',    'publicado_en'],
    ['evaluaciones', 'evaluado_en'],
    ['informes',     'created_at']
  ];
begin
  foreach par slice 1 in array pares loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = par[1]
                 and column_name = par[2]
                 and data_type = 'timestamp without time zone') then
      execute format(
        'alter table public.%I alter column %I type timestamptz using %I at time zone ''utc''',
        par[1], par[2], par[2]);
      raise notice '%.% -> timestamptz', par[1], par[2];
    end if;
  end loop;
end $$;

-- ===========================================
-- 11.9 [BAJA] informes.created_at rompe la convención en español del resto
-- del esquema → creado_en.
-- ⚠ Actualizar models/reportes.model.js (usa r.created_at).
-- ===========================================
select aud.rename_col('informes', 'created_at', 'creado_en');

-- ===========================================
-- 11.10 [BAJA] sedes.pastor_encargado es NOT NULL pero el formulario web lo
-- envía null cuando está vacío (insert fallaría). Se relaja: es opcional.
-- ===========================================
do $$ begin
  alter table public.sedes alter column pastor_encargado drop not null;
exception when others then null;
end $$;

-- ===========================================
-- 11.11 [BAJA] eventos.voluntarios_necesarios DEFAULT 10 es un número mágico;
-- el valor neutro es 0 (el modelo JS ya envía 0 cuando no se indica).
-- ===========================================
alter table public.eventos alter column voluntarios_necesarios set default 0;

-- ===========================================
-- 11.12 [BAJA] recursos.stock_minimo (columna legada, hoy sin uso en la app):
-- dominio mínimo.
-- ===========================================
select aud.add_check('recursos', 'ck_recursos_stock_minimo', 'stock_minimo >= 0');

-- ===========================================
-- Verificación final de esta fase
-- ===========================================
select 'columnas_legadas_restantes' as indicador,
       coalesce(string_agg(table_name || '.' || column_name, ', '), '(ninguna)') as valor
from information_schema.columns
where table_schema = 'public'
  and (column_name in ('ID_rol', 'area_voluntario', 'registrado_en', 'created_at')
       or column_name ~ '[^a-z0-9_]')
union all
select 'timestamps_sin_tz',
       coalesce(string_agg(table_name || '.' || column_name, ', '), '(ninguno)')
from information_schema.columns
where table_schema = 'public' and data_type = 'timestamp without time zone';
