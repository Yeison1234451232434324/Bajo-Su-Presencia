# Despliegue en Render (plan gratuito)

Guía para publicar **Bajo Su Presencia** (sitio + panel + API) en Render usando
Docker. Todo corre en **un solo contenedor** y en **un solo origen**: la web se
sirve en `/` y la API en `/api`, así que desaparece el problema de CORS.

---

## 0. Por qué Render y no InfinityFree

InfinityFree (y 000webhost) **bloquean las conexiones salientes a APIs externas**
en el plan gratuito. Como este backend habla con Supabase por HTTPS, ahí
simplemente no funcionaría. Render permite salida a internet sin restricciones
(salvo los puertos de correo, ver más abajo).

Límites del plan free de Render que debes conocer:

| Límite | Efecto |
|---|---|
| Se **duerme tras 15 min** sin tráfico | La primera visita después tarda 30–60 s en responder |
| 750 horas/mes por workspace | Suficiente para un servicio |
| **Puertos SMTP (25/465/587) bloqueados** | El envío de correos falla — ver §6 |
| Sin disco persistente | Los logs se pierden en cada despliegue (no pasa nada, van también a stdout) |

---

## 1. Lo que ya está hecho en el repo

| Archivo | Para qué |
|---|---|
| `Dockerfile` | Imagen PHP 8.2 + Apache; instala `mbstring`, `apcu` y las dependencias de `backend/` con Composer |
| `deploy/000-default.conf` | VirtualHost: `/api/*` → `backend/public`, el resto → `index.php` raíz |
| `deploy/php.ini` | Ajustes de producción (sin `display_errors`, OPcache, zona horaria) |
| `render.yaml` | Blueprint: crea el Web Service y declara las variables de entorno |
| `.dockerignore` | Deja fuera de la imagen `.env`, `vendor/`, PDFs, tests… |
| `Bajo-Su-Presencia/config/api.config.js` | En producción `API_BASE` queda vacío → la API se llama en el mismo origen |

---

## 2. Lo que tienes que hacer TÚ a mano (yo no puedo)

1. **Crear la cuenta de Render** y conectar tu repositorio de GitHub.
   Requiere verificar el correo y, para servicios de cómputo, añadir una tarjeta
   (no se cobra en el plan free; es solo antifraude).
2. **Subir el repo a GitHub** si aún no está (ver §3).
3. **Cargar las variables de entorno secretas** en el panel de Render (§5). El
   blueprint las deja declaradas pero vacías a propósito — las claves nunca deben
   viajar en el repo.
4. **Decidir qué hacer con el correo** (§6): o subes a un plan de pago, o
   cambiamos el envío a una API HTTP (Brevo/Resend). Ese cambio de código sí lo
   puedo hacer yo, pero necesito que primero crees la cuenta del proveedor y me
   pases la API key para que la pongas como variable de entorno.
5. **Terminar el endurecimiento pendiente ANTES de exponerlo** (§8): login
   hardcodeado y políticas RLS. Publicar con eso abierto es un riesgo real.
6. **Revisar la CSP** de `index.php` (línea ~65): mantiene `http://localhost:8000`
   en `connect-src`. En producción sobra pero no molesta; si quieres, lo quito.

---

## 3. Subir el proyecto a GitHub

```bash
cd C:/Users/User/Desktop/defbsp
git add Dockerfile .dockerignore render.yaml deploy/ DESPLIEGUE.md Bajo-Su-Presencia/config/api.config.js
git commit -m "Configuración de despliegue en Render (Docker)"
git push origin main
```

> `backend/.env` **no** se sube: está en `.gitignore` y en `.dockerignore`.
> Verifícalo con `git status` antes del push — no debe aparecer.

---

## 4. Crear el servicio en Render

**Opción A — con el blueprint (recomendada):**

1. Entra a <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Elige tu repositorio. Render detecta `render.yaml` y muestra el servicio
   `bajo-su-presencia`.
3. Pulsa **Apply**. Se queda «bloqueado» hasta que cargues las variables `sync:false` (§5).

**Opción B — manual:**

1. **New +** → **Web Service** → tu repo.
2. Runtime: **Docker**. Region: la que quieras. Plan: **Free**.
3. Health Check Path: `/api/health`.
4. Crea el servicio y sigue en §5.

---

## 5. Variables de entorno (Dashboard → servicio → Environment)

Copia los valores desde tu `backend/.env` local y desde Supabase
(**Project Settings → API**):

| Variable | De dónde sale | Ejemplo |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project URL | `https://jjpb…​.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Project API keys → `anon` | `eyJ…` |
| `SUPABASE_SERVICE_KEY` | Supabase → `service_role` **(secreta)** | `eyJ…` |
| `JWT_SECRET` | Render lo genera solo (`generateValue`) | — |
| `CORS_ALLOWED_ORIGINS` | La URL pública de Render | `https://bajo-su-presencia.onrender.com` |
| `RESET_URL_BASE` | Misma URL + `/recuperar` | `https://bajo-su-presencia.onrender.com/recuperar` |
| `MAIL_USERNAME` | Tu Gmail | `algo@gmail.com` |
| `MAIL_APP_PASSWORD` | Google → Contraseñas de aplicación (16 caract.) | `abcd efgh ijkl mnop` |

El resto (`APP_ENV`, `JWT_TTL`, `MAX_LOGIN_ATTEMPTS`, `MAIL_HOST`, `MAIL_PORT`…)
ya vienen con valor en `render.yaml`.

Guarda → Render vuelve a desplegar automáticamente.

---

## 6. El correo (importante)

El plan **free de Render bloquea los puertos SMTP**, así que `PHPMailer` sobre
Gmail (`smtp.gmail.com:587`) **fallará** con error 500 en:

- recuperación de contraseña (OTP por correo),
- comprobante de donación,
- confirmación de PQR.

**El resto de la aplicación funciona con normalidad.** Opciones:

| Opción | Coste | Trabajo |
|---|---|---|
| **A.** Subir el Web Service a plan **Starter** ($7/mes) | $7/mes | Ninguno, el SMTP se desbloquea |
| **B.** Cambiar el envío a una **API HTTP** (Brevo: 300 correos/día gratis; o Resend: 3 000/mes) | $0 | Yo modifico `src/Support/Mailer.php`; tú creas la cuenta y me pasas la API key |
| **C.** Dejarlo así por ahora | $0 | Las 3 funciones de correo quedan caídas |

Si eliges **B**, dímelo y lo preparo.

---

## 7. Comprobar que funciona

1. Espera a que el deploy quede en **Live**.
2. Abre `https://<tu-servicio>.onrender.com/api/health` → debe responder
   `{"status":"success","data":{"ok":true}, …}`.
3. Abre `https://<tu-servicio>.onrender.com/` → carga el sitio.
4. Prueba iniciar sesión. Si algo falla, **Dashboard → servicio → Logs**
   (el `X-Request-Id` de la respuesta te lleva a la línea exacta del log).
5. `/api/health/ready` hace una comprobación profunda (Supabase, correo,
   config) y devuelve 503 si algo esencial está mal — útil para diagnosticar.

---

## 8. Antes de dar la URL a usuarios reales

- [ ] **Correo** resuelto (§6) si esas funciones son necesarias para la entrega.
- [ ] **Login hardcodeado** eliminado / migrado (está en tus commits de
      «correcciones de vulnerabilidades», aún sin cerrar).
- [ ] **RLS** de Supabase revisadas: la `service_role key` del backend ignora
      TODAS las políticas, así que cualquier fallo de autorización en el código
      PHP expone toda la base. Repasa `DataGateway/TableAccessPolicy.php`.
- [ ] `APP_ENV=production` confirmado (oculta los mensajes de error internos).
- [ ] Rotar la `SUPABASE_SERVICE_KEY` y el `JWT_SECRET` si alguna vez estuvieron
      en un `.env` subido a Git por error (revisa el historial).
- [ ] Quitar de `connect-src` de la CSP el `http://localhost:8000`.

---

## 9. Desarrollo local (sigue igual)

```bash
# Web + panel
php -S localhost:5500 index.php

# API (otra terminal)
php -S 127.0.0.1:8000 -t backend/public
```

`api.config.js` detecta `localhost`/`127.0.0.1` y sigue apuntando al `:8000`.

### Probar la imagen de producción en tu equipo (si instalas Docker)

```bash
docker build -t bsp .
docker run --rm -p 8080:10000 --env-file backend/.env -e PORT=10000 bsp
# → http://localhost:8080  y  http://localhost:8080/api/health
```
