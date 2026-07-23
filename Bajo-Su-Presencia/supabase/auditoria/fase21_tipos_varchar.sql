-- ============================================================================
--  FASE 21 · FORENSIA DE TIPOS — acotar varchar sin límite (FASE 9)
--  `character varying` sin longitud equivale a texto ilimitado. Se acotan a
--  tamaños coherentes con el dominio real (verificado: longitud máx. actual
--  ≤ 11, sin riesgo de truncado). Se EXCLUYEN:
--   - asistencias.nombre/correo/telefono → ya con CHECK de longitud (fase 16)
--     y dependientes de la vista v_asistencias_detalle (evita reconstruirla).
--   - pqr.* → ya con CHECK de longitud (fase 16).
--  Idempotente: solo actúa si la columna sigue sin límite.
-- ============================================================================

do $$
declare
  esp text[];
  cols constant text[][] := array[
    ['usuarios','username','30'], ['usuarios','telefono','30'],
    ['usuarios','ubicacion','150'], ['usuarios','ocupacion','100'],
    ['eventos','categoria','50'], ['eventos','expositor','150'],
    ['sedes','ciudad','100'],
    ['recursos','unidad','30'],
    ['voluntarios_eventos','rol_en_evento','80'],
    ['notificaciones','titulo','150'],
    ['oraciones','titulo','150'], ['oraciones','referencia','100']
  ];
begin
  foreach esp slice 1 in array cols loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name=esp[1]
                 and column_name=esp[2] and data_type='character varying'
                 and character_maximum_length is null) then
      execute format('alter table public.%I alter column %I type varchar(%s)',
                     esp[1], esp[2], esp[3]);
      raise notice '21: %.% → varchar(%)', esp[1], esp[2], esp[3];
    end if;
  end loop;
end $$;

-- Verificación
select coalesce(string_agg(table_name||'.'||column_name,', '),'(ninguna) ✔') as varchar_sin_limite_restantes
from information_schema.columns
where table_schema='public' and data_type='character varying'
  and character_maximum_length is null
  and table_name not in ('asistencias')      -- protegidas por CHECK + vista
  and not (table_name='pqr');                 -- protegidas por CHECK
