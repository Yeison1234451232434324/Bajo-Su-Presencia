-- ============================================================================
--  FIX RLS — voluntarios_eventos: permitir que un voluntario se inscriba/quite
--  a sí mismo (la política de insert era solo para staff). Re-ejecutable.
-- ============================================================================

drop policy if exists ve_ins on public.voluntarios_eventos;
create policy ve_ins on public.voluntarios_eventos for insert to authenticated
  with check (public.es_staff() or usuario_id = public.mi_usuario_id());

drop policy if exists ve_del on public.voluntarios_eventos;
create policy ve_del on public.voluntarios_eventos for delete to authenticated
  using (public.es_staff() or usuario_id = public.mi_usuario_id());
