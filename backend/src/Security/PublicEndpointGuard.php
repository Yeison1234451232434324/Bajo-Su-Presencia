<?php

declare(strict_types=1);

namespace App\Security;

use App\Exceptions\ApiException;
use App\Repositories\LoginAttemptRepository;
use App\Support\Logger;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Límite de tasa genérico para endpoints PÚBLICOS (sin autenticación) que
 * disparan un efecto costoso o abusable por terceros (envío de correo,
 * escritura en BD) — p. ej. `/api/pqr` y `/api/donaciones`.
 *
 * Sin este límite, cualquiera puede llamar el endpoint en bucle usando el
 * correo de UN TERCERO como destinatario ("email bombing": la víctima recibe
 * decenas de confirmaciones/comprobantes que nunca solicitó) o saturar el
 * buzón/whitelist del proveedor SMTP.
 *
 * Reutiliza la tabla `login_attempts` (mismo patrón que {@see BruteForceGuard}
 * y {@see OtpGuard}), con una clave con prefijo por "bucket" para no chocar
 * con los contadores de login/OTP. Es una ventana deslizante simple: se
 * cuentan los intentos desde `actualizado_en`; si ya pasó la ventana, el
 * contador se reinicia.
 *
 * @package App\Security
 */
final class PublicEndpointGuard
{
    private readonly LoginAttemptRepository $repo;
    private readonly Logger $logger;

    public function __construct(?LoginAttemptRepository $repo = null, ?Logger $logger = null)
    {
        $this->repo   = $repo ?? new LoginAttemptRepository();
        $this->logger = $logger ?? new Logger();
    }

    /**
     * Verifica que la IP no haya superado el máximo de solicitudes en la
     * ventana indicada para este `bucket`, y registra la solicitud actual.
     *
     * Si el almacén en Supabase falla, NO se abre la puerta sin más: el envío
     * de correo (SMTP) y el resto de efectos de estos endpoints (donaciones,
     * PQR) son independientes de Supabase, así que un fallo puntual de la
     * tabla `login_attempts` no impide que se pueda seguir abusando del
     * endpoint (email bombing) — se confirmó en pruebas: sin este respaldo,
     * una caída de Supabase permitía superar el límite de 5/15min sin freno
     * alguno. Por eso se aplica aquí, como red de emergencia, el mismo límite
     * pero contado localmente (archivo + flock, igual que {@see RateLimiter}),
     * sin tocar Supabase ni el límite global de IP.
     *
     * @throws ApiException 429 si se superó el límite (por Supabase o local).
     */
    public function assertAllowed(string $bucket, string $ip, int $maxPorVentana, int $ventanaMinutos): void
    {
        $key = $bucket . ':' . ($ip !== '' ? $ip : 'desconocida');

        try {
            $record = $this->repo->find($key);
            $now    = new DateTimeImmutable('now', new DateTimeZone('UTC'));

            $dentroDeVentana = false;
            if ($record !== null && !empty($record['actualizado_en'])) {
                $actualizado = new DateTimeImmutable((string) $record['actualizado_en']);
                $dentroDeVentana = $actualizado->modify("+{$ventanaMinutos} minutes") > $now;
            }

            $intentos = $dentroDeVentana ? ((int) ($record['intentos'] ?? 0) + 1) : 1;

            if ($intentos > $maxPorVentana) {
                $this->logger->warning('Límite de solicitudes públicas excedido', [
                    'bucket' => $bucket, 'ip' => $ip, 'intentos' => $intentos,
                ]);
                throw ApiException::locked('Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.');
            }

            $this->repo->save($key, $intentos, null);
        } catch (ApiException $e) {
            if ($e->httpStatus() === 423) {
                throw $e;
            }
            $this->logger->critical('Límite de solicitudes públicas no disponible; usando respaldo local', ['error' => $e->getMessage()]);
            self::assertAllowedLocal($key, $maxPorVentana, $ventanaMinutos);
        }
    }

    /**
     * Respaldo local (sin Supabase) para cuando el almacén remoto falla.
     *
     * Mismo mecanismo de archivo + `flock` ya validado en {@see RateLimiter},
     * pero con clave/límite/ventana propios de cada `bucket`, en vez de
     * reutilizar directamente `RateLimiter::assertAllowed()` (que es fijo a
     * 60/60s por IP y ya se aplicó una vez, antes del enrutamiento, a esta
     * misma petición — llamarlo de nuevo aquí no aportaría el límite más
     * estricto que estos endpoints necesitan).
     */
    private static function assertAllowedLocal(string $key, int $maxPorVentana, int $ventanaMinutos): void
    {
        try {
            $dir = sys_get_temp_dir() . '/defbsp_ratelimit_fallback';
            if (!is_dir($dir)) {
                @mkdir($dir, 0700, true);
            }

            $archivo = $dir . '/' . hash('crc32b', $key) . '.json';
            $handle  = @fopen($archivo, 'c+');
            if ($handle === false) {
                return;
            }

            try {
                if (!flock($handle, LOCK_EX)) {
                    return;
                }

                $contenido = stream_get_contents($handle);
                $data      = $contenido !== false && $contenido !== '' ? json_decode($contenido, true) : null;

                $ahora         = time();
                $ventanaSegundos = $ventanaMinutos * 60;
                if (!is_array($data) || !isset($data['inicio'], $data['conteo']) || ($ahora - (int) $data['inicio']) >= $ventanaSegundos) {
                    $data = ['inicio' => $ahora, 'conteo' => 0];
                }

                $data['conteo']++;

                $json = json_encode($data);
                if ($json === false) {
                    return;
                }

                ftruncate($handle, 0);
                rewind($handle);
                fwrite($handle, $json);
                fflush($handle);

                if ((int) $data['conteo'] > $maxPorVentana) {
                    throw ApiException::locked('Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.');
                }
            } finally {
                flock($handle, LOCK_UN);
                fclose($handle);
            }
        } catch (ApiException $e) {
            throw $e;
        } catch (\Throwable) {
            // Fail-open solo ante un fallo del propio respaldo local (disco
            // lleno, permisos, etc.) — no se deja la petición sin ningún
            // control por un problema de E/S imprevisto.
        }
    }
}
