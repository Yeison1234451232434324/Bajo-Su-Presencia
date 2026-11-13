<?php

/**
 * Pruebas de App\Services\VersiculoDiaService (versículo del día del pie de página).
 *
 * Usa el JSON real del proyecto (backend/data/versiculos.json) para comprobar
 * que la lista es suficiente y válida, y archivos temporales para los casos límite.
 */

declare(strict_types=1);

use App\Services\VersiculoDiaService;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $tmp = static function (string $contenido): string {
        $f = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'bsp-vers-' . bin2hex(random_bytes(4)) . '.json';
        file_put_contents($f, $contenido);
        return $f;
    };
    $bogota = new DateTimeZone('America/Bogota');
    $dia = static fn (string $fecha): DateTimeImmutable => new DateTimeImmutable($fecha . ' 12:00', $bogota);

    $c->grupo('VersiculoDiaService — lista real de versículos');

    $c->prueba('la lista cubre un año bisiesto completo (≥ 366 versículos)', function (Corredor $c): void {
        $total = (new VersiculoDiaService())->total();
        $c->asegurarCierto($total >= 366, 'faltan versículos para no repetir en un año');
    });

    $c->prueba('no hay referencias duplicadas ni textos vacíos en el JSON', function (Corredor $c): void {
        $ruta  = dirname(__DIR__, 2) . '/data/versiculos.json';
        $datos = json_decode((string) file_get_contents($ruta), true);
        $refs  = array_column($datos, 'ref');
        $c->asegurarIgual(count($refs), count(array_unique($refs)), 'referencias repetidas');
        foreach ($datos as $v) {
            $textoOk = trim((string) $v['text']) !== '' && mb_strlen($v['text']) < 400;
            $c->asegurarCierto($textoOk, 'texto inválido en ' . $v['ref']);
            $refOk = preg_match('/^\S.* \d+:\d+$/u', $v['ref']) === 1;
            $c->asegurarCierto($refOk, 'referencia mal formada: ' . $v['ref']);
        }
    });

    $c->prueba('en un año completo no se repite ningún versículo', function (Corredor $c) use ($dia): void {
        $svc  = new VersiculoDiaService();
        $refs = [];
        $d    = $dia('2027-01-01');
        for ($i = 0; $i < 365; $i++) {
            $refs[] = $svc->delDia($d->modify("+$i day"))['referencia'];
        }
        $c->asegurarIgual(365, count(array_unique($refs)), 'hubo repetidos dentro del año');
    });

    $c->grupo('VersiculoDiaService — comportamiento diario');

    $c->prueba('la misma fecha da el mismo versículo (entre instancias)', function (Corredor $c) use ($dia): void {
        $a = (new VersiculoDiaService())->delDia($dia('2026-11-12'));
        $b = (new VersiculoDiaService())->delDia($dia('2026-11-12'));
        $c->asegurarIgual($a, $b);
    });

    $c->prueba('días consecutivos dan versículos distintos', function (Corredor $c) use ($dia): void {
        $svc = new VersiculoDiaService();
        $a   = $svc->delDia($dia('2026-11-12'))['referencia'];
        $b   = $svc->delDia($dia('2026-11-13'))['referencia'];
        $c->asegurarCierto($a !== $b);
    });

    $c->prueba('el orden cambia de un año a otro', function (Corredor $c) use ($dia): void {
        $svc = new VersiculoDiaService();
        $a   = $svc->delDia($dia('2026-03-01'))['referencia'];
        $b   = $svc->delDia($dia('2027-03-01'))['referencia'];
        $c->asegurarCierto($a !== $b, 'mismo versículo el mismo día de dos años seguidos');
    });

    $c->prueba('el día cambia a medianoche de Bogotá, no de UTC', function (Corredor $c): void {
        // 2026-11-15 03:00 UTC = 2026-11-14 22:00 en Bogotá (UTC-5): sigue siendo el día 14.
        $v = (new VersiculoDiaService())->delDia(new DateTimeImmutable('2026-11-15 03:00', new DateTimeZone('UTC')));
        $c->asegurarIgual('2026-11-14', $v['fecha']);
    });

    $c->grupo('VersiculoDiaService — archivo ausente o dañado');

    $c->prueba('archivo inexistente → respaldo (Mateo 18:20), nunca un error', function (Corredor $c) use ($dia): void {
        $v = (new VersiculoDiaService('/no/existe.json'))->delDia($dia('2026-11-12'));
        $c->asegurarIgual('Mateo 18:20', $v['referencia']);
    });

    $c->prueba('JSON dañado → respaldo', function (Corredor $c) use ($tmp, $dia): void {
        $f = $tmp('{no es json');
        $v = (new VersiculoDiaService($f))->delDia($dia('2026-11-12'));
        @unlink($f);
        $c->asegurarIgual('Mateo 18:20', $v['referencia']);
    });

    $c->prueba('entradas inválidas se ignoran; las válidas se usan', function (Corredor $c) use ($tmp, $dia): void {
        $valida = ['ref' => 'Salmos 23:1', 'text' => 'Jehová es mi pastor; nada me faltará.'];
        $f = $tmp(json_encode([['ref' => 'X'], $valida, 'basura'], JSON_THROW_ON_ERROR));
        $v = (new VersiculoDiaService($f))->delDia($dia('2026-11-12'));
        @unlink($f);
        $c->asegurarIgual('Salmos 23:1', $v['referencia']);
    });
};
