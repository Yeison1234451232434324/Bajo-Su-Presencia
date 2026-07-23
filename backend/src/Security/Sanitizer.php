<?php

declare(strict_types=1);

namespace App\Security;

/**
 * Sanitización de entradas para mitigar XSS e inyecciones.
 *
 * Las contraseñas NUNCA pasan por aquí: deben verificarse tal cual las escribe
 * el usuario. PostgREST usa siempre consultas parametrizadas, por lo que el
 * vector principal mitigado es el XSS sobre datos que luego se mostrarán.
 *
 * @package App\Security
 */
final class Sanitizer
{
    /** Recorta y escapa caracteres HTML de una cadena de texto. */
    public static function text(?string $value): string
    {
        return htmlspecialchars(trim((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /** Normaliza y valida un correo electrónico. */
    public static function email(?string $value): string
    {
        return trim((string) filter_var((string) $value, FILTER_SANITIZE_EMAIL));
    }
}
