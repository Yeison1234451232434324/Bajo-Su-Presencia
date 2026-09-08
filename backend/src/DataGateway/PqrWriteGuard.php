<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Exceptions\ApiException;
use App\Supabase\SupabaseClient;

/**
 * RT-04 / RT-05 — Reglas de escritura de 'pqr' específicas del Data Gateway,
 * separadas de {@see \App\Controllers\DataGatewayController} por
 * responsabilidad única.
 *
 * RT-05: la edición de 'pqr' (PATCH/PUT) queda bloqueada por completo en el
 * Data Gateway, para Administrador y Colaborador incluidos. Causa: este
 * gateway reenvía el body sin ninguna whitelist, así que
 * `estado`/`respuesta`/`respondido_por_id`/`respondido_en` podían
 * modificarse sin la lógica que sí aplica `PqrController` (timestamp y autor
 * reales, notificación por correo, descripción de auditoría específica).
 * Auditado: ningún flujo del frontend usa PATCH/PUT vía este gateway para
 * editar PQR. La única vía válida pasa a ser
 * `PqrController::responder()`/`cambiarEstado()`.
 *
 * RT-04: una PQR "Resuelto" es de solo lectura. Con RT-05 ya bloqueando todo
 * PATCH/PUT, este segundo chequeo nunca se alcanza en la práctica — se
 * conserva intacto como defensa en profundidad, por si en el futuro se
 * reabriera cualquier camino de escritura sobre esta tabla.
 *
 * Fail-closed por diseño: SOLO se permite continuar cuando la query string
 * trae EXACTAMENTE un filtro `id=eq.<valor>` y ningún otro filtro sobre
 * `id`. Cierra un vector encontrado en el propio Red Team: una primera
 * versión de este chequeo solo reconocía `id=eq.`, así que un filtro
 * `id=neq.<uuid al azar>` no coincidía y se dejaba pasar como "sin id" —
 * pero en PostgREST ese filtro afecta a TODAS las demás filas de la tabla.
 *
 * @package App\DataGateway
 */
final class PqrWriteGuard
{
    public function __construct(
        private readonly SupabaseClient $sb,
        private readonly PostgrestQuery $query
    ) {
    }

    /** @throws ApiException 403 edición directa bloqueada (RT-05). */
    public function assertEdicionPermitida(): void
    {
        throw ApiException::forbidden(
            'La edición directa de PQR mediante el Data Gateway no está permitida. Utilice el endpoint oficial de PQR.'
        );
    }

    /**
     * @throws ApiException 400 si el filtro no es un único `id=eq.<valor>` ·
     *         409 si la PQR objetivo ya está resuelta.
     */
    public function assertNoResuelta(string $query): void
    {
        if ($this->query->countIdFilters($query) !== 1) {
            throw new ApiException('Esta operación requiere identificar una única PQR mediante su id.', 400);
        }

        $id = $this->query->idFilterParam($query);
        if ($id === null) {
            throw new ApiException('Filtro no soportado para esta operación.', 400);
        }

        $filas = $this->sb->select('pqr', ['id' => 'eq.' . $id], 'estado');
        $fila  = $filas[0] ?? null;
        if ($fila !== null && ($fila['estado'] ?? '') === 'Resuelto') {
            throw new ApiException(
                'Esta PQR ya fue marcada como resuelta: no se puede responder ni cambiar su estado. '
                . 'Solo puede eliminarse.',
                409
            );
        }
    }
}
