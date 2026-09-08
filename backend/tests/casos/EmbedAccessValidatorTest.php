<?php

/**
 * Pruebas unitarias de App\DataGateway\EmbedAccessValidator.
 *
 * 100% unitarias: TableAccessPolicy y PostgrestQuery, sus dos colaboradores,
 * tampoco dependen de red ni base de datos.
 */

declare(strict_types=1);

use App\DataGateway\EmbedAccessValidator;
use App\DataGateway\PostgrestQuery;
use App\DataGateway\TableAccessPolicy;
use App\Exceptions\ApiException;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $validator = new EmbedAccessValidator(new TableAccessPolicy(), new PostgrestQuery());

    $c->grupo('EmbedAccessValidator — embed permitido');
    $c->prueba('recursos(nombre, unidad) embebido en evento_recursos coincide con la whitelist', function (Corredor $c) use ($validator) {
        // No debe lanzar: es exactamente el embed_select declarado para 'recursos'.
        $validator->validar('recurso_id,cantidad,recursos(nombre, unidad)');
        $c->asegurarCierto(true, 'no debió lanzar excepción');
    });
    $c->prueba('titulo embebido desde eventos coincide con su embed_select', function (Corredor $c) use ($validator) {
        $validator->validar('monto,eventos(titulo)');
        $c->asegurarCierto(true);
    });

    $c->grupo('EmbedAccessValidator — embed NO permitido (fail-closed)');
    $c->prueba('pedir una columna distinta a la declarada en embed_select se rechaza', function (Corredor $c) use ($validator) {
        $c->asegurarLanza(ApiException::class, function () use ($validator) {
            // 'recursos' solo permite "nombre, unidad" embebido — no 'cantidad'.
            $validator->validar('evento_recursos(recursos(cantidad))');
        });
    });
    $c->prueba('embeber una tabla sin embed_select declarado se rechaza (pqr nunca es embebible)', function (Corredor $c) use ($validator) {
        $c->asegurarLanza(ApiException::class, function () use ($validator) {
            $validator->validar('id,pqr(estado)');
        });
    });
    $c->prueba('embeber una tabla inexistente en la whitelist se rechaza', function (Corredor $c) use ($validator) {
        $c->asegurarLanza(ApiException::class, function () use ($validator) {
            $validator->validar('tabla_inventada(x)');
        });
    });

    $c->grupo('EmbedAccessValidator — recursivo (anidado a varios niveles)');
    $c->prueba('el embed externo válido con un embed anidado inválido se rechaza igual', function (Corredor $c) use ($validator) {
        $c->asegurarLanza(ApiException::class, function () use ($validator) {
            // evento_recursos(...) tiene un embed valido de recursos, pero le
            // agregamos una columna extra no declarada.
            $validator->validar('evento_recursos(recurso_id,cantidad,recursos(nombre,unidad,precio))');
        });
    });
    $c->prueba('select sin ningún embed no lanza nada (nada que validar)', function (Corredor $c) use ($validator) {
        $validator->validar('id,titulo,fecha');
        $c->asegurarCierto(true);
    });

    $c->grupo('EmbedAccessValidator — tolerancia de espacios');
    $c->prueba('espacios extra en el select no afectan la comparación', function (Corredor $c) use ($validator) {
        $validator->validar('evento_recursos(  recurso_id , cantidad , recursos( nombre , unidad ) )');
        $c->asegurarCierto(true);
    });
};
