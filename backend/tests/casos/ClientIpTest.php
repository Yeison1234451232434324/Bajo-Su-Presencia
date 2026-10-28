<?php

/**
 * Pruebas de App\Http\ClientIp.
 *
 * Es un control de seguridad: si confiara en la cabecera sin condiciones, un
 * atacante esquivaría el límite de tasa; si la ignorara siempre, todos los
 * visitantes tras el proxy compartirían el mismo contador.
 */

declare(strict_types=1);

use App\Http\ClientIp;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $c->grupo('ClientIp — IP real tras el proxy');

    $c->prueba('proxy loopback + CF-Connecting-IP válida → usa la cabecera', function (Corredor $c): void {
        $ip = ClientIp::resolve(['REMOTE_ADDR' => '::1', 'HTTP_CF_CONNECTING_IP' => '191.89.237.54']);
        $c->asegurarIgual('191.89.237.54', $ip);
    });

    $c->prueba('proxy en red privada + cabecera IPv6 → usa la cabecera', function (Corredor $c): void {
        $ip = ClientIp::resolve(['REMOTE_ADDR' => '10.225.25.97', 'HTTP_CF_CONNECTING_IP' => '2800:e2:b980::1']);
        $c->asegurarIgual('2800:e2:b980::1', $ip);
    });

    $c->prueba('conexión directa pública → ignora la cabecera (falsificable)', function (Corredor $c): void {
        $ip = ClientIp::resolve(['REMOTE_ADDR' => '203.0.113.7', 'HTTP_CF_CONNECTING_IP' => '1.2.3.4']);
        $c->asegurarIgual('203.0.113.7', $ip);
    });

    $c->prueba('cabecera con basura → cae a REMOTE_ADDR', function (Corredor $c): void {
        $ip = ClientIp::resolve(['REMOTE_ADDR' => '::1', 'HTTP_CF_CONNECTING_IP' => 'no-es-una-ip']);
        $c->asegurarIgual('::1', $ip);
    });

    $c->prueba('sin cabecera → REMOTE_ADDR', function (Corredor $c): void {
        $c->asegurarIgual('10.0.0.5', ClientIp::resolve(['REMOTE_ADDR' => '10.0.0.5']));
    });

    $c->prueba('sin REMOTE_ADDR → cadena vacía', function (Corredor $c): void {
        $c->asegurarIgual('', ClientIp::resolve(['HTTP_CF_CONNECTING_IP' => '1.2.3.4']));
    });
};
