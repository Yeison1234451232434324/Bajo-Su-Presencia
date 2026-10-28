<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Config\Env;

/**
 * Caché de corta duración para las lecturas PÚBLICAS del Data Gateway.
 *
 * Las tablas con `public_read` (eventos, noticias, oraciones, sedes) devuelven
 * lo mismo a cualquier visitante y se leen en cada visita al sitio, así que
 * cada petición golpeaba Supabase. Con 25–50 usuarios simultáneos eso hacía
 * subir la mediana de 0,2 s a 3 s. Aquí se guarda la respuesta unos segundos.
 *
 * Reglas que mantienen la corrección:
 *  - Solo se guardan GET públicos con éxito: nunca lecturas autenticadas
 *    (dependen del rol) ni errores.
 *  - La clave incluye tabla y query string completa: otra consulta, otra clave.
 *  - Cualquier escritura exitosa por el gateway invalida TODA la caché (sube
 *    una versión que forma parte de la clave): quien guarda un evento lo ve
 *    en el listado de inmediato. Las escrituras por otras vías (p. ej. alta de
 *    usuarios) como máximo tardan en reflejarse el TTL.
 *  - Sin APCu (p. ej. XAMPP local) o con TTL 0 queda desactivada y todo
 *    funciona como antes.
 */
final class PublicReadCache
{
    private const TTL_POR_DEFECTO = 60;
    private const CLAVE_VERSION = 'gwcache:version';

    private readonly ?CacheBackend $backend;
    private readonly int $ttl;

    /**
     * @param CacheBackend|null $backend Si es null se usa APCu cuando está disponible.
     * @param int|null          $ttl     Segundos; null lee PUBLIC_CACHE_TTL (60 por defecto), 0 desactiva.
     */
    public function __construct(?CacheBackend $backend = null, ?int $ttl = null)
    {
        $this->ttl = max(0, $ttl ?? Env::int('PUBLIC_CACHE_TTL', self::TTL_POR_DEFECTO));
        $this->backend = $backend ?? (ApcuCacheBackend::disponible() ? new ApcuCacheBackend() : null);
    }

    /** True si hay almacén y el TTL es mayor que cero. */
    public function activa(): bool
    {
        return $this->backend !== null && $this->ttl > 0;
    }

    /**
     * Respuesta guardada para esa consulta, o null si no hay (o caducó).
     *
     * @return array<mixed>|null
     */
    public function obtener(string $tabla, string $queryString): ?array
    {
        if (!$this->activa()) {
            return null;
        }
        $valor = $this->backend?->get($this->clave($tabla, $queryString));

        return is_array($valor) ? $valor : null;
    }

    /**
     * Guarda la respuesta de una lectura pública exitosa.
     *
     * @param array<mixed> $datos
     */
    public function guardar(string $tabla, string $queryString, array $datos): void
    {
        if ($this->activa()) {
            $this->backend?->set($this->clave($tabla, $queryString), $datos, $this->ttl);
        }
    }

    /** Invalida todo lo guardado (se llama tras cualquier escritura exitosa). */
    public function invalidar(): void
    {
        if ($this->activa()) {
            $this->backend?->set(self::CLAVE_VERSION, $this->version() + 1, 0);
        }
    }

    private function version(): int
    {
        $v = $this->backend?->get(self::CLAVE_VERSION);

        return is_int($v) ? $v : 1;
    }

    private function clave(string $tabla, string $queryString): string
    {
        return 'gwcache:' . $this->version() . ':' . $tabla . ':' . hash('sha256', $queryString);
    }
}
