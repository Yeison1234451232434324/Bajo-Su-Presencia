-- ============================================================================
--  AJUSTES para Eventos y Recursos — Bajo Su Presencia
--  Los formularios web no piden "sede", y el CHECK de categoría de recursos
--  (creado por otra herramienta) no coincide con las categorías del formulario.
--  Re-ejecutable.
-- ============================================================================

-- 1) sede_id opcional (los formularios no la capturan)
alter table public.eventos  alter column sede_id drop not null;
alter table public.recursos alter column sede_id drop not null;

-- 2) Alinear el CHECK de recursos.categoria con las categorías del formulario.
--    Se normalizan filas con categoría inválida/nula a 'Otros' y el CHECK se
--    agrega como NOT VALID: se exige a los datos NUEVOS (lo que mete el form)
--    pero NO rechaza filas viejas (evita el error 23514 al crear la restricción).
alter table public.recursos drop constraint if exists recursos_categoria_check;

update public.recursos
   set categoria = 'Otros'
 where categoria is null
    or categoria not in ('Mobiliario','Audio y Video','Iluminación','Papelería','Cocina','Otros');

alter table public.recursos add constraint recursos_categoria_check
  check (categoria in ('Mobiliario','Audio y Video','Iluminación','Papelería','Cocina','Otros')) not valid;
