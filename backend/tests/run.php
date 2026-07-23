<?php

/**
 * Ejecutor de pruebas mínimo, sin dependencias externas.
 *
 * Alcance deliberado: solo lógica PURA (sin red, sin base de datos, sin
 * sesión). Las pruebas de integración de los flujos autenticados requieren
 * credenciales y un entorno de pruebas, y se documentan como pendientes.
 *
 * Uso:  composer test   ·   php tests/run.php
 */

declare(strict_types=1);

use App\Tests\Corredor;

require dirname(__DIR__) . '/vendor/autoload.php';
require __DIR__ . '/Corredor.php';

$c = new Corredor();

// ============================================================================
//  Casos de prueba
// ============================================================================

// glob() devuelve false si el directorio no es accesible; sin el respaldo,
// el ejecutor fallaría con un error críptico en lugar de no hacer nada.
$casos = glob(__DIR__ . '/casos/*.php') ?: [];

foreach ($casos as $archivo) {
    (require $archivo)($c);
}

exit($c->resumen());
