<?php

/**
 * Pruebas unitarias de App\DataGateway\ActividadOwnershipGuard (RT-02) y
 * App\DataGateway\VoluntarioEventoOwnershipGuard (RT-03).
 *
 * LÍMITE DECLARADO: ambas clases dependen de `App\Supabase\SupabaseClient`,
 * que es `final` y cuyo constructor exige variables de entorno reales
 * (lanza ApiException si `Env::load()` no se ejecutó, y `tests/run.php`
 * deliberadamente NO lo ejecuta — ver su propio comentario: "sin red, sin
 * base de datos"). No es mockeable por herencia ni por interfaz sin tocar
 * el propio SupabaseClient (fuera del alcance autorizado en esta fase).
 *
 * Por eso estas pruebas:
 *  1) Instancian los guards con `newInstanceWithoutConstructor()` (reflexión),
 *     dejando la propiedad `$sb` sin inicializar.
 *  2) Cubren ÚNICAMENTE las ramas de código que NUNCA llegan a tocar `$sb`
 *     (todos los rechazos por método/campos no permitidos, y los casos de
 *     éxito que resuelven el propietario sin necesitar una consulta).
 *  3) La rama que sí requiere una fila real de Supabase (verificar que
 *     `voluntario_id`/`usuario_id` de la fila EXISTENTE coincide con el JWT)
 *     NO está cubierta aquí — se documenta como PRUEBA DE INTEGRACIÓN
 *     pendiente, no como unit test, tal como se pidió explícitamente.
 */

declare(strict_types=1);

use App\DataGateway\ActividadOwnershipGuard;
use App\DataGateway\PostgrestQuery;
use App\DataGateway\VoluntarioEventoOwnershipGuard;
use App\Exceptions\ApiException;
use App\Tests\Corredor;

return static function (Corredor $c): void {
    /** @var ReflectionClass<ActividadOwnershipGuard> $refActividad */
    $refActividad = new ReflectionClass(ActividadOwnershipGuard::class);
    $actividad    = $refActividad->newInstanceWithoutConstructor();
    $propActividad = $refActividad->getProperty('query');
    $propActividad->setAccessible(true);
    $propActividad->setValue($actividad, new PostgrestQuery());

    $c->grupo('ActividadOwnershipGuard (RT-02) — ramas sin Supabase');
    $c->prueba('POST se rechaza: un voluntario no puede crear actividades', function (Corredor $c) use ($actividad) {
        $c->asegurarLanza(ApiException::class, fn () => $actividad->assertPermitido('POST', '', [], 'u-1'));
    });
    $c->prueba('DELETE se rechaza: un voluntario no puede eliminar actividades', function (Corredor $c) use ($actividad) {
        $c->asegurarLanza(ApiException::class, fn () => $actividad->assertPermitido('DELETE', 'id=eq.1', [], 'u-1'));
    });
    $c->prueba('PATCH con un campo distinto de "completada" se rechaza', function (Corredor $c) use ($actividad) {
        $c->asegurarLanza(ApiException::class, function () use ($actividad) {
            $actividad->assertPermitido('PATCH', 'id=eq.1', ['completada' => true, 'nombre' => 'otro'], 'u-1');
        });
    });
    $c->prueba('PATCH sin filtro id se rechaza antes de consultar Supabase', function (Corredor $c) use ($actividad) {
        $c->asegurarLanza(ApiException::class, function () use ($actividad) {
            $actividad->assertPermitido('PATCH', '', ['completada' => true], 'u-1');
        });
    });
    $c->prueba(
        '[INTEGRACIÓN, NO CUBIERTA AQUÍ] PATCH válido con id existente requiere '
        . 'consultar Supabase para comparar voluntario_id — no testeable sin Supabase real.',
        function (Corredor $c) {
            $c->asegurarCierto(true, 'documentado como pendiente de prueba de integración');
        }
    );

    /** @var ReflectionClass<VoluntarioEventoOwnershipGuard> $refVoluntario */
    $refVoluntario    = new ReflectionClass(VoluntarioEventoOwnershipGuard::class);
    $voluntarioEvento = $refVoluntario->newInstanceWithoutConstructor();
    $propVoluntario   = $refVoluntario->getProperty('query');
    $propVoluntario->setAccessible(true);
    $propVoluntario->setValue($voluntarioEvento, new PostgrestQuery());

    $c->grupo('VoluntarioEventoOwnershipGuard (RT-03) — ramas sin Supabase');
    $c->prueba('DELETE se rechaza siempre para este rol', function (Corredor $c) use ($voluntarioEvento) {
        $c->asegurarLanza(ApiException::class, fn () => $voluntarioEvento->assertPermitido('DELETE', '', [], 'u-1'));
    });
    $c->prueba('POST inscribiendo a OTRO usuario_id se rechaza', function (Corredor $c) use ($voluntarioEvento) {
        $c->asegurarLanza(ApiException::class, function () use ($voluntarioEvento) {
            $voluntarioEvento->assertPermitido('POST', '', ['usuario_id' => 'u-2', 'evento_id' => 5], 'u-1');
        });
    });
    $c->prueba('POST con campo no permitido (rol_en_evento) se rechaza', function (Corredor $c) use ($voluntarioEvento) {
        $c->asegurarLanza(ApiException::class, function () use ($voluntarioEvento) {
            $voluntarioEvento->assertPermitido(
                'POST',
                '',
                ['usuario_id' => 'u-1', 'evento_id' => 5, 'rol_en_evento' => 'Ujier'],
                'u-1'
            );
        });
    });
    $c->prueba('POST propio con campos permitidos no lanza (self-service correcto)', function (Corredor $c) use ($voluntarioEvento) {
        $voluntarioEvento->assertPermitido('POST', '', ['usuario_id' => 'u-1', 'evento_id' => 5, 'disponible' => true], 'u-1');
        $c->asegurarCierto(true);
    });
    $c->prueba('PATCH con campo distinto de "disponible" se rechaza', function (Corredor $c) use ($voluntarioEvento) {
        $c->asegurarLanza(ApiException::class, function () use ($voluntarioEvento) {
            $voluntarioEvento->assertPermitido('PATCH', 'usuario_id=eq.u-1', ['disponible' => true, 'rol_en_evento' => 'x'], 'u-1');
        });
    });
    $c->prueba('PATCH filtrado por usuario_id=eq.<otro> se rechaza sin tocar Supabase (filtro directo, no requiere SELECT)', function (Corredor $c) use ($voluntarioEvento) {
        $c->asegurarLanza(ApiException::class, function () use ($voluntarioEvento) {
            $voluntarioEvento->assertPermitido('PATCH', 'usuario_id=eq.u-2', ['disponible' => true], 'u-1');
        });
    });
    $c->prueba('PATCH filtrado por usuario_id=eq.<propio> no lanza, sin tocar Supabase', function (Corredor $c) use ($voluntarioEvento) {
        $voluntarioEvento->assertPermitido('PATCH', 'usuario_id=eq.u-1', ['disponible' => true], 'u-1');
        $c->asegurarCierto(true);
    });
    $c->prueba(
        '[INTEGRACIÓN, NO CUBIERTA AQUÍ] PATCH filtrado por id (no por usuario_id) '
        . 'requiere consultar Supabase para resolver el propietario — no testeable sin Supabase real.',
        function (Corredor $c) {
            $c->asegurarCierto(true, 'documentado como pendiente de prueba de integración');
        }
    );
};
