<?php

/**
 * Front Controller — único punto de entrada de la API.
 *
 * Responsabilidades:
 *  1. Cargar el autoloader y las variables de entorno.
 *  2. Aplicar CORS y endurecer la salida de errores.
 *  3. Despachar la ruta.
 *  4. Centralizar el manejo de errores: los detalles internos van al log y al
 *     cliente solo le llega un JSON estandarizado y seguro.
 *
 * @package App
 */

declare(strict_types=1);

use App\Config\Cors;
use App\Config\Env;
use App\Config\SecurityHeaders;
use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Http\Router;
use App\Support\Logger;

require dirname(__DIR__) . '/vendor/autoload.php';

Env::load(dirname(__DIR__) . '/.env');

$isDev = Env::get('APP_ENV') === 'development';
error_reporting(E_ALL);
ini_set('display_errors', $isDev ? '1' : '0');
ini_set('log_errors', '1');

$logger = new Logger();

// Cabeceras de seguridad ANTES de CORS y del despacho: así ninguna respuesta
// (incluidas las de error y el preflight OPTIONS) sale sin protección.
SecurityHeaders::apply();

// Identificador de la solicitud, devuelto al cliente para trazabilidad: ante
// una incidencia, el usuario puede citar este código y el equipo localiza en
// el log TODAS las líneas de esa petición sin pedirle datos personales.
if (!headers_sent()) {
    header('X-Request-Id: ' . Logger::requestId());
}

Cors::apply();

try {
    $router = new Router();
    require dirname(__DIR__) . '/routes/api.php';
    $router->dispatch(new Request());
} catch (ApiException $e) {
    // Errores esperados: el mensaje es seguro para el cliente.
    Response::error($e->getMessage(), $e->httpStatus(), $e->errors());
} catch (Throwable $e) {
    // Errores inesperados: se registra el detalle con nivel CRITICAL (un fallo
    // no contemplado puede indicar un defecto o un ataque en curso) y el
    // cliente recibe un mensaje genérico acompañado del identificador.
    $logger->critical($e->getMessage(), [
        'exception' => $e::class,
        'file'      => $e->getFile(),
        'line'      => $e->getLine(),
    ]);
    Response::error(
        $isDev
            ? $e->getMessage()
            : 'Ocurrió un error interno. Cita este código al reportarlo: ' . Logger::requestId(),
        500
    );
}
