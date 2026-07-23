<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Exceptions\ApiException;
use App\Supabase\SupabaseClient;

/**
 * Persistencia de solicitudes de recuperación de contraseña (password_resets).
 *
 * El secreto (OTP) NUNCA se guarda en claro: en `token_hash` se almacena su
 * hash sha256. El `id` de la fila actúa como `jti` que se embebe en el JWT de
 * recuperación, enlazando ambos sin necesidad de guardar el JWT completo.
 *
 * @package App\Repositories
 */
final class PasswordResetRepository
{
    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /** Invalida (marca como usados) los tokens activos previos del usuario. */
    public function invalidatePrevious(string $usuarioId): void
    {
        $this->sb->rest(
            'PATCH',
            'password_resets',
            'usuario_id=eq.' . $usuarioId . '&usado=eq.false',
            ['usado' => true]
        );
    }

    /** Crea un nuevo token (hasheado) con su expiración. */
    public function create(string $usuarioId, string $tokenHash, string $expiraEnIso): void
    {
        $this->sb->rest(
            'POST',
            'password_resets',
            '',
            ['usuario_id' => $usuarioId, 'token_hash' => $tokenHash, 'expira_en' => $expiraEnIso, 'usado' => false]
        );
    }

    /**
     * Devuelve un token válido (no usado y no expirado) por su hash, o null.
     *
     * @return array<string,mixed>|null
     */
    public function findValid(string $tokenHash): ?array
    {
        $nowIso = gmdate('Y-m-d\TH:i:s\Z');
        [$status, $data] = $this->sb->rest(
            'GET',
            'password_resets',
            'select=id,usuario_id&token_hash=eq.' . $tokenHash . '&usado=eq.false&expira_en=gt.' . $nowIso . '&limit=1'
        );
        return ($status < 400 && is_array($data) && isset($data[0])) ? $data[0] : null;
    }

    /** Marca un token como usado (consumo tras el cambio de contraseña). */
    public function consume(string $id): void
    {
        $this->sb->rest('PATCH', 'password_resets', 'id=eq.' . $id, ['usado' => true]);
    }

    /**
     * Crea una solicitud OTP (hash del código) y devuelve su `id` (= `jti`).
     *
     * @throws ApiException 500 si la fila no se pudo crear.
     */
    public function createOtp(string $usuarioId, string $otpHash, string $expiraEnIso): string
    {
        [$status, $data] = $this->sb->rest(
            'POST',
            'password_resets',
            '',
            ['usuario_id' => $usuarioId, 'token_hash' => $otpHash, 'expira_en' => $expiraEnIso, 'usado' => false],
            ['return=representation']
        );
        if ($status >= 400 || !isset($data[0]['id'])) {
            throw new ApiException('No se pudo iniciar la recuperación.', 500);
        }
        return (string) $data[0]['id'];
    }

    /**
     * Devuelve una solicitud activa (no usada, no expirada) por su `jti`, o null.
     *
     * @return array<string,mixed>|null
     */
    public function findActiveByJti(string $jti): ?array
    {
        // Evita que un `jti` con caracteres extraños rompa la query (defensa SQLi/PostgREST).
        if (!preg_match('/^[0-9a-fA-F-]{36}$/', $jti)) {
            return null;
        }
        $nowIso = gmdate('Y-m-d\TH:i:s\Z');
        [$status, $data] = $this->sb->rest(
            'GET',
            'password_resets',
            'select=id,usuario_id,token_hash&id=eq.' . $jti . '&usado=eq.false&expira_en=gt.' . $nowIso . '&limit=1'
        );
        return ($status < 400 && is_array($data) && isset($data[0])) ? $data[0] : null;
    }
}
