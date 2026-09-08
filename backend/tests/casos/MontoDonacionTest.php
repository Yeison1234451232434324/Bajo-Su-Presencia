<?php

/**
 * Pruebas de App\Validation\Validator::montoDonacion.
 *
 * Regla de negocio del módulo de Donaciones: el monto debe ser un entero
 * entre $1.000 y $20.000.000 COP (inclusive). Fuera de ese rango, el servidor
 * responde HTTP 422 — con independencia de lo que valide el navegador.
 *
 * Se prueban explícitamente los CASOS LÍMITE (999 / 1000 / 20000000 / 20000001)
 * más un valor intermedio, según pide la evidencia GP-REQ-02 de la Guía 6.
 */

declare(strict_types=1);

use App\Tests\Corredor;
use App\Exceptions\ApiException;
use App\Validation\Validator;

return static function (Corredor $c): void {

    $c->grupo('Validator::montoDonacion — valores aceptados');

    $c->prueba('acepta el mínimo exacto (1000)', function (Corredor $c): void {
        $c->asegurarIgual(1000, Validator::montoDonacion(1000));
    });

    $c->prueba('acepta el máximo exacto (20000000)', function (Corredor $c): void {
        $c->asegurarIgual(20000000, Validator::montoDonacion(20000000));
    });

    $c->prueba('acepta un valor intermedio (50000)', function (Corredor $c): void {
        $c->asegurarIgual(50000, Validator::montoDonacion(50000));
    });

    $c->prueba('normaliza una cadena numérica a entero ("34000")', function (Corredor $c): void {
        $c->asegurarIgual(34000, Validator::montoDonacion('34000'));
    });

    $c->grupo('Validator::montoDonacion — valores rechazados');

    $c->prueba('rechaza justo por debajo del mínimo (999)', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::montoDonacion(999));
    });

    $c->prueba('rechaza justo por encima del máximo (20000001)', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::montoDonacion(20000001));
    });

    $c->prueba('rechaza cero', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::montoDonacion(0));
    });

    $c->prueba('rechaza un monto negativo', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::montoDonacion(-100));
    });

    $c->prueba('el error es HTTP 422 y detalla el campo', function (Corredor $c): void {
        try {
            Validator::montoDonacion(999);
        } catch (ApiException $e) {
            $c->asegurarIgual(422, $e->httpStatus());
            $c->asegurarCierto($e->errors() !== [], 'debe detallar el campo "monto"');
            return;
        }
        throw new RuntimeException('no lanzó');
    });
};
