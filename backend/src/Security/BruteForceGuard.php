<?php

declare(strict_types=1);

namespace App\Security;

use App\Config\Env;
use App\Exceptions\ApiException;
use App\Repositories\LoginAttemptRepository;
use App\Support\Logger;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Protección contra ataques de fuerza bruta en el inicio de sesión.
 *
 * Regla de negocio:
 *  - Tras `MAX_LOGIN_ATTEMPTS` (por defecto 3) intentos fallidos consecutivos,
 *    la cuenta se bloquea durante `LOCKOUT_MINUTES` (por defecto 15) minutos.
 *  - Mientras dure el bloqueo, cualquier intento se rechaza con HTTP 423.
 *  - Un inicio de sesión correcto reinicia el contador.
 *
 * El estado se persiste en Supabase mediante {@see LoginAttemptRepository}.
 *
 * @package App\Security
 */
final class BruteForceGuard
{
    private readonly LoginAttemptRepository $repo;
    private readonly Logger $logger;
    private readonly int $maxAttempts;
    private readonly int $lockoutMinutes;

    public function __construct(?LoginAttemptRepository $repo = null, ?Logger $logger = null)
    {
        $this->repo           = $repo ?? new LoginAttemptRepository();
        $this->logger         = $logger ?? new Logger();
        $this->maxAttempts    = max(1, Env::int('MAX_LOGIN_ATTEMPTS', 3));
        $this->lockoutMinutes = max(1, Env::int('LOCKOUT_MINUTES', 15));
    }

    /**
     * Verifica que la cuenta no esté bloqueada antes de validar credenciales.
     *
     * @throws ApiException 423 con los minutos restantes si está bloqueada.
     */
    public function assertNotLocked(string $email): void
    {
        try {
            $record = $this->repo->find($email);
        } catch (ApiException $e) {
            // Si el almacén de intentos no está disponible (tabla/clave ausente),
            // se registra y NO se bloquea el login legítimo (fail-open en storage).
            $this->logger->critical('Control de fuerza bruta no disponible (fail-open)', ['error' => $e->getMessage()]);
            return;
        }

        if ($record === null || empty($record['bloqueado_hasta'])) {
            return;
        }

        $now   = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $until = new DateTimeImmutable((string) $record['bloqueado_hasta']);

        if ($until > $now) {
            $minutos = (int) ceil(($until->getTimestamp() - $now->getTimestamp()) / 60);
            throw ApiException::locked(
                "Cuenta bloqueada por demasiados intentos. Inténtalo de nuevo en {$minutos} minuto(s)."
            );
        }
    }

    /**
     * Registra un intento fallido y bloquea la cuenta si se supera el límite.
     */
    public function registerFailure(string $email): void
    {
        try {
            $record   = $this->repo->find($email);
            $intentos = (int) ($record['intentos'] ?? 0) + 1;

            if ($intentos >= $this->maxAttempts) {
                $until = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
                    ->modify("+{$this->lockoutMinutes} minutes")
                    ->format('Y-m-d\TH:i:s\Z');

                $this->repo->save($email, $intentos, $until);
                $this->logger->warning('Cuenta bloqueada por fuerza bruta', [
                    'email'    => $email,
                    'intentos' => $intentos,
                    'hasta'    => $until,
                ]);
                return;
            }

            $this->repo->save($email, $intentos, null);
        } catch (ApiException $e) {
            $this->logger->error('No se pudo registrar el intento fallido', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Reinicia el contador tras un inicio de sesión correcto.
     */
    public function reset(string $email): void
    {
        try {
            $this->repo->reset($email);
        } catch (ApiException $e) {
            $this->logger->error('No se pudo reiniciar intentos', ['error' => $e->getMessage()]);
        }
    }
}
