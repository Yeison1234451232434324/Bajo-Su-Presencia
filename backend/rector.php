<?php

/**
 * Rector — modernización automatizada del código a PHP 8.2.
 *
 * Criterio de selección de reglas: se activan ÚNICAMENTE las que no alteran el
 * comportamiento en tiempo de ejecución. Se dejan fuera de forma deliberada
 * los conjuntos que reescriben lógica (por ejemplo `CODE_QUALITY` completo o
 * `EARLY_RETURN`), porque el proyecto todavía no tiene pruebas de los flujos
 * de autenticación y autorización: sin ellas, una transformación automática
 * podría cambiar el comportamiento sin que nada lo detecte.
 *
 * Uso recomendado:
 *   composer rector:dry   → muestra los cambios propuestos sin tocar nada
 *   composer rector       → los aplica (revisar el diff antes de confirmar)
 */

declare(strict_types=1);

use Rector\Config\RectorConfig;
use Rector\Php80\Rector\Switch_\ChangeSwitchToMatchRector;
use Rector\Php82\Rector\Class_\ReadOnlyClassRector;
use Rector\Set\ValueObject\LevelSetList;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        __DIR__ . '/src',
        __DIR__ . '/public',
        __DIR__ . '/routes',
        __DIR__ . '/tests',
    ]);

    $rectorConfig->skip([
        __DIR__ . '/vendor',
        __DIR__ . '/logs',

        // `switch` compara con == y permite caída entre casos; `match` compara
        // con === y lanza UnhandledMatchError si nada coincide. La conversión
        // es equivalente en el código actual, pero recae sobre el Data Gateway
        // —la ruta que decide qué tabla se lee o escribe— y hoy no existe
        // ninguna prueba que cubra esa ruta. Se excluye hasta tenerla.
        ChangeSwitchToMatchRector::class,

        // Marcar una clase entera como readonly impide asignar propiedades
        // fuera del constructor. Es un cambio semántico amplio que conviene
        // decidir clase por clase, no de forma masiva.
        ReadOnlyClassRector::class,
    ]);

    // Modernización sintáctica hasta PHP 8.2: promoción de propiedades en el
    // constructor, operador nullsafe, `match`, constantes en enum, etc.
    $rectorConfig->sets([
        LevelSetList::UP_TO_PHP_82,
    ]);

    // Importa las clases usadas en lugar de referenciarlas con su ruta
    // completa, en coherencia con el estilo actual del proyecto.
    $rectorConfig->importNames();
    $rectorConfig->removeUnusedImports();

    $rectorConfig->phpVersion(80200);
};
