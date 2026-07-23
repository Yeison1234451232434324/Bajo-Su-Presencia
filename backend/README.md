# Backend PHP + Supabase — Bajo Su Presencia

API REST en **PHP puro (POO en capas)** que se conecta a **Supabase por su API REST**
(GoTrue para autenticación + PostgREST para datos). La sesión se gestiona con un
**JWT propio de máximo 5 minutos** e incluye **protección contra fuerza bruta**
(3 intentos → bloqueo de 15 minutos).

---

## 1. Arquitectura y organización de carpetas

Arquitectura **en capas** con responsabilidades separadas. El flujo de una
petición es:

```
HTTP → public/index.php (Front Controller)
        → Router            (resuelve ruta)
          → Controller      (valida/sanitiza la entrada HTTP)
            → Service       (lógica de negocio y reglas de seguridad)
              → Repository  (acceso a datos)
                → SupabaseClient (HTTP a la API de Supabase)
```

```
backend/
├─ public/
│  ├─ index.php            # Front Controller: CORS, router, manejo global de errores
│  └─ .htaccess            # Rewrite a index.php + cabeceras de seguridad (Apache)
├─ routes/
│  └─ api.php              # Declaración de rutas
├─ src/
│  ├─ Config/              # Configuración del entorno
│  │  ├─ Env.php           #   Carga de .env
│  │  └─ Cors.php          #   CORS estricto por lista blanca
│  ├─ Http/                # Capa HTTP
│  │  ├─ Request.php       #   Petición entrante (body JSON, headers, Bearer)
│  │  ├─ Response.php      #   Respuesta JSON estandarizada
│  │  └─ Router.php        #   Enrutador (404/405)
│  ├─ Security/            # Seguridad
│  │  ├─ Jwt.php           #   Emisión/verificación JWT (TTL ≤ 5 min)
│  │  ├─ AuthMiddleware.php#   Validación de JWT + autorización por rol
│  │  ├─ Sanitizer.php     #   Sanitización de entradas (anti-XSS)
│  │  └─ BruteForceGuard.php #  Bloqueo por intentos fallidos
│  ├─ Supabase/
│  │  └─ SupabaseClient.php# Cliente cURL: GoTrue (auth) + PostgREST (datos)
│  ├─ Repositories/        # Acceso a datos (vía SupabaseClient)
│  │  ├─ UserRepository.php
│  │  └─ LoginAttemptRepository.php
│  ├─ Services/
│  │  └─ AuthService.php   # Orquestación de login/refresh + reglas de seguridad
│  ├─ Controllers/
│  │  └─ AuthController.php
│  ├─ Support/
│  │  └─ Logger.php        # Log de errores en archivo (no se expone al cliente)
│  └─ Exceptions/
│     └─ ApiException.php  # Excepción de dominio con código HTTP
├─ sql/
│  └─ login_attempts.sql   # Tabla de intentos/bloqueo (ejecutar en Supabase)
├─ logs/                   # Logs (no se versionan)
├─ .env.example            # Plantilla de configuración
├─ composer.json           # PSR-4 (App\ → src/) + firebase/php-jwt
└─ README.md
```

**Principios aplicados:** responsabilidad única por clase, inyección de
dependencias por constructor (con valores por defecto para uso simple),
controladores delgados, lógica en servicios y acceso a datos aislado en
repositorios.

---

## 2. Estándar de codificación

- **PSR-12 / PER Coding Style** como guía de estilo (indentación de 4 espacios,
  llaves en línea nueva para clases/métodos, una sentencia por línea, visibilidad
  explícita en todos los miembros, `declare(strict_types=1)` en cada archivo).
- **PSR-4** para autocarga (`App\` → `src/`).
- **PHPDoc** en todas las clases y métodos públicos: descripción, `@param`,
  `@return` y `@throws` donde aplica. Los tipos se declaran también de forma
  nativa (argumentos, retornos y propiedades tipadas).
- **Tipado estricto** y *fail-closed*: ante configuración incompleta o errores,
  el sistema niega el acceso en lugar de continuar.

Verificación rápida de sintaxis:

```bash
find src public routes -name '*.php' -print0 | xargs -0 -n1 php -l
```

---

## 3. Seguridad implementada

| Medida | Dónde | Detalle |
|---|---|---|
| **JWT TTL ≤ 5 min** | `Security/Jwt.php` | TTL tomado de `JWT_TTL` con tope duro de 300 s. |
| **Endpoints protegidos** | `Security/AuthMiddleware.php` | Verifican `Authorization: Bearer` y, opcionalmente, el rol. |
| **Fuerza bruta** | `Security/BruteForceGuard.php` | 3 fallos → bloqueo 15 min (configurable). Estado en `login_attempts`. |
| **Sanitización** | `Security/Sanitizer.php` | `filter_var` + `htmlspecialchars` sobre entradas. |
| **CORS estricto** | `Config/Cors.php` | Lista blanca de orígenes; corta el preflight. |
| **Errores seguros** | `public/index.php` | Detalle al log; al cliente, mensaje genérico. |
| **service_role solo en servidor** | `Supabase/SupabaseClient.php` | La clave de servicio nunca se expone al frontend. |

> **Nota sobre el JWT:** el backend emite su **propio** token (no reutiliza el de
> Supabase) para controlar el TTL de 5 minutos. Para renovarlo sin re-pedir
> credenciales, usa `POST /api/auth/refresh` con el `supabase_refresh_token` que
> devuelve el login.

---

## 4. Configuración del entorno y despliegue

### Requisitos
- PHP **8.1+** con extensiones `curl` y `json`.
- [Composer](https://getcomposer.org/).
- Un proyecto de Supabase.

### Pasos

1. **Instalar dependencias**
   ```bash
   cd backend
   composer install
   ```

2. **Crear el archivo de entorno**
   ```bash
   cp .env.example .env
   ```
   Variables necesarias (Supabase → *Project Settings → API*):

   | Variable | Descripción |
   |---|---|
   | `SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`). |
   | `SUPABASE_ANON_KEY` | Clave pública (anon) — usada para el login. |
   | `SUPABASE_SERVICE_KEY` | Clave `service_role` — **solo servidor**. |
   | `JWT_SECRET` | Secreto de firma (64 hex). |
   | `JWT_TTL` | Vida del token en segundos (≤ 300). |
   | `MAX_LOGIN_ATTEMPTS` | Intentos antes del bloqueo (3). |
   | `LOCKOUT_MINUTES` | Minutos de bloqueo (15). |
   | `CORS_ALLOWED_ORIGINS` | Orígenes permitidos, separados por coma. |

3. **Generar el secreto JWT**
   ```bash
   php -r "echo bin2hex(random_bytes(32));"
   ```
   Pega el resultado en `JWT_SECRET`.

4. **Crear la tabla de bloqueo** en Supabase (SQL Editor):
   ```
   sql/login_attempts.sql
   ```

5. **Levantar en desarrollo**
   ```bash
   composer start          # php -S localhost:8000 -t public
   ```

6. **Producción:** apunta el *DocumentRoot* a `public/`. El `.htaccess` incluido
   reescribe todo a `index.php` (Apache). En Nginx, redirige las peticiones no
   existentes a `/index.php`.

---

## 5. Endpoints

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET`  | `/api/health` | Estado de la API | — |
| `POST` | `/api/auth/login` | Login → JWT + datos del usuario | — |
| `POST` | `/api/auth/refresh` | Renueva el JWT | — |
| `GET`  | `/api/auth/me` | Identidad del usuario autenticado | JWT |
| `GET`  | `/api/usuarios` | Lista de usuarios | JWT · Admin |
| `GET`  | `/api/usuarios/especialistas` | Usuarios activos con especialidad | JWT |
| `GET`  | `/api/usuarios/{id}` | Detalle de un usuario | JWT · Admin |
| `POST` | `/api/usuarios` | Crea usuario (Auth admin + perfil) | JWT · Admin |
| `PUT`  | `/api/usuarios/{id}` | Actualiza perfil | JWT · Admin |
| `PATCH`| `/api/usuarios/{id}/activo` | Activa/desactiva | JWT · Admin |
| `DELETE` | `/api/usuarios/{id}` | Elimina usuario | JWT · Admin |

### Data Gateway (panel y contenido)

El resto de módulos (eventos, noticias, oración, PQR, sedes, recursos, actividades,
informes, asistencias, voluntarios, evaluaciones…) se sirven por un **gateway
genérico** con control de acceso centralizado en PHP:

| Método | Ruta | Acceso |
|---|---|---|
| `GET`  | `/api/db/{tabla}` | Lectura (autenticada; pública para eventos/noticias/oraciones/sedes) |
| `POST` | `/api/db/{tabla}` | Escritura (rol) · inserción pública en `pqr` |
| `PATCH`/`PUT` | `/api/db/{tabla}` | Escritura (rol Administrador/Colaborador) |
| `DELETE` | `/api/db/{tabla}` | Escritura (rol) |

Solo se permiten tablas de una lista blanca; las escrituras exigen rol. El
frontend usa el cliente espejo `controllers/db.client.js` (`window.DB`), que
imita la API de Supabase para que los modelos solo cambien su fuente de datos.

> El módulo **Usuarios** usa la `service_role key` (alta en Auth y escritura
> saltando RLS), por lo que `SUPABASE_SERVICE_KEY` es obligatoria para que
> funcione su CRUD.

Formato de respuesta uniforme:

```json
{ "status": "success|error", "data": { ... }, "message": "..." }
```

### Ejemplo de login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@bsp.com","contrasena":"secreto123"}'
```

Respuesta (éxito):

```json
{
  "status": "success",
  "data": {
    "token": { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 300 },
    "user": { "id": "uuid", "nombre": "Admin", "correo": "admin@bsp.com", "rol": "Administrador" },
    "supabase_refresh_token": "..."
  },
  "message": "Sesión iniciada."
}
```

Tras 3 intentos fallidos:

```json
{ "status": "error", "data": null,
  "message": "Cuenta bloqueada por demasiados intentos. Inténtalo de nuevo en 15 minuto(s)." }
```
