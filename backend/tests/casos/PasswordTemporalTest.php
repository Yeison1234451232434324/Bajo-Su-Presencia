<?php

/** Pruebas de App\Support\PasswordTemporal. */

declare(strict_types=1);

use App\Support\PasswordTemporal as P;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $c->grupo('PasswordTemporal');

    $c->prueba('tiene el largo pedido y cumple letras + números sin espacios', function (Corredor $c): void {
        for ($i = 0; $i < 50; $i++) {
            $p = P::generar();
            $c->asegurarIgual(12, strlen($p));
            $c->asegurarIgual(1, preg_match('/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d]{12}$/', $p));
        }
    });
    $c->prueba('no repite valores entre llamadas', function (Corredor $c): void {
        $c->asegurarIgual(true, P::generar() !== P::generar());
    });
    $c->prueba('el largo mínimo es 8', function (Corredor $c): void {
        $c->asegurarIgual(8, strlen(P::generar(3)));
    });
};
