<?php

declare(strict_types=1);

namespace App\DataGateway;

/**
 * Utilidades de solo-lectura para interpretar una query string cruda en
 * formato PostgREST (`id=eq.123&select=a,b(c)`).
 *
 * Separada del controlador y de los guards de ownership por responsabilidad
 * única (SRP): esta clase no decide permisos, solo entiende la sintaxis de
 * PostgREST. Los guards y el validador de embeds la usan como colaborador
 * (composición) en vez de reimplementar el parseo cada uno.
 *
 * @package App\DataGateway
 */
final class PostgrestQuery
{
    /**
     * Extrae el valor (decodificado) de un filtro `<campo>=eq.<valor>` de una
     * query string cruda, o `null` si no está presente.
     */
    public function eqFilterParam(string $query, string $campo): ?string
    {
        if (preg_match('/(?:^|&)' . preg_quote($campo, '/') . '=eq\.([^&]+)/', $query, $m) !== 1) {
            return null;
        }
        return urldecode($m[1]);
    }

    public function idFilterParam(string $query): ?string
    {
        return $this->eqFilterParam($query, 'id');
    }

    /** Extrae el valor (decodificado) del parámetro `select`, o `null` si no está presente. */
    public function selectParam(string $query): ?string
    {
        if (preg_match('/(?:^|&)select=([^&]*)/', $query, $m) !== 1) {
            return null;
        }
        return urldecode($m[1]);
    }

    /**
     * Cuenta cuántos filtros distintos sobre `id` trae la query string
     * (`id=eq.1`, `id=neq.2`, ...) — usado para exigir "exactamente un id=eq."
     * sin asumir que la ausencia del patrón esperado significa "sin filtro".
     */
    public function countIdFilters(string $query): int
    {
        $count = preg_match_all('/(?:^|&)id=([^&]+)/', $query, $m);
        return $count === false ? 0 : $count;
    }

    /**
     * Extrae, recursivamente, todas las relaciones embebidas de un `select`
     * de PostgREST: `tabla(...)`, `alias:tabla(...)` y `tabla!fk(...)`, en
     * cualquier nivel de anidamiento.
     *
     * @return array<int,array{tabla:string,inner:string}> Una entrada por
     *         cada tabla embebida encontrada (aplanado, incluye las anidadas
     *         dentro de otras).
     */
    public function extraerEmbeds(string $select): array
    {
        $embeds = [];
        $len    = strlen($select);
        $offset = 0;

        // (?:^|[,(]) : el identificador arranca al inicio de la cadena o tras
        //              una coma/paréntesis (no en medio de otra palabra).
        // (?:\w+\s*:\s*)? : alias opcional ("respondido:usuarios(...)").
        // (\w+)            : nombre real de la tabla — el que se valida.
        // (?:\s*!\s*\w+)?  : hint de FK opcional ("usuarios!voluntario_id(...)").
        $patron = '/(?:^|[,(])\s*(?:\w+\s*:\s*)?(\w+)(?:\s*!\s*\w+)?\s*\(/';

        while ($offset < $len && preg_match($patron, $select, $m, PREG_OFFSET_CAPTURE, $offset) === 1) {
            $tabla        = $m[1][0];
            $matchEnd     = $m[0][1] + strlen($m[0][0]); // posición justo tras el '(' de apertura
            $parenAbierto = $matchEnd - 1;

            // Buscar el ')' que cierra este embed, respetando anidamiento.
            $profundidad = 1;
            $cursor      = $matchEnd;
            while ($cursor < $len && $profundidad > 0) {
                if ($select[$cursor] === '(') {
                    $profundidad++;
                } elseif ($select[$cursor] === ')') {
                    $profundidad--;
                }
                $cursor++;
            }
            if ($profundidad !== 0) {
                // Paréntesis sin cerrar: `select` malformado — se rechaza
                // dejando la tabla fuera de cualquier lista blanca posible.
                $embeds[] = ['tabla' => $tabla, 'inner' => "\0malformado\0"];
                break;
            }

            $inner    = substr($select, $parenAbierto + 1, $cursor - $parenAbierto - 2);
            $embeds[] = ['tabla' => $tabla, 'inner' => $inner];

            // Recursión: el contenido embebido puede tener sus propios embeds
            // anidados (p. ej. evento_recursos(..., recursos(nombre, unidad))).
            foreach ($this->extraerEmbeds($inner) as $anidado) {
                $embeds[] = $anidado;
            }

            $offset = $cursor;
        }

        return $embeds;
    }

    /** Normaliza espacios para comparar `select` embebidos de forma tolerante. */
    public function normalizarSelect(string $select): string
    {
        return preg_replace('/\s+/', '', $select) ?? $select;
    }
}
