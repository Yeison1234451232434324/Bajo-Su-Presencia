-- ============================================================================
--  NORMALIZAR ROLES — Bajo Su Presencia  (v2: maneja nombre único)
--  Deja los roles canónicos (Administrador, Colaborador, Voluntario, Usuario)
--  y fusiona duplicados (minúscula/mayúscula) repuntando los usuarios.
--  Orden correcto: elegir ganador → repuntar → BORRAR duplicados → renombrar.
--  Seguro y re-ejecutable.
-- ============================================================================

do $$
declare
  canon   text;
  canones text[] := array['Administrador','Colaborador','Voluntario','Usuario'];
  v_keep  uuid;
begin
  foreach canon in array canones loop
    -- Ganador: preferir el que YA tiene el nombre canónico exacto
    select id into v_keep
    from public.roles
    where lower(trim(nombre)) = lower(canon)
    order by (nombre = canon) desc, id
    limit 1;

    if v_keep is null then
      insert into public.roles (nombre) values (canon) returning id into v_keep;
      continue;  -- recién creado, no hay duplicados que fusionar
    end if;

    -- Repuntar usuarios de las variantes duplicadas hacia el ganador
    update public.usuarios
       set rol_id = v_keep
     where rol_id in (
        select id from public.roles
        where lower(trim(nombre)) = lower(canon) and id <> v_keep
     );

    -- Borrar las variantes duplicadas (ya sin usuarios apuntando a ellas)
    delete from public.roles
     where lower(trim(nombre)) = lower(canon) and id <> v_keep;

    -- Ahora sí renombrar al ganador (ya no hay colisión posible)
    update public.roles set nombre = canon where id = v_keep and nombre <> canon;
  end loop;
end $$;

-- Verificación 1: roles finales (solo los 4 canónicos)
select nombre from public.roles order by nombre;

-- Verificación 2: usuarios con su rol ya normalizado
select u.email, p.nombre, r.nombre as rol
from auth.users u
join public.usuarios p on p.auth_id = u.id
join public.roles    r on r.id = p.rol_id
order by r.nombre, u.email;
