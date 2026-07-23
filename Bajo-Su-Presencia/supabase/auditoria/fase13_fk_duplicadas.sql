-- ============================================================================
--  FASE 13 · FOREIGN KEYS DUPLICADAS
--  Detectado en vivo (PGRST201): evento_recursos tiene DOS FKs por columna
--  (la legada *_fkey y la fk_* agregada por la migración, cuyo guard por
--  nombre no reconoció la preexistente). Efectos: validación doble en cada
--  escritura y ambigüedad que ROMPE los embeds de PostgREST
--  (eventos→evento_recursos y evento_recursos→recursos fallaban).
--
--  Solución genérica: para cada grupo de FKs idénticas (misma tabla, misma
--  columna, misma referencia) conserva UNA — prefiere la fk_* (con ON DELETE
--  CASCADE garantizado) — y elimina el resto. Idempotente.
-- ============================================================================

do $$
declare
  g record; extra record; keep text;
begin
  for g in
    select conrelid, conkey, confrelid, count(*) as n
    from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace
    group by conrelid, conkey, confrelid
    having count(*) > 1
  loop
    -- ganadora: la fk_* de la migración (cascade conocido); si no hay, la primera
    select conname into keep
    from pg_constraint
    where contype = 'f' and conrelid = g.conrelid
      and conkey = g.conkey and confrelid = g.confrelid
    order by (conname like 'fk\_%' escape '\') desc, conname
    limit 1;

    for extra in
      select conname
      from pg_constraint
      where contype = 'f' and conrelid = g.conrelid
        and conkey = g.conkey and confrelid = g.confrelid
        and conname <> keep
    loop
      execute format('alter table %s drop constraint %I', g.conrelid::regclass, extra.conname);
      raise notice 'FK duplicada eliminada: % en % (se conserva %)',
        extra.conname, g.conrelid::regclass, keep;
    end loop;
  end loop;
end $$;

-- Verificación: debe devolver 0 filas (ninguna FK duplicada en todo public)
select conrelid::regclass as tabla, conkey, confrelid::regclass as referencia,
       array_agg(conname) as constraints
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
group by conrelid, conkey, confrelid
having count(*) > 1;
