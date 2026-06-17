-- ============================================================================
--  DIAGNÓSTICO v2 — devuelve TODO como tabla (Supabase no muestra los NOTICE)
--  Corre TODO y pégame la tabla final completa.
-- ============================================================================

create temp table if not exists _diag (clave text, valor text);
truncate _diag;

-- 1) ¿Cuántos usuarios hay en Auth y en la tabla? ¿Existe el admin en Auth?
insert into _diag select 'auth_users_total', count(*)::text from auth.users;
insert into _diag select 'usuarios_total',   count(*)::text from public.usuarios;
insert into _diag select 'admin_en_auth',
  case when exists (select 1 from auth.users where email='admin@correo.com') then 'SI' else 'NO' end;
insert into _diag select 'rol_Usuario_existe',
  case when exists (select 1 from public.roles where nombre='Usuario') then 'SI' else 'NO' end;

-- 2) Columnas OBLIGATORIAS de usuarios (NOT NULL sin default) → el trigger DEBE llenarlas
insert into _diag
select 'columnas_obligatorias',
       coalesce(string_agg(column_name, ', ' order by ordinal_position), '(ninguna)')
from information_schema.columns
where table_schema='public' and table_name='usuarios'
  and is_nullable='NO' and column_default is null;

-- 3) Reproduce el INSERT del trigger y captura el error real
do $$
begin
  insert into public.usuarios (nombre, correo_electronico, contrasena_hash, rol_id, activo)
  values ('TEST_DIAG',
          'test_diag_' || floor(random()*1000000)::text || '@x.com',
          'auth',
          (select id from public.roles where nombre='Usuario'),
          true);
  insert into _diag values ('insert_perfil', '✅ OK — el insert funciona');
  delete from public.usuarios where nombre='TEST_DIAG';
exception when others then
  insert into _diag values ('insert_perfil', '❌ ' || sqlerrm || ' (SQLSTATE ' || sqlstate || ')');
end $$;

-- Resultado: pégame esta tabla completa
select * from _diag order by clave;
