-- ============================================================================
--  FASE 16 · HALLAZGOS DEL COMITÉ DE AUDITORÍA (tercera pasada, en vivo)
--  Auditoría independiente contra el ESTADO VIVO de la base (catálogo real vía
--  API + sondeos de datos + clave anónima), no contra los scripts.
--  Cada bloque es idempotente y corrige datos antes de restringir.
--  Requiere FASE 1 (helpers aud.*).
--
--  NOTA sobre el hallazgo CRÍTICO (usuarios.nombre → nombre_completo):
--  la corrección fue en el CÓDIGO (7 lectores + backend), no en la BD. El
--  nombre nombre_completo es semánticamente correcto y se conserva. Este
--  script solo GARANTIZA que siga siendo una columna generada (16.1).
-- ============================================================================

-- ===========================================
-- 16.1 [CRÍTICO-VERIFICACIÓN] Garantizar que usuarios.nombre_completo sea
-- una columna GENERADA (no un valor estático que quedó tras el rename manual).
-- Si fuera estática, editar nombres/apellidos NO actualizaría el nombre
-- mostrado en toda la app → datos incoherentes silenciosos.
-- Repara solo si hace falta (drop view dependiente → recrea col → recrea view).
-- ===========================================
do $$
declare v_gen text;
begin
  select is_generated into v_gen
  from information_schema.columns
  where table_schema='public' and table_name='usuarios' and column_name='nombre_completo';

  if v_gen is null then
    raise notice '16.1: usuarios.nombre_completo no existe (¿renombrada a otro nombre?) — revisar manualmente';
  elsif v_gen = 'ALWAYS' then
    raise notice '16.1: OK — nombre_completo es GENERATED ALWAYS';
  else
    raise notice '16.1: nombre_completo es ESTÁTICA — reconstruyendo como generada';
    drop view if exists public.usuarios_directorio;
    alter table public.usuarios drop column nombre_completo;
    alter table public.usuarios add column nombre_completo varchar(210)
      generated always as (
        case when apellidos is null then nombres
             else nombres || ' ' || apellidos end) stored;
    create view public.usuarios_directorio as
      select u.id, u.nombre_completo as nombre, u.foto_url,
             coalesce(array_agg(e.nombre) filter (where e.nombre is not null),
                      '{}'::text[]) as especialidades
      from public.usuarios u
      left join public.usuario_especialidades ue on ue.usuario_id = u.id
      left join public.especialidades e on e.id = ue.especialidad_id
      where u.activo
      group by u.id, u.nombre_completo, u.foto_url;
    revoke all    on public.usuarios_directorio from anon;
    grant  select on public.usuarios_directorio to authenticated;
  end if;
end $$;

-- ===========================================
-- 16.2 [MEDIA] eventos: el CHECK ck_eventos_horario (hora_fin > hora) RECHAZA
-- vigilias que cruzan medianoche (p.ej. 22:00 → 02:00), habituales en una
-- iglesia ("Noche de Adoración"). El modelo fecha+hora no puede expresar el
-- cruce de día. Se RELAJA a hora_fin <> hora (impide solo el rango nulo);
-- la validación real de duración corresponde a la app.
-- (El diseño ideal sería timestamptz inicio/fin; se documenta como deuda.)
-- ===========================================
do $$ begin
  alter table public.eventos drop constraint if exists ck_eventos_horario;
  alter table public.eventos add constraint ck_eventos_horario
    check (hora is null or hora_fin is null or hora_fin <> hora);
exception when others then raise notice '16.2 ck_eventos_horario: %', sqlerrm;
end $$;
comment on constraint ck_eventos_horario on public.eventos is
  'Permite eventos que cruzan medianoche (vigilias). La duración real la valida la app. Deuda técnica: migrar a timestamptz inicio/fin.';

-- ===========================================
-- 16.3 [MEDIA] Campos de texto escritos por rol ANON (formulario público PQR)
-- y por la app móvil (asistencias, invitados) son varchar SIN límite: un
-- cliente hostil puede enviar megabytes en un solo campo (abuso/DoS de
-- almacenamiento). Se acotan con CHECK (no reescribe la columna; NOT VALID si
-- hubiera históricos largos, exigiendo solo a lo nuevo).
-- ===========================================
select aud.add_check('pqr', 'ck_pqr_longitudes',
  $$length(nombre)  <= 120 and length(correo) <= 150
    and (telefono is null or length(telefono) <= 30)
    and length(asunto) <= 150 and length(descripcion) <= 4000$$);

select aud.add_check('asistencias', 'ck_asistencias_longitudes',
  $$(nombre   is null or length(nombre)   <= 150)
    and (correo   is null or length(correo)   <= 150)
    and (telefono is null or length(telefono) <= 30)$$);

-- ===========================================
-- 16.4 [BAJA] informes.creado_en quedó nullable y sin DEFAULT tras el rename
-- created_at→creado_en (fase 11), rompiendo la convención del resto del
-- esquema (creado_en NOT NULL DEFAULT now()).
-- ===========================================
do $$ begin
  update public.informes set creado_en = coalesce(creado_en, actualizado_en, now())
   where creado_en is null;
  alter table public.informes alter column creado_en set default now();
  alter table public.informes alter column creado_en set not null;
exception when others then raise notice '16.4 informes.creado_en: %', sqlerrm;
end $$;

-- ===========================================
-- 16.5 [BAJA] usuarios.username: la UNIQUE heredada es SENSIBLE a mayúsculas
-- (usuarios_username_key), pero el login compara en minúsculas. Un INSERT
-- directo (service_role) podría crear 'Camilo' y 'camilo' → login ambiguo.
-- Se alinea con el patrón de correo: UNIQUE sobre lower(username).
-- Además username es la credencial de acceso → NOT NULL.
-- ===========================================
do $$ begin
  -- exigir username presente (los 8 usuarios vivos ya lo tienen)
  if not exists (select 1 from public.usuarios where username is null or trim(username)='') then
    alter table public.usuarios alter column username set not null;
  else
    raise notice '16.5: hay usuarios sin username — no se aplica NOT NULL';
  end if;

  create unique index if not exists ux_usuarios_username on public.usuarios (lower(username));
  -- retirar la UNIQUE case-sensitive redundante
  alter table public.usuarios drop constraint if exists usuarios_username_key;
exception when others then raise notice '16.5 username: %', sqlerrm;
end $$;

-- ===========================================
-- Verificación final
-- ===========================================
select '16.1 nombre_completo generada' as item,
       coalesce((select is_generated from information_schema.columns
        where table_schema='public' and table_name='usuarios' and column_name='nombre_completo'),'(no existe)') as valor
union all
select '16.4 informes.creado_en not null',
       (select case when is_nullable='NO' then 'OK NOT NULL' else 'AÚN NULLABLE' end
        from information_schema.columns
        where table_schema='public' and table_name='informes' and column_name='creado_en')
union all
select '16.5 username NOT NULL',
       (select case when is_nullable='NO' then 'OK' else 'nullable' end
        from information_schema.columns
        where table_schema='public' and table_name='usuarios' and column_name='username')
union all
select 'checks_nuevos',
       coalesce(string_agg(conname,', '),'(ninguno)')
from pg_constraint
where connamespace='public'::regnamespace and contype='c'
  and conname in ('ck_pqr_longitudes','ck_asistencias_longitudes');
