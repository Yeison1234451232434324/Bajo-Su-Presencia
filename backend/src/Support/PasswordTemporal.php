<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Genera contraseñas temporales (de un solo uso) para cuentas nuevas.
 *
 * Usa random_int (CSPRNG) y un alfabeto sin caracteres ambiguos (0/O, 1/l/I)
 * para que el administrador pueda dictarla sin errores. Siempre incluye al
 * menos una letra mayúscula, una minúscula y un dígito.
 */
final class PasswordTemporal
{
    public const LARGO = 12;

    private const MAYUS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    private const MINUS  = 'abcdefghijkmnpqrstuvwxyz';
    private const DIGITOS = '23456789';

    public static function generar(int $largo = self::LARGO): string
    {
        $largo   = max(8, $largo);
        $todos   = self::MAYUS . self::MINUS . self::DIGITOS;
        $chars   = [self::tomar(self::MAYUS), self::tomar(self::MINUS), self::tomar(self::DIGITOS)];
        while (count($chars) < $largo) {
            $chars[] = self::tomar($todos);
        }
        // Fisher-Yates con CSPRNG para que los 3 obligatorios no queden al inicio.
        for ($i = count($chars) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }
        return implode('', $chars);
    }

    private static function tomar(string $alfabeto): string
    {
        return $alfabeto[random_int(0, strlen($alfabeto) - 1)];
    }
}
