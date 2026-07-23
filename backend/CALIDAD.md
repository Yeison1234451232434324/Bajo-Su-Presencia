# Ingeniería de Calidad — Backend

Guía operativa de las herramientas de calidad integradas en el proyecto.

---

## 1. Comandos disponibles

Todos se ejecutan desde `backend/`.

| Comando | Qué hace | ¿Bloquea la integración? |
|---|---|---|
| `composer calidad` | **Batería completa**: sintaxis → PHPStan → PSR-12 → pruebas → auditoría | — |
| `composer test` | Suite de pruebas (lógica pura) | Sí |
| `composer analyse` | PHPStan nivel 8 | Sí |
| `composer cs` | Comprueba PSR-12 | No (informativo) |
| `composer cs:fix` | Corrige PSR-12 automáticamente | — |
| `composer rector:dry` | Muestra modernizaciones **sin aplicarlas** | No |
| `composer rector` | Aplica las modernizaciones | — |
| `composer audit` | CVEs en dependencias | Sí |
| `composer lint` | Sintaxis del punto de entrada | Sí |

> Antes de subir cambios: `composer calidad`.

---

## 2. Estado de cada herramienta

| Herramienta | Versión | Estado | Configuración |
|---|---|---|---|
| PHPStan | 2.2.5 | **Nivel 8, limpio** | `phpstan.neon` |
| PHP_CodeSniffer | 4.0.1 | **PSR-12 conforme** | `phpcs.xml` |
| Rector | 2.5 | **Aplicado** (8 reglas) | `rector.php` |
| Suite propia | — | **20/20 correctas** | `tests/` |
| composer audit | — | **Sin vulnerabilidades** | — |
| Psalm | — | *No instalado* | `psalm.xml` preparado |
| Cobertura | — | *No disponible* | Requiere Xdebug o PCOV |

### Por qué PHPStan está en nivel 8 y no en 9

El nivel 9 exige que ningún valor `mixed` se convierta sin comprobación. El
cuerpo de las peticiones llega como JSON decodificado —`mixed` por naturaleza—
y el proyecto lo convierte con `(string)` en **54 puntos**.

Alcanzar el nivel 9 requiere accesores tipados en `Request` (`inputString()`,
`inputInt()`…) y propagarlos por servicios y controladores. Es un refactor
amplio que debe ir acompañado de pruebas de los flujos afectados, hoy
inexistentes. Se documenta como pendiente en lugar de enmascararlo con una
lista de exclusiones.

**No hay ninguna advertencia silenciada**: `phpstan.neon` no contiene
`ignoreErrors`.

### Reglas de Rector excluidas deliberadamente

| Regla | Motivo |
|---|---|
| `ChangeSwitchToMatchRector` | `switch` compara con `==` y permite caída entre casos; `match` compara con `===` y lanza `UnhandledMatchError`. La conversión propuesta era equivalente, pero recae sobre el **Data Gateway** —la ruta que decide qué tabla se lee o escribe— y no existe ninguna prueba que la cubra. |
| `ReadOnlyClassRector` | Marcar una clase entera como `readonly` es un cambio semántico amplio que conviene decidir clase por clase. |

---

## 3. Pruebas

### Ejecución

```bash
composer test
```

### Estructura

```
tests/
├── run.php          Ejecutor (recorre tests/casos/*.php)
├── Corredor.php     Micro-framework de aserciones (namespace App\Tests)
└── casos/
    ├── ValidatorTest.php   12 pruebas — validación de teléfono
    └── LoggerTest.php       8 pruebas — redacción y trazabilidad
```

### Por qué un ejecutor propio y no PHPUnit

El proyecto no declaraba ninguna dependencia de desarrollo. Este ejecutor
permite tener pruebas **reales y ejecutables** sin bloquear la entrega. La
migración a PHPUnit es directa: cada `prueba()` pasa a ser un método `test*` y
cada `asegurar*` a su `assert*` equivalente.

### Validación de la propia suite

Una suite que siempre pasa no demuestra nada. Se comprobó su capacidad de
detección inyectando una regresión deliberada en el validador (aceptar más de
10 dígitos): **falló 1 de 20**. Restaurado el código, **20/20**.

### Cobertura de código

**No disponible en este entorno.** Requiere la extensión `xdebug` o `pcov`, y
ninguna está instalada (`php -m` no las lista). El flujo de CI sí instala
`pcov`, por lo que la cobertura podrá generarse allí.

### Pruebas pendientes, por prioridad

| Prioridad | Área | Requisito |
|---|---|---|
| 1 | Autenticación: login, verificación triple, expiración del JWT | Entorno con credenciales desechables |
| 2 | Autorización: matriz rol × tabla del Data Gateway | Tokens de los tres roles |
| 3 | Fuerza bruta y OTP | Doble de `LoginAttemptRepository` |
| 4 | Repositorios contra Supabase | Cliente HTTP simulado |
| 5 | Extremo a extremo de los flujos CRUD | Playwright o similar |

---

## 4. Integración continua

Definida en `.github/workflows/calidad.yml`. Se dispara en cada `push` a las
ramas principales, en cada *pull request* y de forma manual.

**Bloquean la integración**: validación de Composer, sintaxis, PHPStan,
pruebas y `composer audit`.
**Informan sin bloquear**: PHPCS y Rector, por tratarse de estilo y
modernización. Conviene endurecerlos una vez saneada la deuda existente.

---

## 5. Observabilidad

| Aspecto | Estado |
|---|---|
| Niveles | `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| Redacción de secretos | Recursiva: contraseñas, tokens, OTP → `[redactado]` |
| Datos personales | Correos enmascarados: `y*****@dominio.com` |
| Identificador de solicitud | En cada línea y en la cabecera `X-Request-Id` |
| Formato | Texto con prefijo `[fecha] [id] NIVEL:` |
| Rotación | **No implementada** — un archivo por día sin caducidad |

### Por qué no se migró a Monolog

La implementación actual ya cubre niveles, redacción y trazabilidad, y está
respaldada por 8 pruebas. Monolog aportaría formato JSON, rotación y
*handlers* adicionales, pero sustituir un componente probado por otro sin
pruebas equivalentes es un intercambio desfavorable en este momento. Se
recomienda migrar **junto con** el traslado de las pruebas.

---

## 6. Diagnóstico (health checks)

| Endpoint | Uso | Comprueba |
|---|---|---|
| `/api/health` | Contrato original (compatibilidad) | — |
| `/api/health/live` | Sondas de alta frecuencia | Que el proceso responde |
| `/api/health/ready` | Sonda profunda | Base de datos (con latencia), almacenamiento, correo y configuración |

`/api/health/ready` devuelve **HTTP 503** si alguna dependencia esencial falla,
para que un balanceador retire la instancia automáticamente.

Nunca expone URLs, claves ni rutas del sistema de archivos: informa del
**estado**, no de la **configuración**.

La versión se lee de `VERSION` y el commit de `COMMIT` (si el despliegue lo
genera). No se ejecuta `git` desde una petición HTTP pública.

---

## 7. Mantenimiento

- **Antes de cada entrega**: `composer calidad`.
- **Al añadir una dependencia**: `composer audit`.
- **Al subir el nivel de PHPStan**: primero introducir accesores tipados en
  `Request`, después las pruebas de los flujos afectados y por último el nivel.
- **Al aplicar Rector**: revisar siempre el diff de `rector:dry` antes de
  ejecutar `rector`.
