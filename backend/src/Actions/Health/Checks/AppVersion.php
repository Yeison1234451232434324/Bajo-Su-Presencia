<?php

declare(strict_types=1);

namespace App\Actions\Health\Checks;

/**
 * Lee la versión y el commit desplegado desde los archivos generados en el
 * despliegue (no ejecutando `git`: invocar comandos del sistema desde una
 * petición HTTP pública sería un riesgo innecesario, y en producción no
 * suele existir el repositorio).
 *
 * Una clase por comprobación (antes dos métodos privados de
 * `App\Controllers\HealthController`).
 *
 * @package App\Actions\Health\Checks
 */
final class AppVersion
{
    public function version(): string
    {
        $archivo = dirname(__DIR__, 4) . '/VERSION';
        if (is_readable($archivo)) {
            $v = trim((string) file_get_contents($archivo));
            if ($v !== '') {
                return $v;
            }
        }
        return 'desconocida';
    }

    public function commit(): string
    {
        $archivo = dirname(__DIR__, 4) . '/COMMIT';
        if (is_readable($archivo)) {
            $c = trim((string) file_get_contents($archivo));
            if ($c !== '') {
                return substr($c, 0, 12);
            }
        }
        return 'desconocido';
    }
}
