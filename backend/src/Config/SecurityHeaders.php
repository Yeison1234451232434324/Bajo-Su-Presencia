<?php

declare(strict_types=1);

namespace App\Config;

/**
 * Cabeceras de seguridad HTTP aplicadas a TODA respuesta del API.
 *
 * Se aplican en el front controller, antes de despachar la ruta, para que
 * ninguna respuesta —incluidas las de error— quede sin protección.
 *
 * Cada cabecera mitiga un vector concreto:
 *  - X-Content-Type-Options : MIME sniffing (el navegador no reinterpreta el tipo).
 *  - X-Frame-Options / CSP frame-ancestors : clickjacking (embebido en un iframe).
 *  - Referrer-Policy        : fuga de URLs internas al navegar a terceros.
 *  - Permissions-Policy     : desactiva APIs del navegador que el API no usa.
 *  - Cross-Origin-*         : aislamiento de ventana y de recursos (Spectre/leaks).
 *  - Strict-Transport-Security : fuerza HTTPS (solo si la conexión ya es segura).
 *  - Content-Security-Policy: el API devuelve JSON, no HTML; se bloquea todo.
 *
 * @package App\Config
 */
final class SecurityHeaders
{
    /** Vigencia de HSTS: 1 año, el mínimo recomendado para la lista de precarga. */
    private const HSTS_MAX_AGE = 31536000;

    /**
     * Emite las cabeceras de seguridad.
     *
     * No sobrescribe cabeceras ya enviadas y omite HSTS en conexiones no
     * cifradas (enviarla por HTTP no tiene efecto y confunde a los proxys).
     */
    public static function apply(): void
    {
        if (headers_sent()) {
            return;
        }

        // El API responde JSON exclusivamente: se niega la carga de cualquier
        // recurso y se impide que la respuesta se embeba en un marco.
        header(
            "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; "
            . "base-uri 'none'; form-action 'none'"
        );

        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()');

        // Aislamiento entre orígenes.
        header('Cross-Origin-Opener-Policy: same-origin');
        header('Cross-Origin-Resource-Policy: same-site');

        // HSTS solo tiene sentido sobre TLS.
        if (self::isHttps()) {
            header('Strict-Transport-Security: max-age=' . self::HSTS_MAX_AGE . '; includeSubDomains');
        }

        // Elimina cabeceras que revelan la pila tecnológica (huella para el atacante).
        header_remove('X-Powered-By');
        header_remove('Server');
    }

    /**
     * Determina si la petición llegó por HTTPS, contemplando proxys inversos.
     */
    private static function isHttps(): bool
    {
        if (($_SERVER['HTTPS'] ?? '') !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }
        if ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443) {
            return true;
        }
        // Cabecera estándar de proxys (Nginx, Cloudflare, balanceadores).
        return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
}
