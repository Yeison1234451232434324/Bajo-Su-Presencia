<?php

declare(strict_types=1);

namespace App\Actions\Health\Checks;

use App\Config\Env;

/**
 * Comprueba que el envío de correo esté configurado. No envía nada: un
 * health check no debe producir efectos secundarios.
 *
 * Una clase por comprobación (antes uno de los métodos privados de
 * `App\Controllers\HealthController::ready()`).
 *
 * @package App\Actions\Health\Checks
 */
final class CorreoCheck
{
    /** @return array{estado:string,configurado:bool} */
    public function handle(): array
    {
        $configurado = (string) Env::get('MAIL_USERNAME', '') !== ''
            && (string) Env::get('MAIL_APP_PASSWORD', '') !== '';

        // Degradado y no caído: sin correo el sistema funciona, pero la
        // recuperación de contraseña queda inoperativa.
        return ['estado' => $configurado ? 'operativo' : 'degradado', 'configurado' => $configurado];
    }
}
