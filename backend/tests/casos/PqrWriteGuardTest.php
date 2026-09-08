<?php

/**
 * Pruebas unitarias de App\DataGateway\PqrWriteGuard (RT-04 / RT-05).
 *
 * Mismo límite declarado que en OwnershipGuardsTest.php: SupabaseClient es
 * `final` y no instanciable en el entorno de `tests/run.php` (sin
 * Env::load()). Se cubren todas las ramas que NUNCA llegan a consultar
 * Supabase: el bloqueo total de RT-05, y los dos rechazos 400 de RT-04
 * (sin filtro id, filtro id no-eq). La rama que sí requiere leer el
 * `estado` real de una PQR existente (409 si está "Resuelto") se documenta
 * como prueba de integración pendiente, no se simula aquí.
 */

declare(strict_types=1);

use App\DataGateway\PostgrestQuery;
use App\DataGateway\PqrWriteGuard;
use App\Exceptions\ApiException;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    $ref   = new ReflectionClass(PqrWriteGuard::class);
    $guard = $ref->newInstanceWithoutConstructor();
    $prop  = $ref->getProperty('query');
    $prop->setAccessible(true);
    $prop->setValue($guard, new PostgrestQuery());

    $c->grupo('PqrWriteGuard — RT-05 (edición directa de PQR vía Data Gateway siempre bloqueada)');
    $c->prueba('assertEdicionPermitida() SIEMPRE lanza 403, sin excepción', function (Corredor $c) use ($guard) {
        $c->asegurarLanza(ApiException::class, fn () => $guard->assertEdicionPermitida());
    });
    $c->prueba('el código HTTP del bloqueo RT-05 es 403 (forbidden)', function (Corredor $c) use ($guard) {
        try {
            $guard->assertEdicionPermitida();
            $c->asegurarCierto(false, 'debió lanzar');
        } catch (ApiException $e) {
            $c->asegurarIgual(403, $e->httpStatus());
        }
    });

    $c->grupo('PqrWriteGuard — RT-04, rechazos previos a consultar Supabase');
    $c->prueba('sin ningún filtro id → 400, sin tocar Supabase', function (Corredor $c) use ($guard) {
        try {
            $guard->assertNoResuelta('select=*');
            $c->asegurarCierto(false, 'debió lanzar');
        } catch (ApiException $e) {
            $c->asegurarIgual(400, $e->httpStatus());
        }
    });
    $c->prueba('filtro id=neq.<valor> (bypass conocido) → 400, sin tocar Supabase', function (Corredor $c) use ($guard) {
        // Este es el vector que el propio Red Team encontró: una versión
        // anterior de este chequeo dejaba pasar id=neq.<uuid> como "sin id".
        try {
            $guard->assertNoResuelta('id=neq.' . bin2hex(random_bytes(8)));
            $c->asegurarCierto(false, 'debió lanzar 400, no dejar pasar el filtro neq.');
        } catch (ApiException $e) {
            $c->asegurarIgual(400, $e->httpStatus());
        }
    });
    $c->prueba('dos filtros distintos sobre id (id=eq.X&id=neq.Y) → 400, sin tocar Supabase', function (Corredor $c) use ($guard) {
        try {
            $guard->assertNoResuelta('id=eq.abc&id=neq.def');
            $c->asegurarCierto(false, 'debió lanzar');
        } catch (ApiException $e) {
            $c->asegurarIgual(400, $e->httpStatus());
        }
    });
    $c->prueba(
        '[INTEGRACIÓN, NO CUBIERTA AQUÍ] id=eq.<valor único> exige consultar el '
        . 'estado real de la PQR en Supabase (409 si "Resuelto") — no testeable sin Supabase real.',
        function (Corredor $c) {
            $c->asegurarCierto(true, 'documentado como pendiente de prueba de integración');
        }
    );
};
