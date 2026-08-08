<?php

declare(strict_types=1);

namespace App\Services;

use App\Supabase\SupabaseClient;

/**
 * Lectura de la bitácora de auditoría (`auditoria_acciones`).
 *
 * Solo lectura: no expone crear/editar/eliminar (los registros los escribe
 * exclusivamente {@see \App\Support\AuditLogger} desde el punto donde ocurre
 * cada acción). Traduce los filtros del panel a la sintaxis de PostgREST y
 * hace UNA sola consulta (sin N+1): la fila ya trae denormalizados
 * usuario_correo/usuario_rol, así que no hace falta un join ni una consulta
 * adicional a `usuarios` para mostrar el listado.
 *
 * @package App\Services
 */
final class AuditoriaService
{
    /** Tope de filas por consulta: protege el panel de una carga sin límite. */
    private const LIMITE_MAX = 500;

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * Lista registros de auditoría aplicando los filtros recibidos.
     *
     * @param array<string,string> $filtros Claves posibles: usuario, modulo,
     *                                       accion, resultado, desde, hasta, limite.
     * @return array<int,array<string,mixed>>
     */
    public function listar(array $filtros): array
    {
        $query = [];

        if (($usuario = trim($filtros['usuario'] ?? '')) !== '') {
            $query['usuario_correo'] = 'ilike.*' . $usuario . '*';
        }
        if (($modulo = trim($filtros['modulo'] ?? '')) !== '') {
            $query['modulo'] = 'eq.' . $modulo;
        }
        if (($accion = trim($filtros['accion'] ?? '')) !== '') {
            $query['accion'] = 'eq.' . $accion;
        }
        if (($resultado = trim($filtros['resultado'] ?? '')) !== '') {
            $query['resultado'] = 'eq.' . $resultado;
        }

        // Rango de fechas: PostgREST admite varios filtros sobre la misma
        // columna repitiendo la clave con corchetes (creado_en=gte.X&creado_en=lte.Y)
        // no es soportado por http_build_query con claves repetidas simples,
        // así que se arma la query manualmente cuando hay rango.
        $desde = trim($filtros['desde'] ?? '');
        $hasta = trim($filtros['hasta'] ?? '');

        $limite = (int) ($filtros['limite'] ?? 200);
        $limite = $limite > 0 ? min($limite, self::LIMITE_MAX) : 200;

        $params = array_merge(['select' => '*', 'order' => 'creado_en.desc', 'limit' => (string) $limite], $query);
        $qs = http_build_query($params);
        if ($desde !== '') {
            $qs .= '&creado_en=gte.' . rawurlencode($desde);
        }
        if ($hasta !== '') {
            $qs .= '&creado_en=lte.' . rawurlencode($hasta);
        }

        [$status, $data] = $this->sb->rest('GET', 'auditoria_acciones', $qs);
        if ($status >= 400 || !is_array($data)) {
            return [];
        }
        return $data;
    }
}
