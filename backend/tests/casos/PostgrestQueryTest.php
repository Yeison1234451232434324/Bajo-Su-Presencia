<?php

/**
 * Pruebas unitarias de App\DataGateway\PostgrestQuery.
 *
 * 100% unitarias: parseo de texto puro, sin dependencias externas.
 */

declare(strict_types=1);

use App\DataGateway\PostgrestQuery;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $q = new PostgrestQuery();

    $c->grupo('PostgrestQuery — filtros id=eq.');
    $c->prueba('idFilterParam extrae el valor de id=eq.<valor>', function (Corredor $c) use ($q) {
        $c->asegurarIgual('123', $q->idFilterParam('select=*&id=eq.123'));
    });
    $c->prueba('idFilterParam decodifica valores URL-encoded', function (Corredor $c) use ($q) {
        $c->asegurarIgual('a b', $q->idFilterParam('id=eq.a%20b'));
    });
    $c->prueba('idFilterParam devuelve null si no hay filtro id', function (Corredor $c) use ($q) {
        $c->asegurarIgual(null, $q->idFilterParam('select=*'));
    });
    $c->prueba('idFilterParam devuelve null si el filtro id no es "eq." (p. ej. neq.)', function (Corredor $c) use ($q) {
        $c->asegurarIgual(null, $q->idFilterParam('id=neq.999'));
    });

    $c->grupo('PostgrestQuery — countIdFilters (defensa RT-04 contra bypass con neq./otros operadores)');
    $c->prueba('cuenta 0 cuando no hay filtro id', function (Corredor $c) use ($q) {
        $c->asegurarIgual(0, $q->countIdFilters('select=*'));
    });
    $c->prueba('cuenta 1 con un único id=eq.', function (Corredor $c) use ($q) {
        $c->asegurarIgual(1, $q->countIdFilters('id=eq.abc'));
    });
    $c->prueba('cuenta 1 también con id=neq. (el filtro existe, aunque no sea eq — así se detecta el intento de bypass)', function (Corredor $c) use ($q) {
        $c->asegurarIgual(1, $q->countIdFilters('id=neq.abc'));
    });
    $c->prueba('cuenta 2 cuando hay dos filtros distintos sobre id', function (Corredor $c) use ($q) {
        $c->asegurarIgual(2, $q->countIdFilters('id=eq.abc&id=neq.def'));
    });

    $c->grupo('PostgrestQuery — eqFilterParam genérico (usado por ownership de usuario_id)');
    $c->prueba('extrae usuario_id=eq.<valor>', function (Corredor $c) use ($q) {
        $c->asegurarIgual('u-1', $q->eqFilterParam('evento_id=eq.5&usuario_id=eq.u-1', 'usuario_id'));
    });
    $c->prueba('devuelve null si el campo no está en la query', function (Corredor $c) use ($q) {
        $c->asegurarIgual(null, $q->eqFilterParam('evento_id=eq.5', 'usuario_id'));
    });

    $c->grupo('PostgrestQuery — selectParam');
    $c->prueba('extrae el valor de select= decodificado', function (Corredor $c) use ($q) {
        $c->asegurarIgual('id,nombre:nombre_completo', $q->selectParam('select=id%2Cnombre%3Anombre_completo'));
    });
    $c->prueba('devuelve null si no hay parámetro select', function (Corredor $c) use ($q) {
        $c->asegurarIgual(null, $q->selectParam('id=eq.1'));
    });

    $c->grupo('PostgrestQuery — extraerEmbeds (recursivo, con anidamiento)');
    $c->prueba('extrae un embed simple', function (Corredor $c) use ($q) {
        $embeds = $q->extraerEmbeds('id,titulo,informes(monto)');
        $c->asegurarIgual(1, count($embeds));
        $c->asegurarIgual('informes', $embeds[0]['tabla']);
        $c->asegurarIgual('monto', $embeds[0]['inner']);
    });
    $c->prueba('extrae un embed con alias (alias:tabla(...))', function (Corredor $c) use ($q) {
        $embeds = $q->extraerEmbeds('respondido:usuarios(nombre:nombre_completo)');
        $c->asegurarIgual('usuarios', $embeds[0]['tabla']);
    });
    $c->prueba('extrae embeds anidados dentro de otros embeds', function (Corredor $c) use ($q) {
        $embeds = $q->extraerEmbeds('id,evento_recursos(recurso_id,recursos(nombre,unidad))');
        $tablas = array_column($embeds, 'tabla');
        $c->asegurarCierto(in_array('evento_recursos', $tablas, true), 'debe encontrar la tabla externa');
        $c->asegurarCierto(in_array('recursos', $tablas, true), 'debe encontrar la tabla anidada');
    });
    $c->prueba('select sin embeds devuelve arreglo vacío', function (Corredor $c) use ($q) {
        $c->asegurarIgual([], $q->extraerEmbeds('id,nombre,creado_en'));
    });
    $c->prueba('paréntesis sin cerrar se marca como "malformado" (fail-closed, nunca coincide con ninguna whitelist)', function (Corredor $c) use ($q) {
        $embeds = $q->extraerEmbeds('informes(monto');
        $c->asegurarIgual("\0malformado\0", $embeds[0]['inner']);
    });

    $c->grupo('PostgrestQuery — normalizarSelect (tolerancia a espacios)');
    $c->prueba('quita todos los espacios para comparar de forma tolerante', function (Corredor $c) use ($q) {
        $c->asegurarIgual('nombre,unidad', $q->normalizarSelect('nombre, unidad'));
        $c->asegurarIgual('nombre,unidad', $q->normalizarSelect('nombre,unidad'));
    });
};
