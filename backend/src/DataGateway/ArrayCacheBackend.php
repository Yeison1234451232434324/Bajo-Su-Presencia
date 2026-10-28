<?php

declare(strict_types=1);

namespace App\DataGateway;

/**
 * Almacén en memoria del proceso, con reloj inyectable. Pensado para pruebas.
 */
final class ArrayCacheBackend implements CacheBackend
{
    /** @var array<string,array{0:mixed,1:int}> valor y momento de caducidad (0 = nunca) */
    private array $datos = [];

    private int $ahora = 0;

    /** Adelanta el reloj simulado. */
    public function avanzar(int $segundos): void
    {
        $this->ahora += $segundos;
    }

    public function get(string $key): mixed
    {
        if (!isset($this->datos[$key])) {
            return null;
        }
        [$valor, $caduca] = $this->datos[$key];
        if ($caduca !== 0 && $caduca <= $this->ahora) {
            unset($this->datos[$key]);

            return null;
        }

        return $valor;
    }

    public function set(string $key, mixed $value, int $ttlSegundos): void
    {
        $this->datos[$key] = [$value, $ttlSegundos === 0 ? 0 : $this->ahora + $ttlSegundos];
    }
}
