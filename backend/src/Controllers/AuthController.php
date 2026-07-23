<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Security\Sanitizer;
use App\Services\AuthService;

/**
 * Controlador de autenticación.
 *
 * Capa delgada: valida/sanitiza la entrada HTTP y delega la lógica en
 * {@see AuthService}. No contiene reglas de negocio.
 *
 * @package App\Controllers
 */
final class AuthController
{
    private readonly AuthService $auth;

    public function __construct(?AuthService $auth = null)
    {
        $this->auth = $auth ?? new AuthService();
    }

    /**
     * POST /api/auth/login — inicia sesión y devuelve el JWT.
     *
     * Acepta como identificador el **correo** o el **nombre de usuario**
     * (campos `correo` y/o `usuario`). Si llega un usuario, se resuelve su
     * correo desde la tabla `usuarios` antes de validar en Supabase Auth.
     *
     * @param array<string,string> $args Parámetros de ruta (no usados).
     */
    public function login(Request $request, array $args): void
    {
        $correo   = Sanitizer::email($request->input('correo'));
        $usuario  = trim((string) $request->input('usuario', ''));
        $password = (string) $request->input('contrasena', '');

        // Se exigen los tres campos.
        $errors = [];
        if ($usuario === '') {
            $errors['usuario'] = 'El nombre de usuario es obligatorio.';
        }
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            $errors['correo'] = 'Correo electrónico inválido.';
        }
        if (strlen($password) < 6) {
            $errors['contrasena'] = 'La contraseña es obligatoria (mínimo 6 caracteres).';
        }
        if ($errors !== []) {
            throw ApiException::validation($errors);
        }

        // El correo y la contraseña se validan en Supabase Auth; además el
        // nombre de usuario debe coincidir con el de la cuenta de ese correo.
        $result = $this->auth->login($correo, $password, $usuario);
        Response::success($result, 'Sesión iniciada.');
    }

    /**
     * POST /api/auth/refresh — renueva el JWT con el refresh token de Supabase.
     *
     * @param array<string,string> $args
     */
    public function refresh(Request $request, array $args): void
    {
        $refreshToken = (string) $request->input('refresh_token', '');
        if ($refreshToken === '') {
            throw ApiException::validation(['refresh_token' => 'Es obligatorio.']);
        }

        $result = $this->auth->refresh($refreshToken);
        Response::success($result, 'Sesión renovada.');
    }

    /**
     * POST /api/auth/password/forgot — Paso 1: solicita el código OTP.
     *
     * Responde SIEMPRE igual (no revela si el correo existe) y devuelve un JWT
     * efímero (`reset_token`) que el frontend guarda en memoria para el paso 2.
     *
     * @param array<string,string> $args
     */
    public function forgotPassword(Request $request, array $args): void
    {
        $email = Sanitizer::email($request->input('correo'));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation(['correo' => 'Correo electrónico inválido.']);
        }

        $token = $this->auth->requestPasswordReset($email, $this->clientIp(), $this->userAgent($request));
        Response::success(
            ['reset_token' => $token],
            'Si el correo está registrado, recibirás un código de verificación.'
        );
    }

    /**
     * POST /api/auth/password/verify-otp — Paso 5: valida el código OTP.
     *
     * @param array<string,string> $args
     */
    public function verifyOtp(Request $request, array $args): void
    {
        $token = trim((string) $request->input('reset_token', ''));
        $otp   = preg_replace('/\D/', '', (string) $request->input('otp', ''));

        $errors = [];
        if ($token === '') {
            $errors['reset_token'] = 'Falta el token de la solicitud.';
        }
        if (strlen((string) $otp) !== 6) {
            $errors['otp'] = 'El código debe tener 6 dígitos.';
        }
        if ($errors !== []) {
            throw ApiException::validation($errors);
        }

        $verified = $this->auth->verifyOtp($token, (string) $otp);
        Response::success(['reset_token' => $verified], 'Código verificado.');
    }

    /**
     * POST /api/auth/password/resend — reenvía el código (cooldown 60 s).
     *
     * @param array<string,string> $args
     */
    public function resendOtp(Request $request, array $args): void
    {
        $token = trim((string) $request->input('reset_token', ''));
        if ($token === '') {
            throw ApiException::validation(['reset_token' => 'Falta el token de la solicitud.']);
        }

        $new = $this->auth->resendOtp($token, $this->clientIp(), $this->userAgent($request));
        Response::success(['reset_token' => $new], 'Te enviamos un código nuevo.');
    }

    /**
     * POST /api/auth/password/reset — Paso 6: cambia la contraseña.
     *
     * Requiere el token "verificado" emitido tras validar el OTP.
     *
     * @param array<string,string> $args
     */
    public function resetPassword(Request $request, array $args): void
    {
        $token = trim((string) $request->input('reset_token', ''));
        $pass  = (string) $request->input('contrasena', '');

        if ($token === '') {
            throw ApiException::validation(['reset_token' => 'Falta el token de la solicitud.']);
        }

        // La política de robustez se valida en el servicio (fuente única de verdad).
        $this->auth->resetPassword($token, $pass);
        Response::success(null, 'Contraseña actualizada. Ya puedes iniciar sesión.');
    }

    /** IP del cliente para auditoría (no confía en cabeceras manipulables). */
    private function clientIp(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    }

    /** User-Agent (truncado) para auditoría. */
    private function userAgent(Request $request): string
    {
        return substr((string) ($request->header('User-Agent') ?? ''), 0, 255);
    }

    /**
     * GET /api/auth/me — devuelve la identidad del usuario autenticado.
     *
     * Endpoint protegido: requiere `Authorization: Bearer <jwt>`.
     *
     * @param array<string,string> $args
     */
    public function me(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authenticate($request);
        Response::success([
            'id'     => $claims['sub'] ?? null,
            'rol'    => $claims['rol'] ?? null,
            'correo' => $claims['correo'] ?? null,
        ], 'Token válido.');
    }
}
