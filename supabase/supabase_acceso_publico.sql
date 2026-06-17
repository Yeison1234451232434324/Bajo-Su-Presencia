-- ============================================================================
--  ACCESO PÚBLICO (anónimo) — Bajo Su Presencia
--  Las páginas públicas (home/inicio y formulario PQR) NO tienen login, así que
--  el rol "anon" necesita poder LEER el contenido público y ENVIAR PQR.
--  Re-ejecutable.
-- ============================================================================

-- Lectura anónima del contenido que se muestra en el home público
drop policy if exists noticias_sel_anon  on public.noticias;
create policy noticias_sel_anon  on public.noticias  for select to anon using (true);

drop policy if exists oraciones_sel_anon on public.oraciones;
create policy oraciones_sel_anon on public.oraciones for select to anon using (true);

drop policy if exists eventos_sel_anon   on public.eventos;
create policy eventos_sel_anon   on public.eventos   for select to anon using (true);

drop policy if exists sedes_sel_anon     on public.sedes;
create policy sedes_sel_anon     on public.sedes     for select to anon using (true);

-- Envío anónimo de PQR desde el formulario público
drop policy if exists pqr_ins_anon on public.pqr;
create policy pqr_ins_anon on public.pqr for insert to anon with check (true);
