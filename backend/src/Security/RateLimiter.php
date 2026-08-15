<?php

declare(strict_types=1);

namespace App\Security;

use App\Exceptions\ApiException;

/**
 * Límite de tasa GLOBAL por IP, aplicado a toda la API antes del enrutamiento.
 *
 * Complementa (no reemplaza) los guards existentes ({@see BruteForceGuard},
 * {@see OtpGuard}, {@see PublicEndpointGuard}), que siguen protegiendo login,
 * OTP, donaciones y PQR con sus propias reglas más estrictas. Este límite es
 * la última línea de defensa contra el bombardeo genérico de CUALQUIER
 * endpoint (incluidos los autenticados: Data Gateway, usuarios, etc.) que
 * hoy no tenían ningún freno.
 *
 * Diseño pensado para no repetir los errores que el video/la auditoría piden
 * evitar:
 *  - Sin consulta a Supabase/SQL por request (evita 1 query extra en cada
 *    petición, que sí tienen los guards existentes vía `login_attempts`).
 *  - Usa APCu si está disponible (memoria compartida in-process, la opción
 *    más rápida en un servidor PHP-FPM/Apache mod_php de una sola máquina);
 *    si APCu no está cargado, cae a un archivo JSON por IP con `flock` — sigue
 *    siendo una operación de E/S local, no de red.
 *  - Ventana fija de 60s por IP (contador + timestamp de inicio de ventana):
 *    O(1) por petición, sin escanear ni recorrer históricos.
 */
final class RateLimiter
{
    private const LIMITE            = 60;
    private const VENTANA_SEGUNDOS  = 60;
    private const APCU_PREFIX       = 'ratelimit:';

    /**
     * Verifica el límite para la IP dada y cuenta la petición actual.
     *
     * Fail-open ante cualquier error de E/S (no debe tumbar la API por un
     * problema de disco/permmisos): si el almacén falla, se deja pasar la
     * petición y no se interrumpe el servicio.
     *
     * @throws ApiException 429 si la IP superó el límite en la ventana actual.
     */
    public static function assertAllowed(string $ip): void
    {
        $ip = $ip !== '' ? $ip : 'desconocida';

        try {
            $conteo = extension_loaded('apcu') && apcu_enabled()
                ? self::contarConApcu($ip)
                : self::contarConArchivo($ip);
        } catch (\Throwable) {
            return;
        }

        if ($conteo > self::LIMITE) {
            header('Retry-After: ' . self::VENTANA_SEGUNDOS);
            throw new ApiException(
                'Demasiadas solicitudes. Inténtalo de nuevo en un minuto.',
                429
            );
        }
    }

    private static function contarConApcu(string $ip): int
    {
        $key = self::APCU_PREFIX . $ip;

        $conteo = apcu_inc($key);
        if ($conteo === false) {
            apcu_add($key, 1, self::VENTANA_SEGUNDOS);
            $conteo = 1;
        }

        return (int) $conteo;
    }

    private static function contarConArchivo(string $ip): int
    {
        $dir = sys_get_temp_dir() . '/defbsp_ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }

        $archivo = $dir . '/' . hash('crc32b', $ip) . '.json';
        $handle  = @fopen($archivo, 'c+');
        if ($handle === false) {
            return 1;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return 1;
            }

            $contenido = stream_get_contents($handle);
            $data      = $contenido !== false && $contenido !== '' ? json_decode($contenido, true) : null;

            $ahora = time();
            if (!is_array($data) || !isset($data['inicio'], $data['conteo']) || ($ahora - (int) $data['inicio']) >= self::VENTANA_SEGUNDOS) {
                $data = ['inicio' => $ahora, 'conteo' => 0];
            }

            $data['conteo']++;

            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($data));
            fflush($handle);

            // Limpieza oportunista y barata (1/500 peticiones) de archivos
            // huérfanos viejos, para no acumular indefinidamente entradas de
            // IPs que ya no vuelven a pedir nada.
            if (random_int(1, 500) === 1) {
                self::limpiarViejos($dir);
            }

            return (int) $data['conteo'];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private static function limpiarViejos(string $dir): void
    {
        $limite = time() - (self::VENTANA_SEGUNDOS * 5);
        foreach (glob($dir . '/*.json') ?: [] as $archivo) {
            if (@filemtime($archivo) < $limite) {
                @unlink($archivo);
            }
        }
    }
}
