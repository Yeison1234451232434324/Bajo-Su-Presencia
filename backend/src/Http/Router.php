<?php

declare(strict_types=1);

namespace App\Http;

use App\Exceptions\ApiException;

/**
 * Enrutador HTTP minimalista con soporte de parámetros de ruta (`{id}`).
 *
 * Asocia método + patrón a un manejador `[Controlador::class, 'método']` o a un
 * `callable`. Distingue 404 (ruta inexistente) de 405 (método no permitido).
 *
 * @package App\Http
 */
final class Router
{
    /**
     * Un manejador es una pareja [clase, método] o cualquier callable.
     *
     * @var array<int,array{
     *     method:string,
     *     regex:string,
     *     params:list<string>,
     *     handler:array{0:class-string,1:string}|callable
     * }>
     */
    private array $routes = [];

    /**
     * Registra una ruta GET.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    public function get(string $path, $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    /**
     * Registra una ruta POST.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    public function post(string $path, $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    /**
     * Registra una ruta PUT.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    public function put(string $path, $handler): void
    {
        $this->add('PUT', $path, $handler);
    }

    /**
     * Registra una ruta PATCH.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    public function patch(string $path, $handler): void
    {
        $this->add('PATCH', $path, $handler);
    }

    /**
     * Registra una ruta DELETE.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    public function delete(string $path, $handler): void
    {
        $this->add('DELETE', $path, $handler);
    }

    /**
     * Registra una ruta.
     *
     * @param array{0:class-string,1:string}|callable $handler
     */
    private function add(string $method, string $path, $handler): void
    {
        $path   = '/' . trim($path, '/');
        $params = [];
        $regex  = preg_replace_callback('/\{(\w+)\}/', static function (array $m) use (&$params): string {
            $params[] = $m[1];
            return '([^/]+)';
        }, $path);

        $this->routes[] = [
            'method'  => $method,
            'regex'   => '#^' . $regex . '$#',
            'params'  => $params,
            'handler' => $handler,
        ];
    }

    /**
     * Resuelve la petición y ejecuta el manejador correspondiente.
     *
     * @throws ApiException 404 si no hay ruta; 405 si el método no coincide.
     */
    public function dispatch(Request $request): void
    {
        $path           = $request->path();
        $method         = $request->method();
        $pathExistedBut = false;

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $path, $matches) !== 1) {
                continue;
            }
            if ($route['method'] !== $method) {
                $pathExistedBut = true;
                continue;
            }

            array_shift($matches);
            /** @var array<string,string> $args */
            $args    = array_combine($route['params'], $matches) ?: [];
            $handler = $route['handler'];

            if (is_array($handler)) {
                [$class, $action] = $handler;
                (new $class())->$action($request, $args);
                return;
            }
            $handler($request, $args);
            return;
        }

        if ($pathExistedBut) {
            throw new ApiException('Método no permitido.', 405);
        }
        throw new ApiException('Ruta no encontrada.', 404);
    }
}
