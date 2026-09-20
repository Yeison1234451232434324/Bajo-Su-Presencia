# Revisión del escaneo y Spider de OWASP ZAP — Bajo Su Presencia

**Objetivo:** `https://bajo-su-presencia.onrender.com`
**Insumos revisados:** `Untitled1.csv` y `Untitled9.csv` (Spider) y `Untitled.csv` (historial del escaneo activo).
**Nota:** no se adjuntó el export de **Alertas** de ZAP, así que esta revisión se basa en la evidencia cruda de las dos tablas y en el código del backend.

---

## 1. Qué cubrió realmente el escaneo

### Spider (`Untitled1.csv`)
- 110 URLs descubiertas; el árbol del sitio se mapeó bien: `views/public/{inicio,login,pqr,recuperar}`, `controllers/`, `models/`, `services/`, `config/`, `helpers/` y los 3 endpoints de datos `/api/db/{eventos,noticias,oraciones}`.
- Recursos externos (Facebook, Google Fonts, jsDelivr, unsplash, `supabase.co`) quedaron correctamente **"Fuera del Ámbito"**.
- El Spider envió el formulario de login como **GET** con valores de prueba:
  `/views/public/login/?email=zaproxy%40example.com&password=ZAP&recordar=on&username=ZAP`
  Es un falso positivo del Spider: el login real es JavaScript y hace **POST** a `/api/auth`. ZAP no ejerció el flujo real.
- **Exposición de código fuente confirmada:** todo el frontend (`services/supabase.client.js`, `config/api.config.js`, modelos, controladores) se sirve como estático y es legible. Es inherente a una SPA — pero implica que `SUPABASE_URL` y la **anon key** son públicas (ver §4).

### Spider — 2ª pasada (`Untitled9.csv`)
Más completa: descubrió toda el **área de administración** que la 1ª no vio, porque esta vez el crawler llegó a los HTML del dashboard:
- Vistas admin estáticas: `/views/dashboard/admin/{eventos,noticias,oracion,voluntarios,pqr,auditoria,recursos,usuarios}.html` + sus `.css` y controladores.
- Endpoints de API nuevos en alcance: `/api/auditoria?limite=100`, `/api/auth/{login,me}`, `/api/db/actividades?select=...`, `/api/db/pqr?select=*,...` (¡la tabla PQR con datos personales!).
- `core/session.manager.js`, rutas SPA `/dashboard`, `/auditoria`, `/usuarios`, `/recursos`, `/voluntarios`, `/pqr-admin`, etc.

**Importante:** los HTML del panel admin se **sirven sin autenticación** (son cascarones; el guard real es `dashboard-admin-guard.controller.js` en cliente + control por rol en el backend). Hay que confirmar que:
1. Esos HTML no filtran datos ni lógica sensible por sí solos (solo maquetado).
2. `/api/auditoria`, `/api/db/pqr`, `/api/db/actividades`, `/api/auth/me` **exigen rol** y no responden a un GET anónimo o de un `Voluntario`.

El escaneo activo (`Untitled.csv`) es anterior a esta pasada, así que **ninguno de estos endpoints de admin llegó a atacarse**.

### Escaneo activo (`Untitled.csv`)
1.000 peticiones, **todas GET**. Distribución de códigos:

| Código | Nº | Lectura |
|---|---|---|
| 429 | 513 | **Rate limiting** — más de la mitad del escaneo fue estrangulado |
| 200 | 211 | Mayoría = el archivo `.js` estático servido igual, ignorando el query string |
| 301 | 186 | Redirecciones de normalización de ruta (trailing slash) |
| 403 | 64 | Gateway / control de acceso rechazando |
| 421 | 13 | Render rechazando `Host` mal formado (pruebas SSRF de metadata cloud) |
| 404 | 13 | `/actuator/health`, rutas inexistentes |

**Consecuencia importante:** con **513/1000 respuestas en 429**, el escaneo activo está **incompleto y poco fiable**. ZAP no pudo mantener el ritmo de pruebas; muchos payloads nunca llegaron a evaluarse.

---

## 2. Hallazgos de seguridad reales

**Ninguno explotable en la evidencia.** Detalle:

- **Inyección SQL / de comandos / SSTI / XSLT / path traversal / CRLF / format string:** ZAP lanzó todos estos payloads, casi siempre contra el parámetro `?v=` (cache-buster) de `inicio.controller.js` y `menu-movil-inicio.controller.js`. Son **archivos estáticos**: el servidor ignora el query string y devuelve el mismo `.js`. Los 76 "200" con payload son ese archivo intacto, no ejecución.
- **Inyección basada en tiempo (`sleep 15`):** **0 peticiones** con RTT > 8 s. Sin evidencia de ejecución de comandos.
- **SSRF a metadata de nube** (`/latest/meta-data/`, `/computeMetadata/v1/`, `/opc/v1/instance/`): respondidas con **421** por el router de Render. Sin acceso.
- **`/api/db/{eventos,noticias,oraciones}`:** durante el escaneo devolvieron **429** (rate limit) y **403** (16 c/u). No hubo fuga de datos vía manipulación de `select`/filtros en la evidencia.
- **CAPTCHA / bypass de autenticación:** no probado (escaneo solo-GET, sin sesión autenticada).

---

## 3. Limitaciones del escaneo (qué NO se probó)

Esto es lo más relevante para un informe de auditoría — el escaneo **no tocó la superficie de riesgo principal**:

1. **Sin peticiones POST/PATCH/DELETE.** El `DataGatewayController` (`/api/db/{tabla}`) reenvía query strings PostgREST a Supabase con la **`service_role key` (salta RLS)**; toda la autorización vive en PHP (`TableAccessPolicy`, guards de ownership, `EmbedAccessValidator`). Nada de esto se ejerció.
2. **Sin autenticación.** No se configuró un usuario en ZAP, así que no se probó:
   - Escalada horizontal/vertical entre roles (Administrador / Colaborador / Voluntario).
   - Manipulación del `select` PostgREST para pedir columnas sensibles (`usuarios.correo`, `informes` financieros) o embeds no previstos — exactamente las 2 vulnerabilidades que la Fase 5 dice haber corregido en `TableAccessPolicy`.
   - IDOR en `voluntarios_eventos`, `actividades`, `pqr`.
3. **Sin prueba real del login, OTP, recuperación de contraseña ni radicación de PQR** (todos POST vía JS).
4. **Escaneo estrangulado** por el rate limiter (429 masivo) → cobertura parcial.
5. **Plan free de Render:** la instancia hiberna; algunos 200/timeout pueden ser arranques en frío, no comportamiento real.

---

## 4. Recomendaciones

**Sobre la configuración del escaneo (para repetirlo con valor):**
1. Definir un **usuario y contexto autenticado** en ZAP (uno por rol) y relanzar el Active Scan con **política que incluya POST/PATCH/DELETE** sobre `/api/db/*` y `/api/*`.
2. Subir el umbral del rate limiter o meterlo en allowlist para la IP del escáner durante la prueba, para que el escaneo sea completo.
3. Semillas manuales para lo que el Spider no ve (son JS/POST): `/api/auth/recuperar`, `/api/pqr` (POST), `/api/usuarios`, `/api/db/{informes,usuarios,voluntarios_eventos,sedes,recursos,evaluaciones,calificaciones_eventos}`. La 2ª pasada del Spider ya añadió `/api/auditoria`, `/api/auth/{login,me}`, `/api/db/{actividades,pqr}` — inclúyelos en la política de ataque.
   - Probar explícitamente **acceso anónimo y con rol `Voluntario`** a `/api/auditoria?limite=100` y `/api/db/pqr` (datos personales de PQR) — deben devolver 401/403.
4. Ejecutar el **Passive Scan** y exportar el informe de **Alertas** (falta en esta entrega) — dará cabeceras de seguridad, cookies, fugas de info, etc.

**Sobre la app (de la evidencia + código):**
5. Confirmar que la **anon key** de Supabase expuesta en `supabase.client.js` tiene **RLS estricta** en todas las tablas (el gateway usa `service_role`, pero el cliente JS también habla directo con `supabase.co`).
6. El rate limiting (429) funciona y es una buena señal — verificar que aplica también a `/api/auth` (fuerza bruta de login), no solo a `/api/db`.
7. Servir los `.js` con `Cache-Control` adecuado y considerar que `?v=` no aporta seguridad; no es un fallo, solo ruido en el informe.
8. Revisar los **301** de normalización de ruta: asegurarse de que no habilitan bypass de reglas por doble slash / encoding (`/api//db`, `/Bajo-Su-Presencia/../`).

---

## 5. Conclusión

El Spider mapeó bien el sitio y el escaneo activo **no encontró vulnerabilidades explotables**, pero fue un escaneo **solo-GET, no autenticado y fuertemente estrangulado (513 de 1000 en 429)**. Sirve como línea base de que la superficie pública estática es sólida, **no** como certificación del backend: el Data Gateway con `service_role`, el control de acceso por rol y el flujo de autenticación quedan sin evaluar. Para el capítulo de auditoría conviene repetir el escaneo autenticado y adjuntar el informe de Alertas.
