<?php

declare(strict_types=1);

namespace App\DataGateway;

/**
 * Almacén en memoria compartida (APCu): lo ven todos los procesos de Apache
 * del contenedor y no genera E/S de red ni de disco.
 */
final class ApcuCacheBackend implements CacheBackend
{
    /** True si APCu está cargado y habilitado en este proceso. */
    public static function disponible(): bool
    {
        return extension_loaded('apcu') && apcu_enabled();
    }

    public function get(string $key): mixed
    {
        $valor = apcu_fetch($key, $encontrado);

        return $encontrado ? $valor : null;
    }

    public function set(string $key, mixed $value, int $ttlSegundos): void
    {
        apcu_store($key, $value, $ttlSegundos);
    }
}
