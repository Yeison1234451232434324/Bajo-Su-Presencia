<?php

declare(strict_types=1);

namespace App\Actions\Health\Checks;

use App\Config\Env;

/**
 * Verifica que las variables críticas estén presentes y que el secreto de
 * firma tenga la longitud mínima exigida. Nunca expone sus valores.
 *
 * Una clase por comprobación (antes uno de los métodos privados de
 * `App\Controllers\HealthController::ready()`).
 *
 * @package App\Actions\Health\Checks
 */
final class ConfiguracionCheck
{
    /** @return array{estado:string,faltantes:int} */
    public function handle(): array
    {
        $requeridas = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
        $faltantes  = 0;
        foreach ($requeridas as $clave) {
            if ((string) Env::get($clave, '') === '') {
                $faltantes++;
            }
        }
        $secretoDebil = strlen((string) Env::get('JWT_SECRET', '')) < 32;

        return [
            'estado'    => ($faltantes > 0 || $secretoDebil) ? 'caido' : 'operativo',
            'faltantes' => $faltantes,
        ];
    }
}
