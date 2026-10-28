<?php

/**
 * Pruebas de App\DataGateway\PublicReadCache.
 *
 * Una caché mal hecha sirve datos viejos tras guardar un cambio o mezcla
 * respuestas de consultas distintas; estas pruebas fijan ambos comportamientos.
 */

declare(strict_types=1);

use App\DataGateway\ArrayCacheBackend;
use App\DataGateway\PublicReadCache;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $c->grupo('PublicReadCache — lecturas públicas');

    $filas = [['id' => 1, 'titulo' => 'Culto']];

    $c->prueba('lo guardado se devuelve igual', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=*&order=fecha.asc', $filas);
        $c->asegurarIgual($filas, $cache->obtener('eventos', 'select=*&order=fecha.asc'));
    });

    $c->prueba('otra consulta de la misma tabla no comparte respuesta', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=id', $filas);
        $c->asegurarIgual(null, $cache->obtener('eventos', 'select=titulo'));
    });

    $c->prueba('la misma consulta en otra tabla no comparte respuesta', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=id', $filas);
        $c->asegurarIgual(null, $cache->obtener('noticias', 'select=id'));
    });

    $c->prueba('caduca al cumplirse el TTL', function (Corredor $c) use ($filas): void {
        $almacen = new ArrayCacheBackend();
        $cache = new PublicReadCache($almacen, 60);
        $cache->guardar('eventos', 'select=id', $filas);
        $almacen->avanzar(59);
        $c->asegurarIgual($filas, $cache->obtener('eventos', 'select=id'));
        $almacen->avanzar(1);
        $c->asegurarIgual(null, $cache->obtener('eventos', 'select=id'));
    });

    $c->prueba('una escritura invalida todas las consultas guardadas', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=id', $filas);
        $cache->guardar('noticias', 'select=id', $filas);
        $cache->invalidar();
        $c->asegurarIgual(null, $cache->obtener('eventos', 'select=id'));
        $c->asegurarIgual(null, $cache->obtener('noticias', 'select=id'));
    });

    $c->prueba('tras invalidar, lo nuevo se guarda y se lee', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=id', $filas);
        $cache->invalidar();
        $cache->guardar('eventos', 'select=id', [['id' => 2]]);
        $c->asegurarIgual([['id' => 2]], $cache->obtener('eventos', 'select=id'));
    });

    $c->prueba('lista vacía también se guarda (no se confunde con "no hay caché")', function (Corredor $c): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 60);
        $cache->guardar('eventos', 'select=id', []);
        $c->asegurarIgual([], $cache->obtener('eventos', 'select=id'));
    });

    $c->prueba('con TTL 0 queda desactivada', function (Corredor $c) use ($filas): void {
        $cache = new PublicReadCache(new ArrayCacheBackend(), 0);
        $cache->guardar('eventos', 'select=id', $filas);
        $c->asegurarIgual(false, $cache->activa());
        $c->asegurarIgual(null, $cache->obtener('eventos', 'select=id'));
    });
};
