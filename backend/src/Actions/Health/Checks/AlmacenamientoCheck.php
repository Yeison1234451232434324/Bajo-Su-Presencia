<?php

declare(strict_types=1);

namespace App\Actions\Health\Checks;

/**
 * Comprueba que el directorio de logs exista y admita escritura. Sin él, el
 * sistema perdería toda la trazabilidad de forma silenciosa.
 *
 * Una clase por comprobación (antes uno de los métodos privados de
 * `App\Controllers\HealthController::ready()`).
 *
 * @package App\Actions\Health\Checks
 */
final class AlmacenamientoCheck
{
    /** @return array{estado:string,escritura:bool} */
    public function handle(): array
    {
        $dir = dirname(__DIR__, 4) . '/logs';
        $ok  = is_dir($dir) && is_writable($dir);

        return ['estado' => $ok ? 'operativo' : 'degradado', 'escritura' => $ok];
    }
}
