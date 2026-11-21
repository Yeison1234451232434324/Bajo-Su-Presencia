<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Genera el nombre de usuario (credencial de acceso) a partir del nombre real.
 *
 * Regla determinista:
 *   base = primer nombre + primer apellido, en minúsculas, sin tildes (ñ→n),
 *          solo [a-z0-9] (sin espacios ni símbolos), máximo 30 caracteres.
 *   Si la base ya existe se agrega un sufijo numérico: base2, base3, ...
 *   (el sufijo cabe siempre dentro del máximo de 30).
 *
 * Es lógica PURA: la consulta de existentes se inyecta, así se prueba sin BD.
 */
final class UsernameGenerator
{
    public const MAX = 30;
    public const MIN = 3;

    /**
     * Normaliza una palabra a [a-z0-9]: minúsculas, sin tildes ni símbolos.
     */
    public static function limpiar(string $texto): string
    {
        $t = mb_strtolower(trim($texto), 'UTF-8');
        // Descompone (á → a + ´) y elimina las marcas combinantes; ñ → n.
        if (class_exists(\Normalizer::class)) {
            $t = \Normalizer::normalize($t, \Normalizer::FORM_D) ?: $t;
            $t = preg_replace('/\p{Mn}+/u', '', $t) ?? $t;
        } else {
            $t = strtr($t, [
                'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
                'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o',
                'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u', 'ñ' => 'n', 'ç' => 'c',
            ]);
        }
        return preg_replace('/[^a-z0-9]+/', '', $t) ?? '';
    }

    /**
     * Base sin sufijo: primer nombre + primer apellido.
     */
    public static function base(?string $nombres, ?string $apellidos): string
    {
        $primero = static function (?string $s): string {
            $partes = preg_split('/\s+/u', trim((string) $s)) ?: [];
            foreach ($partes as $p) {
                $limpio = self::limpiar($p);
                if ($limpio !== '') {
                    return $limpio;
                }
            }
            return '';
        };

        $base = substr($primero($nombres) . $primero($apellidos), 0, self::MAX);
        // Nombre sin letras utilizables o demasiado corto: relleno estable.
        if (strlen($base) < self::MIN) {
            $base = str_pad($base === '' ? 'usuario' : $base, self::MIN, '0');
        }
        return $base;
    }

    /**
     * Devuelve un username único.
     *
     * @param callable(string):array<int,string> $existentesConPrefijo Recibe la base y
     *        devuelve los usernames ya usados que empiezan por ella (cualquier caja).
     */
    public static function generar(?string $nombres, ?string $apellidos, callable $existentesConPrefijo): string
    {
        $base  = self::base($nombres, $apellidos);
        $usados = array_flip(array_map(
            static fn($u): string => strtolower((string) $u),
            $existentesConPrefijo($base)
        ));

        if (!isset($usados[$base])) {
            return $base;
        }
        for ($n = 2; ; $n++) {
            $sufijo    = (string) $n;
            $candidato = substr($base, 0, self::MAX - strlen($sufijo)) . $sufijo;
            if (!isset($usados[$candidato])) {
                return $candidato;
            }
        }
    }
}
