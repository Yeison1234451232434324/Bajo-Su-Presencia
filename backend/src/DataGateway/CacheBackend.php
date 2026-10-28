<?php

declare(strict_types=1);

namespace App\DataGateway;

/**
 * Almacén clave-valor con caducidad que usa {@see PublicReadCache}.
 *
 * Existe para poder sustituir APCu por un almacén en memoria en las pruebas y
 * para que la caché pueda desactivarse sin tocar el controlador.
 */
interface CacheBackend
{
    /** Valor guardado, o null si no existe o caducó. */
    public function get(string $key): mixed;

    /** Guarda un valor; `$ttlSegundos` 0 significa sin caducidad. */
    public function set(string $key, mixed $value, int $ttlSegundos): void;
}
