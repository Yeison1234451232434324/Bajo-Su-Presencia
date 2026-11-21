<?php

/** Pruebas de App\Support\UsernameGenerator (lógica pura, sin BD). */

declare(strict_types=1);

use App\Support\UsernameGenerator as G;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $ninguno = static fn(string $b): array => [];

    $c->grupo('UsernameGenerator — formato');

    $c->prueba('primer nombre + primer apellido en minúsculas', function (Corredor $c) use ($ninguno): void {
        $c->asegurarIgual('mariagonzalez', G::generar('María Fernanda', 'González Pérez', $ninguno));
    });
    $c->prueba('quita tildes y convierte ñ en n', function (Corredor $c) use ($ninguno): void {
        $c->asegurarIgual('nunezmunoz', G::generar('Núñez', 'Muñoz', $ninguno));
        $c->asegurarIgual('jesusnino', G::generar('Jesús', 'Niño', $ninguno));
    });
    $c->prueba('ignora espacios extra y símbolos', function (Corredor $c) use ($ninguno): void {
        $c->asegurarIgual('anaodonnell', G::generar('  Ana  ', "O'Donnell-", $ninguno));
    });
    $c->prueba('sin apellidos usa solo el nombre', function (Corredor $c) use ($ninguno): void {
        $c->asegurarIgual('pedro', G::generar('Pedro', null, $ninguno));
    });
    $c->prueba('base corta se rellena hasta el mínimo', function (Corredor $c) use ($ninguno): void {
        $c->asegurarIgual('al0', G::generar('Al', '', $ninguno));
    });
    $c->prueba('nunca supera 30 caracteres', function (Corredor $c) use ($ninguno): void {
        $u = G::generar(str_repeat('a', 25), str_repeat('b', 25), $ninguno);
        $c->asegurarIgual(30, strlen($u));
    });
    $c->prueba('el resultado cumple la regex del frontend', function (Corredor $c) use ($ninguno): void {
        $u = G::generar('Ñandú Ángel', 'Güemes', $ninguno);
        $c->asegurarIgual(1, preg_match('/^[a-z0-9_]{3,30}$/', $u));
    });

    $c->grupo('UsernameGenerator — colisiones');

    $c->prueba('agrega sufijo 2 si la base existe (sin importar mayúsculas)', function (Corredor $c): void {
        $c->asegurarIgual('juanperez2', G::generar('Juan', 'Pérez', fn() => ['JuanPerez']));
    });
    $c->prueba('salta sufijos ocupados', function (Corredor $c): void {
        $c->asegurarIgual('juanperez4', G::generar('Juan', 'Pérez', fn() => ['juanperez', 'juanperez2', 'juanperez3']));
    });
    $c->prueba('el sufijo respeta el máximo de 30', function (Corredor $c): void {
        $base = str_repeat('a', 30);
        $u = G::generar($base, '', fn() => [$base]);
        $c->asegurarIgual(30, strlen($u));
        $c->asegurarIgual(str_repeat('a', 29) . '2', $u);
    });
};
