<?php

/**
 * Pruebas de App\Validation\Validator.
 *
 * Se prioriza este componente porque es un control de SEGURIDAD: es la única
 * barrera de servidor que impide almacenar teléfonos con formato arbitrario,
 * y la validación del navegador puede evadirse llamando al API directamente.
 */

declare(strict_types=1);

use App\Tests\Corredor;
use App\Exceptions\ApiException;
use App\Validation\Validator;

return static function (Corredor $c): void {

    $c->grupo('Validator::telefono — valores aceptados');

    $c->prueba('acepta 10 dígitos exactos', function (Corredor $c): void {
        $c->asegurarIgual('3001234567', Validator::telefono('3001234567'));
    });

    $c->prueba('normaliza espacios internos', function (Corredor $c): void {
        $c->asegurarIgual('3001234567', Validator::telefono('300 123 4567'));
    });

    $c->prueba('descarta el indicativo +57', function (Corredor $c): void {
        $c->asegurarIgual('3001234567', Validator::telefono('+57 300 123 4567'));
    });

    $c->prueba('descarta paréntesis y guiones (fijo)', function (Corredor $c): void {
        $c->asegurarIgual('6012345678', Validator::telefono('(601) 234-5678'));
    });

    $c->prueba('recorta espacios en los extremos', function (Corredor $c): void {
        $c->asegurarIgual('3001234567', Validator::telefono('  3001234567  '));
    });

    $c->grupo('Validator::telefono — valores rechazados');

    $c->prueba('rechaza 9 dígitos', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::telefono('300123456'));
    });

    $c->prueba('rechaza 11 dígitos', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::telefono('30012345678'));
    });

    $c->prueba('rechaza letras intercaladas', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::telefono('300ABC4567'));
    });

    $c->prueba('rechaza letras aunque completen 10 dígitos', function (Corredor $c): void {
        // Sin la comprobación de letras, el filtro de dígitos dejaría "3001234567"
        $c->asegurarLanza(ApiException::class, static fn() => Validator::telefono('300a1234567'));
    });

    $c->prueba('el error es HTTP 422', function (Corredor $c): void {
        try {
            Validator::telefono('123');
        } catch (ApiException $e) {
            $c->asegurarIgual(422, $e->httpStatus());
            $c->asegurarCierto($e->errors() !== [], 'debe detallar el campo');
            return;
        }
        throw new RuntimeException('no lanzó');
    });

    $c->grupo('Validator::telefono — opcionalidad');

    $c->prueba('vacío opcional devuelve null', function (Corredor $c): void {
        $c->asegurarIgual(null, Validator::telefono(''));
        $c->asegurarIgual(null, Validator::telefono(null));
    });

    $c->prueba('vacío obligatorio lanza excepción', function (Corredor $c): void {
        $c->asegurarLanza(ApiException::class, static fn() => Validator::telefono('', 'telefono', true));
    });
};
