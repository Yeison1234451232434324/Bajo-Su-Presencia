<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Representa la petición HTTP entrante.
 *
 * Decodifica el cuerpo JSON y ofrece accesores seguros para entradas, cabeceras
 * y el token Bearer.
 *
 * @package App\Http
 */
final class Request
{
    /** @var array<string,mixed> Cuerpo JSON decodificado. */
    private array $body;

    /**
     * Query string EN CRUDO, tal y como llegó.
     *
     * Se conserva sin decodificar a propósito: el Data Gateway la reenvía a
     * PostgREST, cuya sintaxis (`select=*&order=nombre.asc`) se corrompería al
     * reconstruirla desde `$_GET`.
     */
    private readonly string $queryString;

    /** @var array<string,string> Cabeceras normalizadas en minúsculas. */
    private array $headers;

    private readonly string $method;
    private readonly string $path;

    public function __construct()
    {
        $this->method      = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $this->queryString = (string) ($_SERVER['QUERY_STRING'] ?? '');
        $this->headers     = $this->readHeaders();

        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $this->path = '/' . trim($path, '/');

        $raw     = file_get_contents('php://input') ?: '';
        $decoded = $raw !== '' ? json_decode($raw, true) : [];
        $this->body = is_array($decoded) ? $decoded : [];
    }

    /** Método HTTP en mayúsculas. */
    public function method(): string
    {
        return $this->method;
    }

    /** Ruta normalizada (sin barra final). */
    public function path(): string
    {
        return $this->path;
    }

    /**
     * Query string en crudo (sin el `?` inicial).
     *
     * Existe para que los controladores no tengan que leer `$_SERVER`
     * directamente: esa dependencia de una superglobal rompía la capa HTTP e
     * impedía probar el controlador sin simular el entorno del servidor.
     */
    public function queryString(): string
    {
        return $this->queryString;
    }

    /**
     * Lee un campo del cuerpo JSON.
     *
     * @param mixed $default
     * @return mixed
     */
    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $default;
    }

    /** @return array<string,mixed> Cuerpo completo. */
    public function all(): array
    {
        return $this->body;
    }

    /** Lee una cabecera por nombre (case-insensitive). */
    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /**
     * Extrae el token del esquema `Authorization: Bearer <token>`.
     */
    public function bearerToken(): ?string
    {
        $auth = $this->header('authorization');
        if ($auth !== null && preg_match('/^Bearer\s+(.+)$/i', $auth, $m) === 1) {
            return trim($m[1]);
        }
        return null;
    }

    /**
     * Normaliza las cabeceras de `$_SERVER` a un mapa en minúsculas.
     *
     * @return array<string,string>
     */
    private function readHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with((string) $key, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr((string) $key, 5)));
                $headers[$name] = (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }

        // Bajo Apache/mod_php (Windows, verificado con Apache 2.4.58) `Authorization`
        // no siempre llega en `$_SERVER['HTTP_AUTHORIZATION']`, aunque el cliente sí
        // la envía; `getallheaders()`/`apache_request_headers()` sí la ven. Sin este
        // respaldo, todas las rutas protegidas por JWT quedan inaccesibles bajo Apache.
        if (!isset($headers['authorization'])) {
            $all = function_exists('getallheaders') ? getallheaders() : (function_exists('apache_request_headers') ? apache_request_headers() : false);
            foreach ((is_array($all) ? $all : []) as $name => $value) {
                if (strtolower($name) === 'authorization') {
                    $headers['authorization'] = (string) $value;
                    break;
                }
            }
        }

        return $headers;
    }
}
