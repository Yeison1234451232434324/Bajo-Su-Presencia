-- ============================================================================
--  FASE 15 · ATOMICIDAD DEL NOMBRE (1FN): usuarios.nombre → nombres + apellidos
--
--  Problema: usuarios.nombre guardaba nombre(s) y apellido(s) en un solo campo
--  (violación de atomicidad — 1FN): imposible ordenar/buscar por apellido o
--  formatear "Apellido, Nombre" sin parsear texto en cada consulta.
--
--  Diseño:
--   - Hechos atómicos: columnas "nombres" y "apellidos" (apellidos opcional:
--     no se fabrican datos donde no los hay).
--   - "nombre" se conserva como COLUMNA GENERADA (nombre completo, solo
--     lectura): los ~7 lectores de las apps (`usuarios(nombre)`, vistas,
--     order=nombre.asc) siguen funcionando sin cambios. Al derivarla la BD,
--     no hay redundancia actualizable (sin anomalías; 3FN intacta).
--   - Los ESCRITORES deben migrar a nombres/apellidos (ver README):
--     backend PHP (UsuariosService.mapFields) y el trigger handle_new_user
--     (actualizado aquí mismo — de lo contrario cada signup fallaría).
--
--  División de datos existentes (convención hispana, mejor esfuerzo):
--   2 palabras → 1+1 · 3 palabras → 1+2 · 4+ palabras → (n-2)+2 · 1 → sin
--   apellidos. El original queda en aud.bk_usuarios_nombres para corrección
--   manual; la división corre UNA sola vez por fila (marcador "separado").
--
--  Idempotente. Requiere FASE 1 (helpers aud.*).
-- ============================================================================

-- ===========================================
-- 15.1 Respaldo del valor original (una vez por usuario)
-- ===========================================
create table if not exists aud.bk_usuarios_nombres (
  id              uuid primary key,
  nombre_original text not null,
  separado        boolean not null default false,
  guardado_en     timestamptz not null default now()
);

do $$ begin
  if aud.col_exists('usuarios', 'nombre')
     and not aud.col_exists('usuarios', 'nombres') then
    insert into aud.bk_usuarios_nombres (id, nombre_original)
    select id, nombre from public.usuarios
    on conflict (id) do nothing;
  end if;
end $$;

-- ===========================================
-- 15.2 Estructura: rename nombre→nombres + columna apellidos
-- (solo en la primera ejecución; después "nombre" ya es la generada)
-- ===========================================
do $$ begin
  if not aud.col_exists('usuarios', 'nombres') then
    alter table public.usuarios rename column nombre to nombres;
    raise notice 'usuarios.nombre renombrada a nombres';
  end if;
end $$;

alter table public.usuarios add column if not exists apellidos varchar(120);

-- ===========================================
-- 15.3 División de los datos existentes (una sola vez por fila)
-- ===========================================
do $$
declare
  r record; t text[]; n int; v_nombres text; v_apellidos text;
begin
  for r in
    select u.id, u.nombres
    from public.usuarios u
    join aud.bk_usuarios_nombres b on b.id = u.id and not b.separado
  loop
    t := regexp_split_to_array(trim(regexp_replace(r.nombres, '\s+', ' ', 'g')), ' ');
    n := coalesce(array_length(t, 1), 0);
    if n >= 4 then
      v_nombres   := array_to_string(t[1:n-2], ' ');
      v_apellidos := t[n-1] || ' ' || t[n];
    elsif n = 3 then
      v_nombres   := t[1];
      v_apellidos := t[2] || ' ' || t[3];
    elsif n = 2 then
      v_nombres   := t[1];
      v_apellidos := t[2];
    else
      v_nombres   := trim(r.nombres);
      v_apellidos := null;
    end if;

    update public.usuarios
       set nombres = v_nombres, apellidos = v_apellidos
     where id = r.id;
    update aud.bk_usuarios_nombres set separado = true where id = r.id;
    raise notice 'usuario %: nombres=%, apellidos=%', r.id, v_nombres, coalesce(v_apellidos, '(sin)');
  end loop;
end $$;

-- ===========================================
-- 15.4 Dominios: sin cadenas vacías ni espacios colgantes
-- ===========================================
select aud.add_check('usuarios', 'ck_usuarios_nombres',
  $$length(trim(nombres)) > 0 and nombres = trim(nombres)$$);
select aud.add_check('usuarios', 'ck_usuarios_apellidos',
  $$apellidos is null or (length(trim(apellidos)) > 0 and apellidos = trim(apellidos))$$);

-- ===========================================
-- 15.5 "nombre" vuelve como COLUMNA GENERADA (nombre completo, solo lectura).
-- Compatibilidad total para lectores; los escritores que intenten INSERT/
-- UPDATE sobre ella reciben error 428C9 — señal explícita de migrar.
-- ===========================================
do $$ begin
  if not aud.col_exists('usuarios', 'nombre') then
    alter table public.usuarios add column nombre varchar(210)
      generated always as (
        case when apellidos is null then nombres
             else nombres || ' ' || apellidos end
      ) stored;
    raise notice 'usuarios.nombre recreada como columna generada';
  end if;
end $$;

-- ===========================================
-- 15.6 Re-vincular la vista del directorio a la columna generada.
-- (El rename de 15.2 dejó la vista apuntando a "nombres".)
-- DROP + CREATE porque REPLACE no permite cambiar el tipo de la columna
-- nombre (varchar(100) → varchar(210)); los GRANTs se pierden con el DROP,
-- así que se re-aplican explícitamente abajo (mismos que la fase 8).
-- ===========================================
drop view if exists public.usuarios_directorio;
create view public.usuarios_directorio as
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
-- 15.7 handle_new_user(): escribir los hechos atómicos.
-- Acepta metadatos nuevos (nombres/apellidos); si solo llega el legado
-- "nombre", va íntegro a nombres (NO se adivinan apellidos en el alta).
-- ===========================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol uuid;
begin
  begin
    select id into v_rol from public.roles where nombre = 'Usuario' limit 1;

    update public.usuarios set auth_id = new.id
     where lower(correo_electronico) = lower(new.email) and auth_id is null;

    if not found then
      insert into public.usuarios (auth_id, nombres, apellidos, correo_electronico, rol_id, activo)
      values (new.id,
              coalesce(nullif(trim(new.raw_user_meta_data->>'nombres'), ''),
                       nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
                       split_part(new.email, '@', 1)),
              nullif(trim(new.raw_user_meta_data->>'apellidos'), ''),
              lower(new.email), v_rol, true);
    end if;
  exception when others then
    raise warning 'handle_new_user falló para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$;

-- ===========================================
-- 15.8 Documentación en el catálogo
-- ===========================================
comment on column public.usuarios.nombres   is 'Nombre(s) de pila — hecho atómico (1FN).';
comment on column public.usuarios.apellidos is 'Apellido(s) — hecho atómico; NULL cuando no se conoce (no se fabrican datos).';
comment on column public.usuarios.nombre    is 'GENERADA (solo lectura): nombre completo para visualización y compatibilidad de lectores. Escribir en nombres/apellidos.';

-- ===========================================
-- Verificación final: cómo quedó cada usuario
-- ===========================================
select u.nombres, u.apellidos, u.nombre as nombre_completo,
       b.nombre_original
from public.usuarios u
left join aud.bk_usuarios_nombres b on b.id = u.id
order by u.nombre;
