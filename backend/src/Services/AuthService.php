<?php

declare(strict_types=1);

namespace App\Services;

use Throwable;
use App\Exceptions\ApiException;
use App\Repositories\PasswordResetRepository;
use App\Repositories\UserRepository;
use App\Security\BruteForceGuard;
use App\Security\Jwt;
use App\Security\OtpGuard;
use App\Supabase\SupabaseClient;
use App\Support\Logger;
use App\Support\Mailer;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Orquesta la autenticación contra Supabase aplicando las reglas de seguridad
 * (bloqueo por fuerza bruta) y emitiendo el JWT propio de 5 minutos.
 *
 * Esta capa no conoce HTTP: recibe datos ya validados y devuelve estructuras.
 *
 * @package App\Services
 */
final class AuthService
{
    private readonly SupabaseClient $sb;
    private readonly UserRepository $users;
    private readonly BruteForceGuard $guard;
    private readonly Logger $logger;
    private readonly PasswordResetRepository $resets;
    private readonly Mailer $mailer;
    private readonly OtpGuard $otpGuard;

    public function __construct(
        ?SupabaseClient $sb = null,
        ?UserRepository $users = null,
        ?BruteForceGuard $guard = null,
        ?Logger $logger = null,
        ?PasswordResetRepository $resets = null,
        ?Mailer $mailer = null,
        ?OtpGuard $otpGuard = null
    ) {
        $this->sb       = $sb     ?? new SupabaseClient();
        $this->users    = $users  ?? new UserRepository();
        $this->guard    = $guard  ?? new BruteForceGuard();
        $this->logger   = $logger ?? new Logger();
        $this->resets   = $resets ?? new PasswordResetRepository();
        $this->mailer   = $mailer ?? new Mailer();
        $this->otpGuard = $otpGuard ?? new OtpGuard();
    }

    /**
     * Inicia el flujo de recuperación: genera un token temporal, guarda su hash
     * y envía un correo con el enlace. Responde SIEMPRE igual (no revela si el
     * correo existe), para evitar enumeración de cuentas.
     */
    public function requestPasswordReset(string $email, string $ip = '', string $userAgent = ''): string
    {
        $user = $this->users->findByEmail($email);

        // No revelar si el correo existe: si NO existe, se devuelve un token
        // señuelo válido en forma (el flujo continúa, pero el OTP nunca casará).
        if ($user === null) {
            $this->logger->warning('Recuperación solicitada para correo no registrado', ['ip' => $ip]);
            return Jwt::issueReset('0', 'decoy-' . bin2hex(random_bytes(8)), 'pwd_reset_otp', [
                'slt' => bin2hex(random_bytes(8)),
            ]);
        }

        // OTP de 6 dígitos con generador criptográficamente seguro. El hash se
        // "sala" con un valor aleatorio (no secreto) que viaja en el JWT: así el
        // hash almacenado es único (evita choques con la constraint UNIQUE de
        // token_hash) y queda atado a ESE token (anti reutilización cruzada).
        $otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $salt    = bin2hex(random_bytes(8));
        $otpHash = hash('sha256', $otp . $salt);
        $expira  = (new DateTimeImmutable('+600 seconds', new DateTimeZone('UTC')))
            ->format('Y-m-d\TH:i:s\Z');

        // Invalida solicitudes anteriores y crea la nueva (id = jti).
        $this->resets->invalidatePrevious((string) $user['id']);
        $jti = $this->resets->createOtp((string) $user['id'], $otpHash, $expira);
        $this->otpGuard->reset($jti);

        try {
            $this->mailer->send(
                $email,
                'Tu código de verificación — Bajo Su Presencia',
                $this->otpEmailHtml((string) ($user['nombre_completo'] ?? $user['nombre'] ?? ''), $otp, 10)
            );
            $this->logger->info('OTP de recuperación enviado', [
                'usuario_id' => $user['id'], 'jti' => $jti, 'ip' => $ip, 'ua' => $userAgent,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('No se pudo enviar el OTP de recuperación', [
                'usuario_id' => $user['id'], 'error' => $e->getMessage(),
            ]);
        }

        // El JWT viaja por HTTPS en la respuesta; el OTP solo por correo.
        return Jwt::issueReset((string) $user['id'], $jti, 'pwd_reset_otp', ['slt' => $salt]);
    }

    /**
     * Paso 5 — valida el OTP contra el JWT y devuelve un token "verificado"
     * que autoriza el cambio de contraseña sin reenviar el código.
     *
     * @throws ApiException 400 código incorrecto/expirado · 423 demasiados intentos.
     */
    public function verifyOtp(string $resetToken, string $otp): string
    {
        $claims = Jwt::verifyReset($resetToken, ['pwd_reset_otp']);
        $jti    = (string) ($claims['jti'] ?? '');

        $this->otpGuard->assertNotLocked($jti);

        $salt     = (string) ($claims['slt'] ?? '');
        $row      = $this->resets->findActiveByJti($jti);
        $expected = is_array($row) ? (string) ($row['token_hash'] ?? '') : '';
        $given    = hash('sha256', preg_replace('/\D/', '', $otp) . $salt);

        // Comparación en tiempo constante (anti timing attack). Si no hay fila
        // (token señuelo/expirado) se compara contra un valor imposible.
        $ok = $expected !== '' && hash_equals($expected, $given);
        if (!$ok) {
            $this->otpGuard->registerFailure($jti);
            throw new ApiException('Código incorrecto o expirado.', 400);
        }

        $this->otpGuard->reset($jti);
        $this->logger->info('OTP verificado', ['usuario_id' => $claims['sub'] ?? null, 'jti' => $jti]);

        return Jwt::issueReset((string) ($claims['sub'] ?? '0'), $jti, 'pwd_reset_verified');
    }

    /**
     * Reenvía el código: exige 60 s desde la emisión anterior y genera un OTP y
     * un JWT nuevos, invalidando los anteriores.
     *
     * @throws ApiException 429 si aún no han pasado 60 segundos.
     */
    public function resendOtp(string $resetToken, string $ip = '', string $userAgent = ''): string
    {
        $claims = Jwt::verifyReset($resetToken, ['pwd_reset_otp', 'pwd_reset_verified']);

        if ((time() - (int) ($claims['iat'] ?? 0)) < 60) {
            throw new ApiException('Espera 60 segundos antes de solicitar otro código.', 429);
        }

        $user = $this->users->findById((string) ($claims['sub'] ?? ''));
        if ($user === null) {
            return Jwt::issueReset('0', 'decoy-' . bin2hex(random_bytes(8)), 'pwd_reset_otp');
        }
        return $this->requestPasswordReset((string) $user['correo_electronico'], $ip, $userAgent);
    }

    /**
     * Paso 6/7 — cambia la contraseña con un token verificado y consume todo.
     *
     * @throws ApiException 400 token inválido/expirado · 422 contraseña débil.
     */
    public function resetPassword(string $resetToken, string $newPassword): void
    {
        $this->assertStrongPassword($newPassword);

        $claims = Jwt::verifyReset($resetToken, ['pwd_reset_verified']);
        $jti    = (string) ($claims['jti'] ?? '');

        $row = $this->resets->findActiveByJti($jti);
        if ($row === null) {
            throw new ApiException('La solicitud expiró o ya fue usada. Empieza de nuevo.', 400);
        }

        $user   = $this->users->findById((string) $row['usuario_id']);
        $authId = $user['auth_id'] ?? null;
        if (!$authId) {
            throw new ApiException('La cuenta no tiene acceso asociado.', 400);
        }

        // Cambia la contraseña en Supabase Auth.
        $this->sb->authAdminUpdatePassword((string) $authId, $newPassword);

        // Invalidación total: consume la solicitud, anula las previas y limpia
        // el contador de intentos del OTP (anti reutilización/replay).
        $this->resets->consume((string) $row['id']);
        $this->resets->invalidatePrevious((string) $row['usuario_id']);
        $this->otpGuard->reset($jti);

        $this->logger->info('Contraseña restablecida vía OTP', [
            'usuario_id' => $row['usuario_id'], 'jti' => $jti,
        ]);
    }

    /**
     * Valida la robustez de la contraseña (NIST/OWASP ASVS).
     *
     * @throws ApiException 422 si no cumple la política.
     */
    private function assertStrongPassword(string $p): void
    {
        if (
            strlen($p) < 8
            || !preg_match('/[A-Z]/', $p)
            || !preg_match('/[a-z]/', $p)
            || !preg_match('/\d/', $p)
            || !preg_match('/[^A-Za-z0-9]/', $p)
        ) {
            throw ApiException::validation([
                'contrasena' => 'Debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.',
            ]);
        }
    }

    /** Plantilla HTML del correo con el código OTP (solo el código, sin enlaces). */
    private function otpEmailHtml(string $nombre, string $otp, int $minutos): string
    {
        $saludo  = $nombre !== '' ? htmlspecialchars($nombre, ENT_QUOTES) : 'Hola';
        $code    = htmlspecialchars($otp, ENT_QUOTES);
        $logoUrl = Mailer::logoUrl();
        return <<<HTML
        <div style="margin:0;padding:24px;background:#eef2f8;font-family:Georgia,'Times New Roman',serif">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                     style="width:100%;max-width:560px;background:#fff;border-radius:14px;overflow:hidden;
                            box-shadow:0 8px 30px rgba(15,30,90,.12)">
                <tr><td style="background:#0F1E5A;padding:28px 24px;text-align:center">
                  <img src="{$logoUrl}" alt="Bajo Su Presencia" width="56" height="56"
                       style="display:block;margin:0 auto 12px;border-radius:12px;width:56px;height:56px">
                  <div style="color:#fff;font-size:22px;font-weight:700">
                    Bajo Su Presencia</div>
                  <div style="color:#cbd5e1;font-size:14px;margin-top:6px;letter-spacing:.02em">
                    Código de verificación</div>
                </td></tr>
                <tr><td style="padding:30px 34px;color:#1f2937;font-size:15px;line-height:1.6">
                  <p style="margin:0 0 12px">Hola <b>{$saludo}</b>,</p>
                  <p style="margin:0 0 18px">Usa este código para restablecer tu contraseña:</p>
                  <p style="text-align:center;margin:22px 0">
                    <span style="display:inline-block;background:#f1f5f9;border:2px dashed #1E3A8A;
                       color:#0F1E5A;font-family:Consolas,monospace;font-size:34px;font-weight:700;
                       letter-spacing:10px;padding:16px 24px;border-radius:12px">{$code}</span>
                  </p>
                  <p style="margin:0;color:#6b7280;font-size:13px">
                     No compartas este código con nadie. Nuestro equipo nunca te lo pedirá.</p>
                </td></tr>
                <tr><td style="padding:14px 34px;color:#9ca3af;font-size:13px;line-height:1.6;
                               border-top:1px dashed #e5e1d8">
                  ⏱ El código caduca en {$minutos} minutos.<br>
                  Si no solicitaste este cambio, ignora este correo: tu contraseña seguirá igual.
                </td></tr>
              </table>
              <p style="color:#94a3b8;font-size:11px;margin:16px 0 0">
                © Bajo Su Presencia B.S.P — Sistema de Gestión Eclesiástica</p>
            </td></tr>
          </table>
        </div>
        HTML;
    }

    /**
     * Inicia sesión: aplica el bloqueo, valida en Supabase y emite el JWT.
     *
     * @return array{token:array<string,mixed>,user:array<string,mixed>,supabase:array<string,mixed>}
     * @throws ApiException 423 bloqueada · 401 credenciales inválidas · 403 inactiva.
     */
    public function login(string $email, string $password, ?string $expectedUsername = null): array
    {
        // 1) Rechaza de inmediato si la cuenta está bloqueada.
        $this->guard->assertNotLocked($email);

        // 2) Valida credenciales contra Supabase Auth (GoTrue).
        $session = $this->sb->signInWithPassword($email, $password);
        if ($session === null) {
            // 3) Intento fallido → cuenta y eventual bloqueo.
            $this->guard->registerFailure($email);
            throw ApiException::unauthorized('Usuario, correo o contraseña incorrectos.');
        }

        // 4) Éxito → reinicia el contador de intentos.
        $this->guard->reset($email);

        // 5) Carga el perfil y el rol desde la tabla `usuarios`.
        $profile = $this->users->findByEmail($email);
        if ($profile === null) {
            throw ApiException::forbidden('El usuario no tiene perfil asignado.');
        }
        if (array_key_exists('activo', $profile) && $profile['activo'] === false) {
            throw ApiException::forbidden('Tu cuenta está inactiva.');
        }

        // 5b) El nombre de usuario debe coincidir con el de la cuenta.
        if ($expectedUsername !== null) {
            $actual = strtolower(trim((string) ($profile['username'] ?? '')));
            if ($actual === '' || $actual !== strtolower(trim($expectedUsername))) {
                throw ApiException::unauthorized('Usuario, correo o contraseña incorrectos.');
            }
        }

        $rol = $profile['roles']['nombre'] ?? null;

        // 6) Emite el JWT propio (TTL máximo 5 min).
        $token = Jwt::issue([
            'id'     => (string) $profile['id'],
            'rol'    => $rol,
            'correo' => $email,
        ]);

        $this->logger->info('Inicio de sesión correcto', ['email' => $email, 'rol' => $rol]);

        return [
            'token' => $token,
            'user'  => [
                'id'     => $profile['id'],
                'nombre' => $profile['nombre_completo'] ?? $profile['nombre'] ?? null,
                'correo' => $email,
                'rol'    => $rol,
            ],
            // Sesión de Supabase: el frontend la fija con sb.auth.setSession()
            // para que el resto de la app siga operando bajo RLS.
            'supabase' => [
                'access_token'  => $session['access_token'] ?? null,
                'refresh_token' => $session['refresh_token'] ?? null,
                'expires_in'    => $session['expires_in'] ?? null,
            ],
        ];
    }

    /**
     * Renueva el JWT propio usando el refresh token de Supabase.
     *
     * @return array{token:array<string,mixed>,supabase_refresh_token:?string}
     * @throws ApiException 401 si el refresh token es inválido o expiró.
     */
    public function refresh(string $refreshToken): array
    {
        $session = $this->sb->refreshSession($refreshToken);
        if ($session === null || !isset($session['user']['email'])) {
            throw ApiException::unauthorized('Sesión expirada. Vuelve a iniciar sesión.');
        }

        $email   = (string) $session['user']['email'];
        $profile = $this->users->findByEmail($email);
        $rol     = $profile['roles']['nombre'] ?? null;

        $token = Jwt::issue([
            'id'     => (string) ($profile['id'] ?? $session['user']['id']),
            'rol'    => $rol,
            'correo' => $email,
        ]);

        return ['token' => $token, 'supabase_refresh_token' => $session['refresh_token'] ?? null];
    }
}
