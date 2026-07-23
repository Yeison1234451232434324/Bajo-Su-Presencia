# Migración de auditoría — orden de ejecución

Ejecutar en el **SQL Editor de Supabase**, un archivo por vez, en este orden:

| # | Archivo | Qué hace | ¿Rompe las apps? |
|---|---|---|---|
| 1 | `fase01_preparacion.sql` | Esquema `aud`, helpers, respaldo de todas las tablas | No |
| 2 | `fase02_correccion_datos.sql` | Dedup (roles, usuarios, puentes, informes) y datos inválidos | No |
| 3 | `fase03_convenciones_nombres.sql` | Renombra columnas (sin tildes, `evento_id` unificado) | **Sí** |
| 4 | `fase04_normalizacion.sql` | Especialidades N:M, `eventos_qr`, FKs en vez de nombres, colapso de redundancias, tipos | **Sí** |
| 5 | `fase05_llaves.sql` | UNIQUE y FOREIGN KEYS faltantes | No |
| 6 | `fase06_restricciones.sql` | CHECK / NOT NULL / DEFAULT | No |
| 7 | `fase07_indices.sql` | Quita 3 índices redundantes, crea ~13 faltantes | No |
| 8 | `fase08_seguridad_rls.sql` | Cierra fugas RLS (usuarios, `with check(true)`, QR) | Parcial* |
| 9 | `fase09_optimizacion.sql` | `actualizado_en` + trigger, vistas agregadas, ANALYZE | No |
| 10 | `fase10_limpieza.sql` | Nuevo `handle_new_user()`, drop `contrasena_hash`, validación y verificación final | **Sí** (backend) |
| 11 | `fase11_ajustes_certificacion.sql` | Columnas legadas, default de `prioridad`, correos normalizados, timestamptz | Parcial (`reportes.model.js`) |
| 12 | `fase12_indices_finales.sql` | Depura índices duplicados/cubiertos, renombra los de columnas viejas | No |
| 13 | `fase13_fk_duplicadas.sql` | Elimina FKs duplicadas que rompían los embeds de PostgREST | No |
| 14 | `fase14_refinamientos.sql` | Dominios faltantes (calificaciones 1-5, pqr, asistencias.estado), coherencia de respuesta PQR, drop `asignaciones` (vacía y duplicada), índices FK faltantes, comentarios de diseño | No |
| 15 | `fase15_nombres_apellidos.sql` | 1FN: `usuarios.nombre` → `nombres` + `apellidos` atómicos; `nombre` queda como columna GENERADA (nombre completo, solo lectura); divide los datos existentes (original en `aud.bk_usuarios_nombres`); nuevo `handle_new_user()` | **Sí** (escritores) |
| 16 | `fase16_auditoria_comite.sql` | Garantiza `nombre_completo` GENERADA; relaja CHECK de horario (vigilias); acota longitudes de campos anón (PQR/asistencias); `informes.creado_en` NOT NULL; `username` UNIQUE case-insensitive + NOT NULL | No |
| 17 | `fase17_hallazgos_catalogo.sql` | `actividades.evento_id` → ON DELETE CASCADE; renombra 4 FK `id_de_evento`→`evento_id`; `search_path` en `tg_set_actualizado_en` | No |
| 18 | `fase18_rls_saneamiento.sql` | **CRÍTICO**: elimina plantillas `acceso_autenticado` (escritura abierta a cualquier logueado sobre informes/evaluaciones/recursos/sedes) y la generación rota `get_rol_usuario()`; política de propiedad correcta en actividades; roles no legible por anon | No* |
| 19 | `fase19_rls_consolidacion.sql` | Elimina políticas SELECT PUBLIC duplicadas; deja una sola generación coherente (`_sel` + `_sel_anon`) | No |

| 20 | `fase20_escalada_privilegios.sql` | **CRÍTICO**: trigger que impide a un no-admin cambiar su propio `rol_id`/`activo`/`auth_id` vía API (escalada demostrada en vivo) | No* |
| 21 | `fase21_tipos_varchar.sql` | Acota 12 columnas `varchar` sin límite a tamaños de dominio | No |
| 22 | `fase22_storage_seguridad.sql` | **CRÍTICO**: cierra subida/borrado ANÓNIMO en el bucket `noticias` (storage.objects) → solo staff; lectura sigue pública | No* |

\* Aplicadas en vivo vía conexión directa (Node `pg`). El backend usa `service_role` (ignora RLS); el frontend autenticado usa las políticas `es_staff`/`es_admin`/`mi_usuario_id`, verificadas correctas por comportamiento (SET ROLE + claims JWT reales).

Todos los scripts son **idempotentes** (re-ejecutables) y corrigen los datos antes de aplicar cada restricción; los conflictos residuales se reportan con `NOTICE`, nunca abortan.

\* La fase 8 restringe `select` sobre `usuarios` a staff/fila propia: las pantallas que listan nombres de otros usuarios con la clave `authenticated` deben migrar a la vista `usuarios_directorio`. El backend PHP (service_role) no se ve afectado.

## Respaldo

La fase 1 copia todas las tablas a `aud.bk_<tabla>` (inaccesible vía API). Los hashes de contraseña reales (si existieran) quedan en `aud.contrasenas_legado`.

## Código de aplicación que hay que actualizar tras las fases 3, 4, 8 y 10

- `models/asistencias.model.js` — `evento_id`, `telefono`, `fecha_inscripcion`, `metodo`; usar `estado` (ya no existen `inscrito`/`asistió`); idealmente migrar a las vistas `v_asistencias_detalle` y `v_resumen_asistencias`.
- `models/eventos.model.js` — `_syncEspecialistas` usa `evento_id`; ya no existe `código_qr` en `eventos` (tabla `eventos_qr`).
- `models/voluntarios.model.js` — `evento_id`; `evaluaciones` ahora tiene `estrellas` + `evaluador_id` + `evaluado_en` (ya no `puntualidad/actitud/desempeno/compromiso`, `evaluador_nombre`, `fecha`).
- `models/pqr.model.js` — `telefono`, `descripcion`; `respondido_por_id` (uuid) en vez de `respondido_por` (texto).
- `models/recursos.model.js` — `descripcion`.
- `models/usuarios.model.js` — `telefono`, `ubicacion`, `ocupacion`; especialidades ahora vía `usuario_especialidades`/`especialidades`.
- `models/noticias.model.js` — `descripcion` (antes `"Descripcion"`).
- `models/sedes.model.js` — ya no existe `miembros`.
- `backend/src/Services/UsuariosService.php` — no insertar/leer `contrasena_hash` ni `especialidad`.
- Vistas/pantallas móviles que lean el QR — validar contra `eventos_qr` vía backend (service_role).

## Tras la fase 15/16 (nombres/apellidos)

⚠️ **La columna generada se llama `nombre_completo`** (fue renombrada desde
`nombre` en el editor de Supabase después de la fase 15). Como el código de las
apps leía `usuarios(nombre)`, esto rompió TODAS las lecturas (error 42703) hasta
la corrección de la fase 16: los 7 lectores ahora usan el alias
`nombre:nombre_completo` (PostgREST) y el backend ordena por `nombre_completo`.
Escribir en `nombre_completo` devuelve error 428C9 (es generada).

Lectores corregidos: `noticias/eventos/voluntarios/pqr/actividades/reportes.model.js`,
`usuarios.model.js` (`_fromRow`), `UserRepository.php` (order), `AuthService.php`
(sesión + email OTP).

Ya actualizado en este repo:
- `backend/src/Services/UsuariosService.php` — `mapFields` escribe `nombres`/`apellidos`; si el payload solo trae el legado `nombre`, lo divide (misma heurística de la migración).
- `views/dashboard/admin/usuarios.html` + `controllers/usuarios.controller.js` — formulario con campos separados Nombres/Apellidos.
- `models/usuarios.model.js` — expone `nombres`/`apellidos` además de `nombre` (completo).

Pendiente fuera de este repo:
- **App móvil**: cualquier INSERT/UPDATE directo de `usuarios.nombre` debe migrar a `nombres`/`apellidos` (las lecturas no cambian). El signup vía Auth sigue funcionando: el trigger acepta el metadato legado `nombre`.
- Revisar la división heurística de los 8 usuarios existentes en `aud.bk_usuarios_nombres` (p. ej. «Pastor Andres» quedó como nombres=Pastor / apellidos=Andres) y corregir desde la pantalla de usuarios.
