<?php

declare(strict_types=1);

namespace App\Config;

/**
 * Cargador minimalista de variables de entorno desde un archivo `.env`.
 *
 * Se evita una dependencia externa para mantener el proyecto ligero. En
 * producción las variables también pueden inyectarse por el entorno real del
 * servidor (Apache/Nginx/Docker), que tiene prioridad sobre el archivo.
 *
 * @package App\Config
 */
final class Env
{
    /** @var array<string,string> Pares clave/valor cargados del archivo. */
    private static array $vars = [];

    /** @var bool Evita recargar el archivo más de una vez. */
    private static bool $loaded = false;

    /**
     * Carga el archivo `.env` indicado (una sola vez).
     *
     * @param string $path Ruta absoluta al archivo `.env`.
     */
    public static function load(string $path): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;

        if (!is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
            $value = preg_replace('/\s+#.*$/', '', (string) $value) ?? $value;
            self::$vars[trim($key)] = trim(trim($value), "\"'");
        }
    }

    /**
     * Obtiene una variable como cadena.
     *
     * @param string      $key     Nombre de la variable.
     * @param string|null $default Valor por defecto si no existe.
     */
    public static function get(string $key, ?string $default = null): ?string
    {
        $fromEnv = getenv($key);
        if ($fromEnv !== false && $fromEnv !== '') {
            return $fromEnv;
        }
        return self::$vars[$key] ?? $default;
    }

    /**
     * Obtiene una variable como entero.
     */
    public static function int(string $key, int $default = 0): int
    {
        $value = self::get($key);
        return $value === null ? $default : (int) $value;
    }

    /**
     * Obtiene una variable como booleano (`1/true/yes/on`).
     */
    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null) {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
}
