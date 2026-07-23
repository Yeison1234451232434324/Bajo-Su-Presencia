-- ============================================================================
--  FASE 22 · SEGURIDAD DE STORAGE  (vulnerabilidad demostrada en vivo)
--
--  HALLAZGO CRÍTICO: las políticas del bucket 'noticias' en storage.objects
--  otorgaban INSERT y DELETE a PUBLIC (incluye anon) sin verificación:
--    subir_noticias    INSERT PUBLIC  with check (bucket_id='noticias')
--    eliminar_noticias DELETE PUBLIC  using      (bucket_id='noticias')
--  Prueba: como rol `anon` un INSERT en storage.objects fue ACEPTADO (1 fila).
--  Riesgo: subida anónima de archivos arbitrarios (hosting de malware, abuso de
--  almacenamiento/costo) y borrado no autenticado de imágenes vía Storage API.
--
--  Corrección: escritura/borrado solo para staff (es_staff); lectura sigue
--  pública porque las imágenes de noticias son de visualización pública.
--  La creación de noticias ya es staff-only (noticias_mod), así que la subida
--  de imágenes debe coincidir. Idempotente.
-- ============================================================================

drop policy if exists subir_noticias on storage.objects;
create policy subir_noticias on storage.objects
  for insert to authenticated
  with check (bucket_id = 'noticias' and public.es_staff());

drop policy if exists eliminar_noticias on storage.objects;
create policy eliminar_noticias on storage.objects
  for delete to authenticated
  using (bucket_id = 'noticias' and public.es_staff());

-- Actualizar objetos existentes (renombrar/mover) también solo staff:
drop policy if exists actualizar_noticias on storage.objects;
create policy actualizar_noticias on storage.objects
  for update to authenticated
  using (bucket_id = 'noticias' and public.es_staff())
  with check (bucket_id = 'noticias' and public.es_staff());

-- leer_noticias (SELECT PUBLIC) se conserva: imágenes de noticias públicas.
