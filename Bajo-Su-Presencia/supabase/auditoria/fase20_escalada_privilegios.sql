-- ============================================================================
--  FASE 20 · CIERRE DE ESCALACIÓN DE PRIVILEGIOS  (demostrada en vivo)
--
--  HALLAZGO CRÍTICO (probado con SET ROLE authenticated + claims JWT reales):
--  un usuario NO-admin puede modificar SU PROPIA fila en `usuarios` — incluida
--  la columna rol_id — vía la API PostgREST con su token, saltándose el backend
--  (que sí depura rol_id). La política usuarios_upd autoriza `auth_id=auth.uid()`
--  en USING y WITH CHECK sin proteger columnas sensibles. Un Voluntario puede
--  así asignarse el rol 'Administrador'. Evidencia: UPDATE afectó 1 fila y el
--  usuario quedó como Administrador (dentro de una transacción con ROLLBACK).
--
--  Por qué un trigger y no privilegios de columna: en Supabase todos los
--  usuarios logueados comparten el rol Postgres `authenticated`; revocar
--  UPDATE(rol_id) también bloquearía a los admins. Y RLS WITH CHECK no puede
--  comparar el valor ANTERIOR. Un trigger BEFORE UPDATE es la única vía que
--  distingue admin de no-admin y compara OLD vs NEW.
--  Idempotente.
-- ============================================================================

create or replace function public.tg_usuarios_guard_campos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Solo un administrador puede cambiar rol, estado de actividad o el vínculo
  -- de autenticación de CUALQUIER fila (incluida la propia).
  if not public.es_admin() then
    if new.rol_id  is distinct from old.rol_id
    or new.activo  is distinct from old.activo
    or new.auth_id is distinct from old.auth_id then
      raise exception 'No autorizado: rol_id/activo/auth_id solo los modifica un administrador'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_usuarios_guard on public.usuarios;
create trigger trg_usuarios_guard
  before update on public.usuarios
  for each row execute function public.tg_usuarios_guard_campos();

comment on function public.tg_usuarios_guard_campos() is
  'Impide que un no-admin modifique rol_id/activo/auth_id (incluida su propia fila) por la API. Complementa la política usuarios_upd.';
