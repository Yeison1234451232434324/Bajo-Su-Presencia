<?php

declare(strict_types=1);

namespace App\Security;

use App\Exceptions\ApiException;
use App\Repositories\LoginAttemptRepository;
use App\Support\Logger;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Protección contra fuerza bruta sobre el código OTP de recuperación.
 *
 * Reutiliza la tabla genérica `login_attempts` (email · intentos ·
 * bloqueado_hasta) usando como clave `otp:<jti>`, de modo que el contador vive
 * ligado a cada solicitud de recuperación y no al correo del usuario (lo que
 * además evita filtrar la existencia de la cuenta).
 *
 * Regla: tras 5 códigos incorrectos, la solicitud se bloquea 15 minutos.
 *
 * @package App\Security
 */
final class OtpGuard
{
    private const MAX_ATTEMPTS    = 5;
    private const LOCKOUT_MINUTES = 15;

    private readonly LoginAttemptRepository $repo;
    private readonly Logger $logger;

    public function __construct(?LoginAttemptRepository $repo = null, ?Logger $logger = null)
    {
        $this->repo   = $repo ?? new LoginAttemptRepository();
        $this->logger = $logger ?? new Logger();
    }

    /** Clave de almacenamiento del contador para un `jti` dado. */
    private function key(string $jti): string
    {
        return 'otp:' . $jti;
    }

    /**
     * Rechaza la validación si la solicitud está bloqueada.
     *
     * @throws ApiException 423 con los minutos restantes.
     */
    public function assertNotLocked(string $jti): void
    {
        try {
            $record = $this->repo->find($this->key($jti));
        } catch (ApiException $e) {
            $this->logger->critical('Control de intentos OTP no disponible (fail-open)', ['error' => $e->getMessage()]);
            return; // fail-open en almacenamiento, igual que el guard de login
        }

        if ($record === null || empty($record['bloqueado_hasta'])) {
            return;
        }

        $now   = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $until = new DateTimeImmutable((string) $record['bloqueado_hasta']);
        if ($until > $now) {
            $min = (int) ceil(($until->getTimestamp() - $now->getTimestamp()) / 60);
            throw ApiException::locked(
                "Demasiados intentos. Solicita un código nuevo en {$min} minuto(s)."
            );
        }
    }

    /** Registra un intento fallido y bloquea al superar el límite. */
    public function registerFailure(string $jti): void
    {
        try {
            $record   = $this->repo->find($this->key($jti));
            $intentos = (int) ($record['intentos'] ?? 0) + 1;

            $until = null;
            if ($intentos >= self::MAX_ATTEMPTS) {
                $until = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
                    ->modify('+' . self::LOCKOUT_MINUTES . ' minutes')
                    ->format('Y-m-d\TH:i:s\Z');
                $this->logger->warning('OTP bloqueado por intentos', ['jti' => $jti, 'intentos' => $intentos]);
            }
            $this->repo->save($this->key($jti), $intentos, $until);
        } catch (ApiException $e) {
            $this->logger->error('No se pudo registrar intento de OTP', ['error' => $e->getMessage()]);
        }
    }

    /** Reinicia el contador (al emitir un código nuevo o validar con éxito). */
    public function reset(string $jti): void
    {
        try {
            $this->repo->reset($this->key($jti));
        } catch (ApiException $e) {
            $this->logger->error('No se pudo reiniciar intentos de OTP', ['error' => $e->getMessage()]);
        }
    }
}
