<?php

/**
 * Pruebas unitarias de App\DataGateway\TableAccessPolicy.
 *
 * 100% unitarias: esta clase no depende de SupabaseClient, red ni entorno.
 * Cubre exactamente lo pedido en la fase de validación: tabla permitida/no
 * permitida, rol autorizado/no autorizado, read_select, write.
 */

declare(strict_types=1);

use App\DataGateway\TableAccessPolicy;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $policy = new TableAccessPolicy();

    $c->grupo('TableAccessPolicy — existencia de tabla');
    $c->prueba('tabla permitida (declarada en la whitelist) devuelve true', function (Corredor $c) use ($policy) {
        $c->asegurarCierto($policy->existe('eventos'), 'eventos debe existir');
        $c->asegurarCierto($policy->existe('pqr'), 'pqr debe existir');
        $c->asegurarCierto($policy->existe('usuarios'), 'usuarios debe existir');
    });
    $c->prueba('tabla no permitida (fuera de la whitelist) devuelve false', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(false, $policy->existe('tabla_inventada_para_la_prueba'));
        $c->asegurarIgual(false, $policy->existe('login_attempts'), 'tablas internas no expuestas por el gateway');
    });

    $c->grupo('TableAccessPolicy — lectura pública');
    $c->prueba('eventos es de lectura pública', function (Corredor $c) use ($policy) {
        $c->asegurarCierto($policy->esLecturaPublica('eventos'));
    });
    $c->prueba('pqr NO es de lectura pública (RT-01: sin public_insert/public_read)', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(false, $policy->esLecturaPublica('pqr'));
    });

    $c->grupo('TableAccessPolicy — escritura por rol');
    $c->prueba('Administrador puede escribir eventos', function (Corredor $c) use ($policy) {
        $c->asegurarCierto($policy->puedeEscribir('eventos', 'Administrador'));
    });
    $c->prueba('Voluntario NO puede escribir eventos', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(false, $policy->puedeEscribir('eventos', 'Voluntario'));
    });
    $c->prueba('Voluntario SÍ puede escribir actividades (con ownership aparte)', function (Corredor $c) use ($policy) {
        $c->asegurarCierto($policy->puedeEscribir('actividades', 'Voluntario'));
    });
    $c->prueba('usuarios: write vacío — nadie puede escribir vía el gateway (solo por UsuariosController)', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(false, $policy->puedeEscribir('usuarios', 'Administrador'));
    });
    $c->prueba('rol vacío nunca puede escribir', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(false, $policy->puedeEscribir('eventos', ''));
    });

    $c->grupo('TableAccessPolicy — lectura por rol (read) y read_select');
    $c->prueba('actividades sin `read` declarado: cualquier rol autenticado puede leer (comportamiento documentado en OBS-01)', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(null, $policy->rolesDeLectura('actividades'));
        $c->asegurarCierto($policy->puedeLeer('actividades', 'Voluntario'));
    });
    $c->prueba('pqr con `read` restringido: Voluntario no puede leer', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(['Administrador', 'Colaborador'], $policy->rolesDeLectura('pqr'));
        $c->asegurarIgual(false, $policy->puedeLeer('pqr', 'Voluntario'));
        $c->asegurarCierto($policy->puedeLeer('pqr', 'Administrador'));
    });
    $c->prueba('usuarios: read_select expone solo el select mínimo declarado', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(['id,nombre:nombre_completo'], $policy->selectsDeLecturaAbiertos('usuarios'));
    });
    $c->prueba('tabla sin read_select devuelve arreglo vacío', function (Corredor $c) use ($policy) {
        $c->asegurarIgual([], $policy->selectsDeLecturaAbiertos('eventos'));
    });

    $c->grupo('TableAccessPolicy — embed_select (columnas permitidas al embeber)');
    $c->prueba('recursos declara su proyección embebible exacta', function (Corredor $c) use ($policy) {
        $c->asegurarIgual(['nombre, unidad'], $policy->embedsPermitidos('recursos'));
    });
    $c->prueba('tabla sin embed_select = nunca embebible (fail-closed)', function (Corredor $c) use ($policy) {
        $c->asegurarIgual([], $policy->embedsPermitidos('pqr'));
    });
};
