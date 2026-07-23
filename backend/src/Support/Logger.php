<?php

declare(strict_types=1);

namespace App\Support;

use Throwable;

/**
 * Logger de archivo simple (un archivo por día).
 *
 * Los detalles internos sensibles (trazas, respuestas de Supabase) se registran
 * aquí y NUNCA se envían al cliente.
 *
 * @package App\Support
 */
final class Logger
{
    /** @var string Ruta del archivo de log del día. */
    private readonly string $file;

    /**
     * @param string|null $dir Directorio de logs (por defecto `<raíz>/logs`).
     */
    public function __construct(?string $dir = null)
    {
        $dir ??= dirname(__DIR__, 2) . '/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $this->file = $dir . '/app-' . date('Y-m-d') . '.log';
    }

    /**
     * Identificador único de la solicitud HTTP en curso.
     *
     * Es estático porque cada servicio instancia su propio Logger: sin esto,
     * las líneas de una misma petición no podrían correlacionarse entre sí al
     * investigar un incidente.
     */
    private static ?string $requestId = null;

    /**
     * Claves cuyo valor NUNCA debe escribirse en el log.
     * Se registran como `[redactado]` conservando la clave, para saber que el
     * dato existía sin exponerlo.
     */
    private const CLAVES_SENSIBLES = [
        'password', 'contrasena', 'contrasena_nueva', 'token', 'access_token',
        'refresh_token', 'authorization', 'secret', 'apikey', 'api_key', 'otp',
    ];

    /** Devuelve (creando si hace falta) el identificador de la solicitud. */
    public static function requestId(): string
    {
        if (self::$requestId === null) {
            try {
                self::$requestId = bin2hex(random_bytes(6));
            } catch (Throwable) {
                self::$requestId = uniqid('', true);
            }
        }
        return self::$requestId;
    }

    /**
     * Registra un fallo irrecuperable o un control de seguridad caído.
     *
     * @param array<string,mixed> $context Datos adicionales.
     */
    public function critical(string $message, array $context = []): void
    {
        $this->write('CRITICAL', $message, $context);
    }

    /**
     * Registra un evento de error.
     *
     * @param array<string,mixed> $context Datos adicionales.
     */
    public function error(string $message, array $context = []): void
    {
        $this->write('ERROR', $message, $context);
    }

    /**
     * Registra una situación anómala que no impide continuar
     * (p. ej. un bloqueo por fuerza bruta o un intento rechazado).
     *
     * @param array<string,mixed> $context Datos adicionales.
     */
    public function warning(string $message, array $context = []): void
    {
        $this->write('WARNING', $message, $context);
    }

    /**
     * Registra un evento informativo (p. ej. login correcto).
     *
     * @param array<string,mixed> $context Datos adicionales.
     */
    public function info(string $message, array $context = []): void
    {
        $this->write('INFO', $message, $context);
    }

    /**
     * Depura el contexto antes de escribirlo:
     *  - Redacta los valores de claves sensibles (tokens, contraseñas, OTP).
     *  - Enmascara los correos electrónicos, que son datos personales:
     *    `yeison@correo.com` → `y*****@correo.com`.
     *
     * Motivo: los archivos de log se conservan, se copian y se comparten en
     * soporte. No deben convertirse en un segundo almacén de datos personales
     * ni de credenciales.
     *
     * @param array<string,mixed> $context
     * @return array<string,mixed>
     */
    private function depurar(array $context): array
    {
        $limpio = [];
        foreach ($context as $clave => $valor) {
            $claveNorm = strtolower((string) $clave);

            if (in_array($claveNorm, self::CLAVES_SENSIBLES, true)) {
                $limpio[$clave] = '[redactado]';
                continue;
            }
            if (is_array($valor)) {
                $limpio[$clave] = $this->depurar($valor);
                continue;
            }
            if (is_string($valor) && filter_var($valor, FILTER_VALIDATE_EMAIL) !== false) {
                $limpio[$clave] = $this->enmascararCorreo($valor);
                continue;
            }
            $limpio[$clave] = $valor;
        }
        return $limpio;
    }

    /** Enmascara la parte local de un correo conservando su dominio. */
    private function enmascararCorreo(string $correo): string
    {
        $partes = explode('@', $correo, 2);
        if (count($partes) !== 2 || $partes[0] === '') {
            return '[correo]';
        }
        return substr($partes[0], 0, 1) . str_repeat('*', 5) . '@' . $partes[1];
    }

    /**
     * Escribe una línea en el log.
     *
     * @param array<string,mixed> $context
     */
    private function write(string $level, string $message, array $context): void
    {
        $context = $this->depurar($context);

        $line = sprintf(
            "[%s] [%s] %s: %s %s\n",
            date('c'),
            self::requestId(),
            $level,
            $message,
            $context !== [] ? json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : ''
        );
        @file_put_contents($this->file, $line, FILE_APPEND | LOCK_EX);
    }
}
