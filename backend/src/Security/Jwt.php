<?php

declare(strict_types=1);

namespace App\Security;

use App\Config\Env;
use App\Exceptions\ApiException;
use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;
use Throwable;

/**
 * Emisión y verificación de JWT propios de la aplicación (HS256).
 *
 * El backend NO reutiliza directamente el JWT de Supabase para proteger sus
 * endpoints: emite su propio token con un TTL estricto (máximo 5 minutos,
 * `JWT_TTL`), lo que garantiza control total sobre la expiración exigida.
 *
 * @package App\Security
 */
final class Jwt
{
    /** Algoritmo de firma. */
    private const ALGO = 'HS256';

    /** Tope de seguridad: el TTL nunca excede 5 minutos (300 s). */
    private const MAX_TTL = 300;

    /** TTL de los tokens de recuperación de contraseña (10 minutos). */
    private const RESET_TTL = 600;

    /**
     * Emite un token efímero para el flujo de recuperación de contraseña.
     *
     * No transporta datos sensibles: solo el sujeto, el tipo de token y un
     * identificador único (`jti`) que enlaza con el registro de `password_resets`.
     *
     * @param string               $userId Id del usuario (o '0' para señuelo).
     * @param string               $jti    Identificador único (id de fila/señuelo).
     * @param string               $typ    'pwd_reset_otp' o 'pwd_reset_verified'.
     * @param array<string,mixed>  $extra  Claims adicionales no sensibles (p. ej. el salt).
     */
    public static function issueReset(string $userId, string $jti, string $typ, array $extra = []): string
    {
        $now = time();
        return FirebaseJwt::encode($extra + [
            'iss' => Env::get('JWT_ISSUER', 'bsp'),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + self::RESET_TTL,
            'sub' => $userId,
            'typ' => $typ,
            'jti' => $jti,
        ], self::secret(), self::ALGO);
    }

    /**
     * Verifica un token de recuperación y comprueba que su `typ` sea esperado.
     *
     * @param string[] $allowedTypes Tipos aceptados para esta operación.
     * @return array<string,mixed> Claims del token.
     * @throws ApiException 400 si es inválido, expiró o el tipo no corresponde.
     */
    public static function verifyReset(string $token, array $allowedTypes): array
    {
        try {
            $claims = (array) FirebaseJwt::decode($token, new Key(self::secret(), self::ALGO));
        } catch (Throwable) {
            throw new ApiException('La solicitud expiró o no es válida. Empieza de nuevo.', 400);
        }
        if (!in_array((string) ($claims['typ'] ?? ''), $allowedTypes, true)) {
            throw new ApiException('Token de recuperación no válido.', 400);
        }
        return $claims;
    }

    /**
     * Emite un token de acceso.
     *
     * @param array{id:string,rol:?string,correo:?string} $user Datos del sujeto.
     * @return array{access_token:string,token_type:string,expires_in:int}
     */
    public static function issue(array $user): array
    {
        $now = time();
        $ttl = min(Env::int('JWT_TTL', self::MAX_TTL), self::MAX_TTL);

        $payload = [
            'iss'    => Env::get('JWT_ISSUER', 'bsp'),
            'iat'    => $now,
            'nbf'    => $now,
            'exp'    => $now + $ttl,
            'sub'    => $user['id'],
            'rol'    => $user['rol'] ?? null,
            'correo' => $user['correo'] ?? null,
        ];

        return [
            'access_token' => FirebaseJwt::encode($payload, self::secret(), self::ALGO),
            'token_type'   => 'Bearer',
            'expires_in'   => $ttl,
        ];
    }

    /**
     * Verifica un token y devuelve sus claims.
     *
     * @return array<string,mixed>
     * @throws ApiException 401 si es inválido o expiró.
     */
    public static function verify(string $token): array
    {
        try {
            return (array) FirebaseJwt::decode($token, new Key(self::secret(), self::ALGO));
        } catch (Throwable) {
            throw ApiException::unauthorized('Token inválido o expirado.');
        }
    }

    /**
     * Devuelve el secreto de firma, exigiendo una longitud mínima segura.
     *
     * @throws ApiException 500 si el secreto no está configurado correctamente.
     */
    private static function secret(): string
    {
        $secret = (string) Env::get('JWT_SECRET', '');
        if (strlen($secret) < 32) {
            throw new ApiException('Configuración de seguridad incompleta.', 500);
        }
        return $secret;
    }
}
