<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Resuelve la IP real del visitante cuando la app corre detrás de un proxy.
 *
 * En Render, `REMOTE_ADDR` es siempre la dirección del proxy interno (`::1`),
 * de modo que usarla tal cual hace que TODOS los visitantes compartan el mismo
 * contador de límite de tasa y de intentos fallidos. La IP verdadera llega en
 * `CF-Connecting-IP`, que Cloudflare siempre sobrescribe: un cliente no puede
 * falsificarla pasando por la red de Cloudflare.
 *
 * Regla de confianza: la cabecera solo se acepta si la conexión directa viene
 * de loopback o de una red privada (es decir, del proxy de la plataforma). Si
 * `REMOTE_ADDR` es una IP pública, la petición llegó sin proxy y cualquier
 * cabecera sería falsificable, así que se ignora.
 */
final class ClientIp
{
    /**
     * @param array<string, mixed> $server Normalmente `$_SERVER`.
     */
    public static function resolve(array $server): string
    {
        $remota = is_string($server['REMOTE_ADDR'] ?? null) ? $server['REMOTE_ADDR'] : '';

        if ($remota !== '' && self::esProxyInterno($remota)) {
            $cabecera = $server['HTTP_CF_CONNECTING_IP'] ?? null;
            if (is_string($cabecera) && filter_var(trim($cabecera), FILTER_VALIDATE_IP) !== false) {
                return trim($cabecera);
            }
        }

        return $remota;
    }

    /** True si la IP es loopback o de una red privada/reservada. */
    private static function esProxyInterno(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return false;
        }

        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) === false;
    }
}
