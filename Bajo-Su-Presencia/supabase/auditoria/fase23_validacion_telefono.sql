-- ============================================================================
--  FASE 23 · VALIDACIÓN DE TELÉFONO EN LA BASE DE DATOS (10 dígitos exactos)
--
--  HALLAZGO: la regla del teléfono vivía únicamente en JavaScript, y además
--  estaba mal: el validador `tel()` aceptaba de 7 a 20 caracteres, por lo que
--  admitía números de más de 10 dígitos. Cualquier cliente que llamara la API
--  directamente (curl/PostgREST) podía guardar cualquier cadena.
--
--  DEFENSA EN PROFUNDIDAD — la regla se aplica ahora en tres capas:
--    1. HTML/JS  : maxlength=10, pattern y recorte en tiempo real (comodidad).
--    2. Backend  : App\Validation\Validator::telefono() (control real).
--    3. Base     : este CHECK (última línea de defensa, no se puede evadir).
--
--  DISEÑO: se almacena SOLO dígitos (sin +57, espacios ni guiones). Los datos
--  existentes se normalizan antes de aplicar el CHECK para que ninguna fila
--  histórica lo viole. Lo que no se pueda normalizar a 10 dígitos se deja en
--  NULL y se reporta por NOTICE (nunca se inventa un número).
--
--  Idempotente. Requiere FASE 1 (helpers aud.*).
-- ============================================================================

-- ===========================================
-- 23.1 Respaldo de los teléfonos originales (una sola vez)
-- ===========================================
create table if not exists aud.bk_telefonos (
  tabla        text not null,
  fila_id      uuid not null,
  telefono_ori text,
  guardado_en  timestamptz not null default now(),
  primary key (tabla, fila_id)
);

do $$
declare t text;
begin
  foreach t in array array['usuarios','sedes','pqr','asistencias'] loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and aud.col_exists(t, 'telefono') then
      execute format(
        'insert into aud.bk_telefonos (tabla, fila_id, telefono_ori)
           select %L, id, telefono from public.%I where telefono is not null
         on conflict (tabla, fila_id) do nothing', t, t);
    end if;
  end loop;
end $$;

-- ===========================================
-- 23.2 Normalización de los datos existentes
--      - Quita todo lo que no sea dígito.
--      - Descarta el indicativo 57 si el resultado queda en 12 dígitos.
--      - Lo que no llegue a 10 dígitos exactos se anula (dato no confiable).
-- ===========================================
do $$
declare t text; v_malos int;
begin
  foreach t in array array['usuarios','sedes','pqr','asistencias'] loop
    if to_regclass('public.' || quote_ident(t)) is null
       or not aud.col_exists(t, 'telefono') then
      continue;
    end if;

    -- Solo dígitos
    execute format(
      'update public.%I set telefono = regexp_replace(telefono, ''\D'', '''', ''g'')
        where telefono is not null and telefono <> regexp_replace(telefono, ''\D'', '''', ''g'')', t);

    -- Indicativo de país
    execute format(
      'update public.%I set telefono = substring(telefono from 3)
        where telefono is not null and length(telefono) = 12 and telefono like ''57%%''', t);

    -- Lo que sigue sin cumplir se anula (queda el original en aud.bk_telefonos)
    execute format(
      'update public.%I set telefono = null
        where telefono is not null and telefono !~ ''^\d{10}$''', t);
    get diagnostics v_malos = row_count;

    if v_malos > 0 then
      raise notice 'Tabla %: % teléfono(s) no normalizables anulados (original en aud.bk_telefonos)', t, v_malos;
    end if;
  end loop;
end $$;

-- ===========================================
-- 23.3 CHECK: exactamente 10 dígitos (o NULL si el campo es opcional)
-- ===========================================
do $$
declare t text;
begin
  foreach t in array array['usuarios','sedes','pqr','asistencias'] loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and aud.col_exists(t, 'telefono') then
      perform aud.add_check(t, 'ck_' || t || '_telefono', 'telefono is null or telefono ~ ''^\d{10}$''');
    end if;
  end loop;
end $$;

-- ===========================================
-- 23.4 Verificación final
-- ===========================================
do $$
declare t text; v_total int; v_ok int;
begin
  foreach t in array array['usuarios','sedes','pqr','asistencias'] loop
    if to_regclass('public.' || quote_ident(t)) is null
       or not aud.col_exists(t, 'telefono') then
      continue;
    end if;
    execute format('select count(*), count(*) filter (where telefono ~ ''^\d{10}$'')
                      from public.%I where telefono is not null', t)
      into v_total, v_ok;
    raise notice 'Tabla %: % teléfono(s) no nulos, % válidos', t, v_total, v_ok;
  end loop;
end $$;
