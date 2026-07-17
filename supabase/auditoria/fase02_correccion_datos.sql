-- ============================================================================
--  FASE 2 · CORRECCIÓN DE DATOS — depura duplicados y valores inválidos
--  ANTES de aplicar llaves y restricciones (así ninguna fase posterior falla).
--  Requiere: FASE 1. Re-ejecutable.
--  Nota: en esta fase las columnas aún tienen sus nombres ORIGINALES
--  (con tildes / id_de_evento); se renombran en la FASE 3.
-- ============================================================================

-- ===========================================
-- 2.1 roles: fusionar duplicados por nombre (case/espacios) y dejar
--     solo los 4 canónicos + los extra que existan sin duplicar
-- ===========================================
do $$
declare canon text; v_keep uuid;
begin
  for canon in
    select min(nombre) from public.roles group by lower(trim(nombre)) having count(*) > 1
  loop
    select id into v_keep from public.roles
    where lower(trim(nombre)) = lower(trim(canon))
    order by (nombre = trim(canon)) desc, id limit 1;

    update public.usuarios set rol_id = v_keep
    where rol_id in (select id from public.roles
                     where lower(trim(nombre)) = lower(trim(canon)) and id <> v_keep);

    delete from public.roles
    where lower(trim(nombre)) = lower(trim(canon)) and id <> v_keep;
  end loop;
  update public.roles set nombre = trim(nombre) where nombre <> trim(nombre);
end $$;

-- Garantizar que existan los 4 roles canónicos
insert into public.roles (nombre)
select r from (values ('Administrador'),('Colaborador'),('Voluntario'),('Usuario')) v(r)
where not exists (select 1 from public.roles where lower(trim(nombre)) = lower(v.r));

-- ===========================================
-- 2.2 usuarios: normalizar correos y fusionar cuentas duplicadas por correo.
--     Ganador: la fila enlazada a Auth (auth_id) o la más antigua.
--     Se repuntan TODAS las FKs que referencian usuarios (dinámico); si una
--     fila del duplicado colisiona con una unique del ganador, se elimina
--     (es el registro redundante del duplicado).
-- ===========================================
update public.usuarios
   set correo_electronico = lower(trim(correo_electronico))
 where correo_electronico <> lower(trim(correo_electronico));

do $$
declare fkrec record; dup record;
begin
  create temp table _dup_usuarios as
  select u.id as old_id, k.keep_id
  from public.usuarios u
  join (
    select lower(correo_electronico) c,
           (array_agg(id order by (auth_id is not null) desc, id))[1] as keep_id
    from public.usuarios
    group by 1 having count(*) > 1
  ) k on lower(u.correo_electronico) = k.c and u.id <> k.keep_id;

  for fkrec in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.usuarios'::regclass
  loop
    for dup in select * from _dup_usuarios loop
      begin
        execute format('update %s set %I = $1 where %I = $2', fkrec.tbl, fkrec.col, fkrec.col)
          using dup.keep_id, dup.old_id;
      exception when unique_violation then
        -- la cuenta ganadora ya tiene esa fila (p. ej. misma asistencia): se
        -- descarta la del duplicado (está respaldada en aud.bk_*)
        execute format('delete from %s where %I = $1', fkrec.tbl, fkrec.col) using dup.old_id;
        raise notice 'Filas duplicadas de usuario % eliminadas en %', dup.old_id, fkrec.tbl;
      end;
    end loop;
  end loop;

  delete from public.usuarios u using _dup_usuarios d where u.id = d.old_id;
  drop table _dup_usuarios;
end $$;

-- ===========================================
-- 2.3 evento_recursos: consolidar pares (evento, recurso) duplicados
--     (quedarse con la fila de mayor cantidad)
-- ===========================================
do $$ begin
  if to_regclass('public.evento_recursos') is null then return; end if;
  delete from public.evento_recursos er
   using public.evento_recursos dup
   where er.evento_id  = dup.evento_id
     and er.recurso_id = dup.recurso_id
     and er.id <> dup.id
     and (er.cantidad, er.id::text) < (dup.cantidad, dup.id::text);
end $$;

-- ===========================================
-- 2.4 informes: un informe por evento — conservar el más reciente
-- ===========================================
do $$ begin
  delete from public.informes i
   using public.informes j
   where i.evento_id = j.evento_id and i.id <> j.id
     and (coalesce(i.created_at, 'epoch'::timestamptz), i.id::text)
       < (coalesce(j.created_at, 'epoch'::timestamptz), j.id::text);
exception when undefined_column then
  delete from public.informes i
   using public.informes j
   where i.evento_id = j.evento_id and i.id <> j.id and i.id::text < j.id::text;
end $$;

-- ===========================================
-- 2.5 evaluaciones: una por (evento, voluntario) — conservar la más reciente
-- ===========================================
do $$ begin
  delete from public.evaluaciones e
   using public.evaluaciones f
   where e.id_de_evento = f.id_de_evento and e.usuario_id = f.usuario_id
     and e.id <> f.id
     and (coalesce(e.fecha, 'epoch'::timestamptz), e.id::text)
       < (coalesce(f.fecha, 'epoch'::timestamptz), f.id::text);
exception when undefined_column then
  raise notice 'evaluaciones: columnas distintas a lo esperado, dedup omitido';
end $$;

-- ===========================================
-- 2.6 asistencias de invitados (usuario_id NULL): un registro por
--     (evento, correo) — conservar la inscripción más antigua
-- ===========================================
delete from public.asistencias a
 using public.asistencias b
 where a.usuario_id is null and b.usuario_id is null
   and a.id_de_evento = b.id_de_evento
   and lower(a.correo) = lower(b.correo)
   and a.id <> b.id
   and (coalesce(a.creado_en, now()), a.id::text)
     > (coalesce(b.creado_en, now()), b.id::text);

-- ===========================================
-- 2.7 asistencias: filas fantasma (sin usuario, sin nombre y sin correo)
--     no identifican a nadie → fuera (están en aud.bk_asistencias)
-- ===========================================
delete from public.asistencias
 where usuario_id is null and nombre is null and correo is null;

-- ===========================================
-- 2.8 asistencias: coherencia estado ↔ banderas
--     - asistió=true con estado 'confirmada'  → estado 'asistida'
--     - inscrito=false                        → estado 'cancelada'
--     - asistió=true sin fecha_asistencia     → usar creado_en como respaldo
-- ===========================================
update public.asistencias set estado = 'asistida'
 where "asistió" = true and estado = 'confirmada';
update public.asistencias set estado = 'cancelada'
 where inscrito = false and estado <> 'cancelada';
update public.asistencias set fecha_asistencia = coalesce(fecha_asistencia, creado_en, now())
 where "asistió" = true and fecha_asistencia is null;

-- ===========================================
-- 2.9 calificaciones_eventos: filas sin ningún criterio calificado → fuera
-- ===========================================
delete from public.calificaciones_eventos
 where ujieres is null and sonido is null and mensaje is null;

-- ===========================================
-- 2.10 evaluaciones: llevar criterios fuera de rango a [1,5]
-- ===========================================
do $$ begin
  update public.evaluaciones set
    puntualidad = least(greatest(puntualidad, 1), 5),
    actitud     = least(greatest(actitud,     1), 5),
    desempeno   = least(greatest(desempeno,   1), 5),
    compromiso  = least(greatest(compromiso,  1), 5)
  where puntualidad not between 1 and 5
     or actitud     not between 1 and 5
     or desempeno   not between 1 and 5
     or compromiso  not between 1 and 5;
exception when undefined_column then
  raise notice 'evaluaciones: criterios con otros nombres, clamp omitido';
end $$;

-- ===========================================
-- 2.11 Cantidades y contadores negativos → 0 / NULL
-- ===========================================
update public.recursos set cantidad = 0 where cantidad < 0;
update public.eventos  set cupos_disponibles = null where cupos_disponibles < 0;
update public.sedes    set miembros = 0 where miembros < 0;
do $$ begin
  update public.informes set ofrenda_recaudada = 0 where ofrenda_recaudada < 0;
exception when undefined_column then null;
end $$;
do $$ begin
  if to_regclass('public.evento_recursos') is not null then
    update public.evento_recursos set cantidad = 1 where cantidad < 1;
  end if;
end $$;

-- ===========================================
-- 2.12 eventos: categoría fuera de catálogo → NULL; horario incoherente
--      (fin <= inicio en el mismo día) → hora_fin NULL (no se puede adivinar)
-- ===========================================
update public.eventos set "categoría" = null
 where "categoría" is not null
   and "categoría" not in ('Servicio Principal','Jóvenes','Cursos','Célula','Evento Especial');
update public.eventos set hora_fin = null
 where hora is not null and hora_fin is not null and hora_fin <= hora;

-- ===========================================
-- 2.13 notificaciones sin destinatario → fuera (respaldadas)
-- ===========================================
delete from public.notificaciones where usuario_id is null;

-- ===========================================
-- 2.14 pqr: normalizar correos (los inválidos no se pueden inventar;
--      el CHECK de la FASE 6 quedará NOT VALID para no rechazarlos)
-- ===========================================
update public.pqr set correo = lower(trim(correo)) where correo <> lower(trim(correo));

-- ===========================================
-- 2.15 evento_recursos / actividades: registros huérfanos (referencias rotas)
--      → fuera, antes de declarar las FKs en la FASE 5
-- ===========================================
do $$ begin
  if to_regclass('public.evento_recursos') is null then return; end if;
  delete from public.evento_recursos er
   where not exists (select 1 from public.eventos  e where e.id = er.evento_id)
      or not exists (select 1 from public.recursos r where r.id = er.recurso_id);
end $$;

do $$ begin
  if to_regclass('public.actividades') is null then return; end if;
  delete from public.actividades a
   where not exists (select 1 from public.eventos e where e.id = a.evento_id);
  update public.actividades a set voluntario_id = null
   where voluntario_id is not null
     and not exists (select 1 from public.usuarios u where u.id = a.voluntario_id);
end $$;
