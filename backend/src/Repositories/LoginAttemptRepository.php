<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Supabase\SupabaseClient;

/**
 * Persistencia de los intentos de inicio de sesión y bloqueos.
 *
 * Respaldado por la tabla `login_attempts` de Supabase (ver `sql/`), a la que
 * solo accede el backend con la `service_role key`. Estructura:
 *   email (PK) · intentos · bloqueado_hasta · actualizado_en
 *
 * @package App\Repositories
 */
final class LoginAttemptRepository
{
    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * Devuelve el registro de intentos de un correo, o `null` si no existe.
     *
     * @return array<string,mixed>|null
     */
    public function find(string $email): ?array
    {
        $rows = $this->sb->select(
            'login_attempts',
            ['email' => 'eq.' . $email, 'limit' => '1']
        );
        return $rows[0] ?? null;
    }

    /**
     * Crea o actualiza (upsert) el registro de intentos de un correo.
     *
     * @param int         $intentos       Número de intentos fallidos acumulados.
     * @param string|null $bloqueadoHasta Marca temporal ISO-8601 del fin del
     *                                     bloqueo, o `null` si no está bloqueado.
     */
    public function save(string $email, int $intentos, ?string $bloqueadoHasta): void
    {
        $this->sb->insert(
            'login_attempts',
            [
                'email'           => $email,
                'intentos'        => $intentos,
                'bloqueado_hasta' => $bloqueadoHasta,
                'actualizado_en'  => gmdate('Y-m-d\TH:i:s\Z'),
            ],
            'email' // upsert por la PK
        );
    }

    /**
     * Limpia los intentos tras un inicio de sesión correcto.
     */
    public function reset(string $email): void
    {
        $this->save($email, 0, null);
    }
}
