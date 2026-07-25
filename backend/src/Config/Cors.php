<?php

declare(strict_types=1);

namespace App\Config;

/**
 * Control de cabeceras CORS basado en una lista blanca de orígenes.
 *
 * Solo se refleja el `Origin` de la petición cuando está explícitamente
 * autorizado en `CORS_ALLOWED_ORIGINS`. Las peticiones `OPTIONS` (preflight)
 * se responden y cortan de inmediato.
 *
 * @package App\Config
 */
final class Cors
{
    /**
     * Aplica las cabeceras CORS y atiende el preflight.
     */
    public static function apply(): void
    {
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = array_filter(array_map(
            trim(...),
            explode(',', (string) Env::get('CORS_ALLOWED_ORIGINS', ''))
        ));

        // En desarrollo se acepta cualquier puerto local (Live Server usa
        // 5500/5501/5502… según el caso), para no tener que adivinarlo.
        $isLocalDev = Env::get('APP_ENV') === 'development'
            && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', (string) $origin) === 1;

        if ($origin !== '' && ($isLocalDev || in_array($origin, $allowed, true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 600');

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
