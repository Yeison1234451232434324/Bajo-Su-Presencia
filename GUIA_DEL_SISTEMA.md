# Guía del Sistema — Bajo Su Presencia

Documentación de cómo está montado el sistema, cómo ejecutarlo y cómo probarlo.

---

## 1. Arquitectura general

```
Navegador (frontend)  →  Backend PHP  →  Supabase (PostgreSQL + Auth)
   HTML/JS/CSS            API REST         Base de datos en la nube
```

- **Frontend** (`Bajo-Su-Presencia/`): páginas HTML + JavaScript (patrón MVC en el
  cliente). No habla directo con Supabase: llama al **backend PHP**.
- **Backend** (`backend/`): API REST en PHP puro (capas Controller → Service →
  Repository). Valida credenciales, emite JWT, aplica seguridad y habla con
  Supabase por su API REST (GoTrue + PostgREST).
- **Supabase**: base de datos PostgreSQL + autenticación. Está en la nube (siempre
  disponible); no se ejecuta localmente.

### Flujo de datos
- **Login / sesión:** `auth.controller.js` → `POST /api/auth/login` → Supabase Auth.
- **Datos del panel:** los modelos (`*.model.js`) usan `window.DB` (`db.client.js`),
  que llama al **Data Gateway** del backend (`/api/db/{tabla}`) con el JWT.
- **Páginas públicas** (home, PQR): usan el nivel público del gateway (lectura
  anónima de noticias/eventos/oraciones/sedes; radicación anónima de PQR).

---

## 2. Puertos

| Servicio | Puerto | Cómo se levanta |
|---|---|---|
| **Backend PHP** | `8000` | `composer start` (en `backend/`) |
| **Frontend** | `5501` (recomendado) | servidor estático sin auto-reload |
| Supabase | nube | ya está en línea |

> El frontend define la URL del backend en `controllers/api.config.js`
> (`window.API_BASE = 'http://localhost:8000'`). Cámbiala al desplegar.

---

## 3. Cómo ejecutar el proyecto (local)

**Terminal 1 — Backend:**
```powershell
cd "C:\Users\User\Desktop\defbsp\backend"
composer install        # solo la primera vez
composer start          # queda en http://localhost:8000
```
Verifica: abre `http://localhost:8000/api/health` → `{"status":"success",...}`.

**Terminal 2 — Frontend (Front Controller, SIN auto-reload):**
```powershell
cd "C:\Users\User\Desktop\defbsp"
php -S localhost:5500 index.php
```
Abre el login:
```
http://localhost:5500/login
```

> ⛔ **NUNCA uses `php -S ... -t .`** (servir la raíz del proyecto). Ese comando
> deja `backend/.env` **descargable por HTTP**, exponiendo la
> `SUPABASE_SERVICE_KEY` (que ignora todas las políticas RLS), el `JWT_SECRET`
> (que permite falsificar tokens de cualquier rol) y la contraseña de correo.
> El último argumento debe ser **`index.php`**, que actúa como router y solo
> sirve lo que autoriza su lista blanca.

> ⚠️ **NO uses Live Server de VS Code** para el panel. Su auto-recarga puede
> **cancelar la navegación** del login al dashboard (te deja "atascado" en el
> login). Usa el servidor simple de arriba, o si insistes en Live Server,
> desactiva su recarga automática.

---

## 4. Credenciales de prueba (solo desarrollo)

El login pide **tres campos**: usuario, correo y contraseña (deben coincidir).

| Usuario | Correo | Contraseña | Rol | Panel |
|---|---|---|---|---|
| `yeison` | yeisonvargas8022@gmail.com | `yeison123` | Administrador | dashboard admin |
| `camilo` | brandon1999.bq@gmail.com | `colab123` | Colaborador | colaborador/eventos |
| `carlos` | carlos@correo.com | `carlos123` | Voluntario | voluntario/calificaciones |

Otras cuentas (`fabian`, `joel` = Admin; `brandon` = Voluntario;
`joelvergara`, `pastor` = Usuario/solo móvil) existen pero sin contraseña conocida;
se les puede asignar desde **Gestión de Usuarios** o pidiéndolo al equipo.

---

## 5. Seguridad implementada

- **JWT propio** con expiración estricta de **5 minutos** (`/api/auth/refresh` lo renueva).
- **Bloqueo por fuerza bruta:** 3 intentos fallidos → cuenta bloqueada **15 minutos**
  (tabla `login_attempts`).
- **Verificación triple** en login: correo + contraseña (Supabase Auth) **y** que el
  nombre de usuario coincida con el de la cuenta.
- **Control por rol** en el gateway (Administrador / Colaborador / Voluntario).
- **Sanitización**, **CORS** por lista blanca, errores genéricos al cliente + log interno.
- **Recuperación de contraseña** por **código OTP de 6 dígitos** (correo Gmail) + **JWT**
  temporal: no revela si el correo existe, límite de 5 intentos y reenvío cada 60 s.

---

## 6. Recuperación de contraseña (OTP de 6 dígitos + JWT)

Todo ocurre en una sola página (`recuperar.html`), sin recargar:

1. **Correo** → el usuario ingresa su correo. El backend responde **siempre igual**
   ("Si el correo está registrado, recibirás un código…") para no revelar si existe,
   y devuelve un **JWT temporal** (10 min) que el frontend guarda **solo en memoria**.
2. **Código** → si el correo existe, llega por **correo (Gmail)** un **OTP de 6 dígitos**
   (válido 10 min). Del OTP solo se guarda su **hash** en la base de datos.
   - Máximo **5 intentos** → la solicitud se bloquea 15 min.
   - Botón **"Reenviar"** habilitado a los **60 s** (genera un OTP y un JWT nuevos).
3. **Nueva contraseña** → tras validar el OTP, se exige una contraseña fuerte
   (mínimo 8, mayúscula, minúscula, número y símbolo). Al cambiarla, se invalidan
   el OTP, el JWT y cualquier solicitud previa (anti-reutilización/replay).

> Requiere configurar `MAIL_USERNAME` y `MAIL_APP_PASSWORD` (contraseña de aplicación
> de Gmail) en `backend/.env`. Sin eso, el flujo funciona pero el OTP solo queda en el log.

---

## 7. Endpoints del backend

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del API |
| POST | `/api/auth/login` | Login (usuario + correo + contraseña) → JWT |
| POST | `/api/auth/refresh` | Renueva el JWT |
| GET | `/api/auth/me` | Identidad del usuario autenticado (JWT) |
| POST | `/api/auth/password/forgot` | Paso 1: envía el OTP y devuelve el JWT temporal |
| POST | `/api/auth/password/verify-otp` | Paso 2: valida el OTP → JWT verificado |
| POST | `/api/auth/password/resend` | Reenvía el OTP (cooldown 60 s) |
| POST | `/api/auth/password/reset` | Paso 3: cambia la contraseña (JWT verificado) |
| GET/POST/PUT/PATCH/DELETE | `/api/usuarios[...]` | CRUD de usuarios (Admin) |
| GET/POST/PATCH/DELETE | `/api/db/{tabla}` | Data Gateway (panel + público) |

---

### URLs del sistema (Front Controller)

| Ruta | Destino |
|---|---|
| `/` | Inicio público |
| `/login` · `/recuperar` | Acceso y recuperación |
| `/pqr` | Radicar PQR |
| `/dashboard` | Panel de administrador |
| `/usuarios` `/eventos` `/noticias` `/recursos` `/sedes` `/voluntarios` | Módulos de administrador |
| `/colaborador/...` | Panel de colaborador |
| `/voluntario/...` | Panel de voluntario |

Las rutas antiguas (`/Bajo-Su-Presencia/views/.../pagina.html`) siguen
funcionando: redirigen con **301** a su URL limpia equivalente.

---

## 8. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| El login no pasa al panel / "se reinicia" | Live Server cancela la navegación | Usar el servidor simple (puerto 5501) |
| "Usuario, correo o contraseña incorrectos" | Algún dato no coincide (el usuario debe ser el exacto de la cuenta) | Verificar usuario/correo/contraseña |
| "Cuenta bloqueada… 15 minutos" | 3 intentos fallidos | Esperar 15 min o limpiar la fila en `login_attempts` |
| Cambios no se reflejan | Caché del navegador | F12 → Network → "Disable cache", o `?nocache=123` en la URL |
| El backend no responde | No está corriendo | `composer start` en `backend/` |

---

## 9. Estándar de codificación

Ver **`ESTANDAR_DE_CODIFICACION.md`** (convenciones de nombres: camelCase,
PascalCase, constantes, archivos, etc.).
