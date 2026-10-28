# Estándar de Codificación — Bajo Su Presencia

Este documento define las convenciones de código usadas en el proyecto, tanto en
el **frontend** (JavaScript / HTML / CSS) como en el **backend** (PHP). El objetivo
es que todo el equipo escriba de la misma forma: código legible, consistente y
mantenible.

---

## 1. Convención principal de nombres: **camelCase**

**camelCase** = la primera palabra va en minúscula y cada palabra siguiente
empieza en **mayúscula**, sin espacios ni guiones bajos:

```
nombreUsuario      ✅
cargarRecursos     ✅
fechaInscripcion   ✅
nombre_usuario     ❌  (eso es snake_case)
NombreUsuario      ❌  (eso es PascalCase)
```

Se usa para **variables y funciones/métodos** en JavaScript y PHP.

> Regla de oro de las mayúsculas: **las mayúsculas marcan el inicio de cada
> palabra interna** (camelCase), salvo en los casos especiales de abajo
> (clases, constantes y archivos).

---

## 2. Tabla rápida de convenciones

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables | `camelCase` | `usuarioActual`, `tokenAcceso` |
| Funciones / métodos | `camelCase` | `cargarRecursos()`, `signInWithPassword()` |
| Funciones internas (JS) | `camelCase` (sin guion bajo: Airbnb prohíbe `_` inicial) | `localFromRow()`, `localSyncRecursos()` |
| Clases (PHP) | `PascalCase` | `AuthController`, `SupabaseClient` |
| "Módulos" (objetos JS) | `PascalCase` | `UsuariosModel`, `EventosModel` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_LOGIN_ATTEMPTS`, `RUTAS_POR_ROL`, `SUPABASE_URL` |
| Nombres de archivo | `kebab-case` / `punto.tipo` | `db.client.js`, `usuarios.controller.js` |
| Clases / IDs en HTML/CSS | `kebab-case` | `campo-password`, `btn-accion` |
| Columnas de la BD | `snake_case` (en español) | `correo_electronico`, `contrasena_hash` |

---

## 3. JavaScript (frontend)

- **Variables y funciones:** `camelCase`.
  ```js
  const correoUsuario = '...';
  function actualizarContador() { ... }
  ```
- **Constantes** (valores fijos): `UPPER_SNAKE_CASE`.
  ```js
  const RUTAS_POR_ROL = { ... };
  const SUPABASE_URL = '...';
  ```
- **Módulos** (objetos que agrupan funciones, patrón IIFE): `PascalCase`.
  ```js
  const UsuariosModel = (() => { ... })();
  ```
- **Funciones internas** del módulo: `camelCase` sin guion bajo inicial (Airbnb,
  regla `no-underscore-dangle`). Su carácter interno lo da el ámbito (dentro del
  IIFE), no el nombre.
  ```js
  function localFromRow(r) { ... }   // mapea fila de BD → objeto de la vista
  ```
- **Guía de estilo: Airbnb JavaScript Style Guide**, verificada con ESLint
  (`eslint-config-airbnb-base`). Indentación de 2 espacios, comillas simples,
  punto y coma, máximo 100 columnas, comas finales en listas multilínea,
  `===`, sin `var`, `prefer-const`, funciones flecha en callbacks.
- **Ejecutar la comprobación:** `npm install` (una vez) y luego `npm run lint`
  (o `npm run lint:fix` para corregir lo automático). La CI la ejecuta en cada
  cambio y bloquea si hay errores.
- **Scripts clásicos, sin módulos:** cada archivo declara al inicio las
  dependencias globales que usa (`/* global DB, BSPVal */`) y los símbolos que
  publica para otros archivos (`/* exported UsuariosModel */`).
- **Comentarios de cabecera** en cada archivo describiendo qué hace y qué usa.

### 3.1 Excepciones a Airbnb (configuradas en `.eslintrc.cjs`)

| Regla | Ajuste | Motivo |
|---|---|---|
| `strict` | desactivada | Quitar `'use strict'` de un script clásico lo dejaría en modo no estricto; Airbnb la prohíbe porque asume módulos ES. |
| `no-use-before-define` | `functions: false` | Las funciones declaradas se elevan; reordenar ~120 usos obligaba a reescribir el orden de archivos enteros. Clases y variables siguen sujetas a la regla. |
| `no-param-reassign` | `props: false` | Los callbacks de DOM mutan el nodo recibido por diseño. Reasignar el parámetro sigue prohibido. |
| `no-console` | permite `warn` y `error` | Son el canal de diagnóstico de la app; `log`/`info` siguen avisando. |

Además hay `eslint-disable` puntuales y comentados (`no-alert` en el respaldo de
`alertify`, `no-new` en `new Chart(...)`, `no-loop-func`, `class-methods-use-this`
en métodos privados).

## 4. PHP (backend) — PSR-12

- **Clases:** `PascalCase`, una clase por archivo, mismo nombre que el archivo.
  ```php
  final class AuthController { ... }   // AuthController.php
  ```
- **Métodos y variables:** `camelCase`.
  ```php
  public function signInWithPassword(string $email, string $password): ?array
  $tokenAcceso = ...;
  ```
- **Constantes de clase:** `UPPER_SNAKE_CASE`.
  ```php
  private const MAX_TTL = 300;
  ```
- **Reglas PSR-12:**
  - `declare(strict_types=1);` al inicio de cada archivo.
  - Indentación de **4 espacios** (no tabs).
  - Llave de apertura de **clases y métodos en línea nueva**; en estructuras de
    control (`if`, `for`) en la **misma línea**.
  - Visibilidad explícita (`public`/`private`/`protected`) en todo método/propiedad.
  - Tipado de argumentos, retornos y propiedades siempre que sea posible.
  - Líneas de hasta 120 columnas (límite blando de PSR-12).
  - Fin de línea `LF`.
  - Verificación: `composer cs` (PHPCS, incluye `index.php`); `composer cs:fix`
    corrige lo automático. La CI la ejecuta y bloquea si hay errores.
- **PHPDoc** en todas las clases y métodos públicos: descripción + `@param`,
  `@return`, `@throws`.

## 5. HTML / CSS

- **IDs y clases:** `kebab-case` (`campo-password`, `input-box`, `btn-cerrar`).
- Atributos en minúscula; indentación de 2 o 4 espacios coherente por archivo.

## 6. Base de datos (PostgreSQL / Supabase)

- **Tablas y columnas:** `snake_case` en **español** (decisión del proyecto):
  `usuarios`, `correo_electronico`, `contrasena_hash`, `fecha_inscripcion`.
- Algunas columnas heredadas llevan tilde (`teléfono`, `descripción`); se respetan
  tal cual existen en el esquema.

## 7. Idioma

- **Nombres de dominio** (variables de negocio, columnas, rutas) en **español**:
  `usuario`, `evento`, `recursos`.
- **Términos técnicos universales** en inglés cuando es lo estándar:
  `token`, `request`, `response`, `controller`.

---

## 8. Resumen visual

```
camelCase        → variables y funciones        (cargarRecursos, tokenAcceso)
PascalCase       → clases y módulos              (AuthController, UsuariosModel)
UPPER_SNAKE_CASE → constantes                    (MAX_TTL, RUTAS_POR_ROL)
kebab-case       → archivos, ids y clases CSS    (db.client.js, campo-password)
snake_case       → columnas de la base de datos  (correo_electronico)
```
