<?php

declare(strict_types=1);

/**
 * FRONT CONTROLLER — único punto de entrada del sitio público y del panel.
 *
 * Motivo de su existencia (hallazgo crítico de la 2.ª auditoría):
 * el sitio se servía con `php -S -t .` sobre la raíz del proyecto, de modo que
 * CUALQUIERA podía descargar `backend/.env` por HTTP y obtener la
 * `SUPABASE_SERVICE_KEY` (que ignora todas las políticas RLS), el `JWT_SECRET`
 * (que permite falsificar tokens de cualquier rol) y la contraseña de correo.
 *
 * Este controlador invierte el modelo de seguridad: en lugar de exponer todo el
 * árbol de archivos y confiar en que nadie encuentre lo sensible, NADA se sirve
 * salvo lo que aquí se autoriza explícitamente (lista blanca).
 *
 * Responsabilidades:
 *   1. Resolver URLs limpias (/login, /eventos…) a sus vistas.
 *   2. Servir activos estáticos con extensión y ubicación autorizadas.
 *   3. Denegar cualquier otra ruta, con protección anti path traversal.
 *   4. Emitir cabeceras de seguridad en todas las respuestas.
 *
 * @package App\Front
 */

// ============================================================================
//  Constantes de ubicación
// ============================================================================

/** Raíz del proyecto (este archivo vive en ella). */
define('RAIZ', __DIR__);

/** Carpeta de la aplicación web; nada fuera de ella se sirve jamás. */
define('APP_DIR', RAIZ . DIRECTORY_SEPARATOR . 'Bajo-Su-Presencia');

/** Prefijo público de los activos, para reescribir rutas relativas. */
define('APP_URL', '/Bajo-Su-Presencia');

// ============================================================================
//  Cabeceras de seguridad (equivalentes a las del API, adaptadas a HTML)
// ============================================================================

/**
 * Emite las cabeceras de seguridad de las páginas.
 *
 * Nota sobre CSP: las vistas usan manejadores en línea (onclick) y estilos
 * embebidos, por lo que una política sin 'unsafe-inline' rompería la
 * aplicación. Se aplica la política más estricta compatible con el código
 * actual y se documenta el endurecimiento pendiente en el informe.
 */
function enviarCabecerasSeguridad(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    header('Cross-Origin-Opener-Policy: same-origin');

    $csp = "default-src 'self'; "
         . "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
         . "style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://unpkg.com 'unsafe-inline'; "
         . "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com data:; "
         . "img-src 'self' data: https:; "
         . "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https://*.supabase.co; "
         . "frame-ancestors 'self'; base-uri 'self'; object-src 'none'";
    header('Content-Security-Policy: ' . $csp);

    if (esConexionSegura()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }

    header_remove('X-Powered-By');
}

/** Determina si la petición llegó por HTTPS (contempla proxys inversos). */
function esConexionSegura(): bool
{
    if (($_SERVER['HTTPS'] ?? '') !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

// ============================================================================
//  Tabla de rutas — URLs limpias → vista
// ============================================================================

/**
 * Lista blanca de rutas. La clave es la URL limpia; el valor, la vista
 * relativa a APP_DIR. Cualquier ruta ausente de esta tabla no existe.
 *
 * @return array<string,string>
 */
function tablaDeRutas(): array
{
    return [
        // ── Público ──────────────────────────────────────────────
        '/'            => 'views/public/inicio/index.html',
        '/inicio'      => 'views/public/inicio/index.html',
        '/login'       => 'views/public/login/login.html',
        '/recuperar'   => 'views/public/login/recuperar.html',
        '/pqr'         => 'views/public/pqr/pqr.html',
        '/donaciones'  => 'views/public/donaciones/donaciones.html',
        '/ayuda'       => 'views/ayuda/ayuda.html',

        // ── Panel · Administrador ────────────────────────────────
        '/dashboard'              => 'views/dashboard/admin/dashboard.html',
        '/usuarios'               => 'views/dashboard/admin/usuarios.html',
        '/noticias'               => 'views/dashboard/admin/noticias.html',
        '/eventos'                => 'views/dashboard/admin/eventos.html',
        '/recursos'               => 'views/dashboard/admin/recursos.html',
        '/sedes'                  => 'views/dashboard/admin/sedes.html',
        '/voluntarios'            => 'views/dashboard/admin/voluntarios.html',
        '/actividades'            => 'views/dashboard/admin/actividades.html',
        '/oracion'                => 'views/dashboard/admin/oracion.html',
        '/pqr-admin'              => 'views/dashboard/admin/pqr.html',
        '/donaciones-admin'       => 'views/dashboard/admin/donaciones.html',
        '/reportes'               => 'views/dashboard/admin/reporte.html',
        '/generar-reportes'       => 'views/dashboard/admin/generar-reportes.html',

        // ── Panel · Colaborador ──────────────────────────────────
        '/colaborador'             => 'views/dashboard/colaborador/eventos.html',
        '/colaborador/eventos'     => 'views/dashboard/colaborador/eventos.html',
        '/colaborador/noticias'    => 'views/dashboard/colaborador/noticias.html',
        '/colaborador/oracion'     => 'views/dashboard/colaborador/oracion.html',
        '/colaborador/actividades' => 'views/dashboard/colaborador/actividades.html',
        '/colaborador/reporte'     => 'views/dashboard/colaborador/reporte.html',
        '/colaborador/perfil'      => 'views/dashboard/colaborador/perfil.html',

        // ── Panel · Voluntario ───────────────────────────────────
        '/voluntario'                 => 'views/dashboard/voluntario/calificaciones.html',
        '/voluntario/calificaciones'  => 'views/dashboard/voluntario/calificaciones.html',
        '/voluntario/disponibilidad'  => 'views/dashboard/voluntario/disponibilidad.html',
        '/voluntario/actividades'     => 'views/dashboard/voluntario/mis-actividades.html',
        '/voluntario/eventos'         => 'views/dashboard/voluntario/eventos.html',
        '/voluntario/perfil'          => 'views/dashboard/voluntario/perfil.html',

        // ── Perfil genérico ──────────────────────────────────────
        '/perfil' => 'views/dashboard/colaborador/perfil.html',
    ];
}

/**
 * Extensiones de activo autorizadas y su tipo MIME.
 * Nótese la ausencia deliberada de: php, env, sql, md, json, log, lock, git.
 *
 * @return array<string,string>
 */
function tiposPermitidos(): array
{
    return [
        'css'   => 'text/css; charset=utf-8',
        'js'    => 'application/javascript; charset=utf-8',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'webp'  => 'image/webp',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'eot'   => 'application/vnd.ms-fontobject',
        'map'   => 'application/json; charset=utf-8',
    ];
}

// ============================================================================
//  Utilidades
// ============================================================================

/**
 * Comprueba que una ruta real está contenida dentro de un directorio base.
 * Es la defensa efectiva contra path traversal (`../`, enlaces simbólicos,
 * codificaciones): se compara la ruta ya resuelta por el sistema de archivos.
 */
function estaContenidoEn(string $rutaReal, string $base): bool
{
    $base = realpath($base);
    return $base !== false
        && str_starts_with($rutaReal, $base . DIRECTORY_SEPARATOR);
}

/** Responde con una página de error mínima, sin revelar rutas internas. */
function responderError(int $codigo, string $titulo, string $detalle): void
{
    http_response_code($codigo);
    header('Content-Type: text/html; charset=utf-8');
    $t = htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8');
    $d = htmlspecialchars($detalle, ENT_QUOTES, 'UTF-8');
    echo <<<HTML
    <!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{$codigo} — Bajo Su Presencia</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:"Segoe UI",Arial,sans-serif;background:#0F1E5A;color:#fff;text-align:center}
    .c{max-width:34rem;padding:2rem}h1{font-size:4rem;margin:0;color:#F5C215}
    p{font-size:1.125rem;color:#dbe4ff;line-height:1.6}
    a{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#F5C215;
    color:#0F1E5A;text-decoration:none;border-radius:.5rem;font-weight:700}</style>
    </head><body><div class="c"><h1>{$codigo}</h1><p><b>{$t}</b></p><p>{$d}</p>
    <a href="/">Volver al inicio</a></div></body></html>
    HTML;
    exit;
}

/**
 * Sirve una vista HTML inyectando una etiqueta <base> con su carpeta original.
 *
 * Por qué: las vistas enlazan sus activos con rutas relativas
 * (`../../../controllers/x.js`). Al servirlas bajo una URL limpia como /login,
 * esas rutas se resolverían mal. La etiqueta <base> restituye el contexto sin
 * necesidad de reescribir las 27 vistas.
 */
function servirVista(string $rutaVista): void
{
    $absoluta = APP_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rutaVista);
    $real     = realpath($absoluta);

    if ($real === false || !is_file($real) || !estaContenidoEn($real, APP_DIR)) {
        responderError(404, 'Página no encontrada', 'La página solicitada no existe.');
    }

    $html = file_get_contents($real);
    if ($html === false) {
        responderError(500, 'Error interno', 'No fue posible mostrar la página.');
    }

    // Carpeta pública de la vista, para que las rutas relativas sigan funcionando.
    $carpeta = APP_URL . '/' . trim(dirname($rutaVista), '/') . '/';
    $base    = '<base href="' . htmlspecialchars($carpeta, ENT_QUOTES, 'UTF-8') . '">';

    // Se inserta inmediatamente después de <head> (antes de cualquier enlace).
    $html = preg_replace('/(<head[^>]*>)/i', '$1' . "\n  " . $base, $html, 1) ?? $html;

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, must-revalidate');
    echo $html;
    exit;
}

/**
 * Capa de compatibilidad con las rutas antiguas (`…/views/…/pagina.html`).
 *
 * Por qué existe: la navegación interna de la aplicación —el redirigido tras
 * el inicio de sesión (`RUTAS_POR_ROL`), los enlaces de cierre de sesión de los
 * tres menús laterales y los marcadores que el equipo ya tuviera guardados—
 * apunta a las rutas físicas de las vistas. Sin esta capa, todas ellas
 * devolverían 404 tras la introducción de las URLs limpias.
 *
 * Se responde con 301 (permanente) hacia la URL limpia equivalente, de modo que
 * el navegador aprenda la nueva dirección y la estructura interna deje de
 * aparecer en la barra de direcciones.
 *
 * @return bool false si la ruta no corresponde a una vista conocida.
 */
function redirigirRutaAntigua(string $ruta): bool
{
    if (!str_starts_with($ruta, APP_URL . '/')) {
        return false;
    }

    $relativa = substr($ruta, strlen(APP_URL) + 1);
    if (!str_ends_with(strtolower($relativa), '.html')) {
        return false;
    }

    // Búsqueda inversa: vista física → URL limpia.
    $limpia = array_search($relativa, tablaDeRutas(), true);
    if ($limpia === false) {
        return false;
    }

    $consulta = $_SERVER['QUERY_STRING'] ?? '';
    header('Location: ' . $limpia . ($consulta !== '' ? '?' . $consulta : ''), true, 301);
    exit;
}

/**
 * Sirve un activo estático si su extensión y ubicación están autorizadas.
 *
 * @return bool false si la ruta no corresponde a un activo servible.
 */
function servirActivo(string $ruta): bool
{
    // Solo se admiten activos bajo el prefijo de la aplicación.
    if (!str_starts_with($ruta, APP_URL . '/')) {
        return false;
    }

    $relativa  = substr($ruta, strlen(APP_URL) + 1);
    $extension = strtolower((string) pathinfo($relativa, PATHINFO_EXTENSION));
    $permitidos = tiposPermitidos();

    if ($extension === '' || !isset($permitidos[$extension])) {
        return false;
    }

    $absoluta = APP_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativa);
    $real     = realpath($absoluta);

    // La comprobación de contención neutraliza cualquier intento de traversal.
    if ($real === false || !is_file($real) || !estaContenidoEn($real, APP_DIR)) {
        return false;
    }

    header('Content-Type: ' . $permitidos[$extension]);
    header('X-Content-Type-Options: nosniff');

    // Caché con revalidación en lugar de expiración fija.
    //
    // Por qué: el proyecto no versiona los nombres de sus activos (no hay
    // hash en el nombre del archivo). Con `max-age=3600` un usuario podía
    // seguir ejecutando el JavaScript anterior hasta una hora después de un
    // despliegue — incluido un despliegue que corrigiera una vulnerabilidad.
    // Con ETag el navegador pregunta siempre, pero recibe un 304 vacío si el
    // archivo no cambió: se conserva el ahorro de tráfico sin servir código
    // obsoleto.
    $etag = '"' . md5_file($real) . '"';
    header('ETag: ' . $etag);
    header('Cache-Control: no-cache, must-revalidate');

    $enviado = trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    if ($enviado !== '' && $enviado === $etag) {
        http_response_code(304);
        return true;
    }

    readfile($real);
    return true;
}

// ============================================================================
//  Despacho
// ============================================================================

enviarCabecerasSeguridad();

$rutaCruda = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$ruta      = rawurldecode($rutaCruda);

// Rechazo temprano de secuencias de traversal y bytes nulos.
if (str_contains($ruta, '..') || str_contains($ruta, "\0")) {
    responderError(400, 'Solicitud no válida', 'La ruta solicitada no es válida.');
}

// Normalización: sin barra final (salvo la raíz) y con barra inicial.
$ruta = '/' . trim($ruta, '/');
if ($ruta === '/') {
    $ruta = '/';
}

// 1) ¿Es una ruta de la aplicación?
$rutas = tablaDeRutas();
if (isset($rutas[$ruta])) {
    servirVista($rutas[$ruta]);
}

// 2) ¿Es una ruta antigua de vista? Se redirige a su URL limpia (compatibilidad
//    con la navegación interna de la aplicación y con marcadores existentes).
redirigirRutaAntigua($ruta);

// 3) ¿Es un activo estático autorizado?
if (servirActivo($ruta)) {
    exit;
}

// 4) Cualquier otra cosa no existe. Incluye .env, código fuente, vendor,
//    logs y el directorio backend: nunca se sirven porque no están listados.
responderError(404, 'Página no encontrada', 'La dirección solicitada no existe en este sitio.');
