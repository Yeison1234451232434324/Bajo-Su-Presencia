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
     * Fail-open ante fallos del almacén (no bloquea el uso legítimo si la
     * tabla de intentos no está disponible), igual que el resto de guards.
     *
     * @throws ApiException 429 si se superó el límite.
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
            $this->logger->critical('Límite de solicitudes públicas no disponible (fail-open)', ['error' => $e->getMessage()]);
        }
    }
}
