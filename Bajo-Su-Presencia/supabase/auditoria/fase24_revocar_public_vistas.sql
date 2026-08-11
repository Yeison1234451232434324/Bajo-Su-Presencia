-- ============================================================================
--  FASE 24 · REVOCAR ACCESO ANÓNIMO RESIDUAL EN VISTAS DE REPORTES
--
--  HALLAZGO (demostrado en vivo, sesión de auditoría, sin autenticación):
--    GET /rest/v1/v_resumen_asistencias  con SOLO la anon key (sin login)
--    devolvió filas reales: título y fecha de eventos + conteos de
--    inscritos/asistieron/calificaciones (en 0, porque el LEFT JOIN con
--    "asistencias"/"calificaciones_eventos" sí es bloqueado por RLS para
--    anon — pero el JOIN con "eventos", que SÍ tiene lectura anónima
--    (eventos_sel_anon), deja pasar la fila).
--
--  La fase 9 (`fase09_optimizacion.sql`) ya declara:
--      grant select on public.v_resumen_asistencias to authenticated;
--  y NUNCA otorga nada a `anon` ni a `PUBLIC`. Que anon pueda leerla de
--  todos modos indica un GRANT residual a PUBLIC que sobrevivió a un
--  `CREATE OR REPLACE VIEW` anterior (reemplazar una vista NO resetea los
--  privilegios ya otorgados en Postgres).
--
--  Corrección: revocar explícitamente de `public`/`anon` y reafirmar el
--  grant a `authenticated` en ambas vistas de este módulo (se incluye
--  `v_asistencias_detalle` de forma preventiva: su prueba en vivo no mostró
--  fuga, pero eso se debe a que su JOIN es INNER contra "asistencias"
--  —bloqueada para anon—, no a que carezca del mismo grant residual; sin
--  revocar aquí, un cambio futuro del JOIN podría reabrir la misma fuga).
--  Idempotente, no destructivo: no borra la vista, no toca sus datos.
-- ============================================================================

revoke all on public.v_resumen_asistencias from public;
revoke all on public.v_resumen_asistencias from anon;
grant select on public.v_resumen_asistencias to authenticated;

revoke all on public.v_asistencias_detalle from public;
revoke all on public.v_asistencias_detalle from anon;
grant select on public.v_asistencias_detalle to authenticated;

-- Verificación: no debe quedar ninguna fila con grantee = 'anon' o 'PUBLIC'
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('v_resumen_asistencias','v_asistencias_detalle')
order by table_name, grantee;
