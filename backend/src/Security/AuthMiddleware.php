<?php

declare(strict_types=1);

namespace App\Security;

use App\Exceptions\ApiException;
use App\Http\Request;

/**
 * Middleware de autenticación y autorización por rol.
 *
 * Verifica el JWT propio en endpoints protegidos y, opcionalmente, exige que el
 * usuario tenga uno de los roles permitidos.
 *
 * @package App\Security
 */
final class AuthMiddleware
{
    /**
     * Exige un JWT válido y devuelve sus claims.
     *
     * @return array<string,mixed>
     * @throws ApiException 401 si falta o es inválido.
     */
    public static function authenticate(Request $request): array
    {
        $token = $request->bearerToken();
        if ($token === null) {
            throw ApiException::unauthorized('Token de acceso ausente.');
        }
        return Jwt::verify($token);
    }

    /**
     * Exige autenticación y pertenencia a uno de los roles indicados.
     *
     * @param string[] $roles Roles permitidos.
     * @return array<string,mixed> Claims del token.
     * @throws ApiException 403 si el rol no está autorizado.
     */
    public static function authorize(Request $request, array $roles): array
    {
        $claims = self::authenticate($request);
        $rol    = (string) ($claims['rol'] ?? '');
        if (!in_array($rol, $roles, true)) {
            throw ApiException::forbidden('No tienes permisos para esta acción.');
        }
        return $claims;
    }
}
