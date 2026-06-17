-- ============================================================================
--  FIX RLS — recursión infinita en "usuarios" (error 42P17)  [v2 a prueba de balas]
--  Borra TODAS las políticas actuales de usuarios (por si hay duplicadas/viejas
--  recursivas) y las recrea limpias. La política SELECT NO llama funciones que
--  lean usuarios → sin recursión. Re-ejecutable.
-- ============================================================================

-- (Re)crea helpers como SECURITY DEFINER
create or replace function public.mi_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_id = auth.uid() limit 1
$$;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select r.nombre from public.usuarios u
  join public.roles r on r.id = u.rol_id
  where u.auth_id = auth.uid() limit 1
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_rol() = 'Administrador'
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_rol() in ('Administrador','Colaborador')
$$;

-- 1) BORRAR TODAS las políticas existentes de usuarios (limpia duplicadas/recursivas)
do $$
declare p record;
begin
  for p in
    select polname from pg_policy where polrelid = 'public.usuarios'::regclass
  loop
    execute format('drop policy if exists %I on public.usuarios', p.polname);
  end loop;
end $$;

-- 2) Asegura que RLS siga activo
alter table public.usuarios enable row level security;

-- 3) Recrear políticas LIMPIAS
--    SELECT: abierto a autenticados (NO llama funciones que lean usuarios)
create policy usuarios_sel on public.usuarios
  for select to authenticated using (true);

--    INSERT/UPDATE/DELETE: por rol (es_admin lee usuarios vía la SELECT=true → sin recursión)
create policy usuarios_ins on public.usuarios for insert to authenticated
  with check (public.es_admin());

create policy usuarios_upd on public.usuarios for update to authenticated
  using (public.es_admin() or auth_id = auth.uid())
  with check (public.es_admin() or auth_id = auth.uid());

create policy usuarios_del on public.usuarios for delete to authenticated
  using (public.es_admin());

-- 4) Verificación A: lista las políticas de usuarios (SELECT debe decir 'true')
select polname,
       (case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                    when 'w' then 'UPDATE' when 'd' then 'DELETE' else polcmd::text end) as cmd,
       pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polrelid = 'public.usuarios'::regclass
order by polname;

-- 5) Verificación B: esto NO debe dar error
select count(*) as usuarios_visibles from public.usuarios;
