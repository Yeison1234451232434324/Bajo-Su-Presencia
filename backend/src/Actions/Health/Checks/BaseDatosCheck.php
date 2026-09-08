<?php

declare(strict_types=1);

namespace App\Actions\Health\Checks;

use App\Supabase\SupabaseClient;
use App\Support\Logger;
use Throwable;

/**
 * Verifica la conectividad con la base de datos mediante una consulta mínima
 * (un registro de la tabla de roles, la más pequeña del esquema).
 *
 * Una clase por comprobación (antes uno de los métodos privados de
 * `App\Controllers\HealthController::ready()`).
 *
 * @package App\Actions\Health\Checks
 */
final class BaseDatosCheck
{
    /** Umbral en milisegundos a partir del cual la dependencia se considera degradada. */
    private const UMBRAL_LENTITUD_MS = 2000;

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /** @return array{estado:string,latencia_ms:int} */
    public function handle(): array
    {
        $inicio = microtime(true);
        try {
            [$status] = $this->sb->rest('GET', 'roles', 'select=id&limit=1');
            $ms = (int) round((microtime(true) - $inicio) * 1000);

            if ($status >= 400) {
                return ['estado' => 'caido', 'latencia_ms' => $ms];
            }
            return [
                'estado'      => $ms > self::UMBRAL_LENTITUD_MS ? 'degradado' : 'operativo',
                'latencia_ms' => $ms,
            ];
        } catch (Throwable $e) {
            // El detalle va al log; al cliente solo el estado.
            (new Logger())->error('Health: fallo de base de datos', ['error' => $e->getMessage()]);
            return ['estado' => 'caido', 'latencia_ms' => (int) round((microtime(true) - $inicio) * 1000)];
        }
    }
}
