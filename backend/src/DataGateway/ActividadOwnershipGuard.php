<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Exceptions\ApiException;
use App\Supabase\SupabaseClient;

/**
 * RT-02 — Restringe la escritura de 'actividades' para el rol Voluntario a lo
 * que realmente le corresponde: marcar su PROPIA actividad como
 * completada/pendiente. Nada más.
 *
 * Relación de propiedad confirmada en el esquema (`fase05_llaves.sql`):
 * `actividades.voluntario_id` referencia DIRECTAMENTE `usuarios.id`, sin
 * tabla intermedia — y ese mismo id es el que `AuthService::login()` emite
 * como `sub` del JWT (`'id' => $profile['id']` de `usuarios`). La
 * comparación es directa, sin resolver ninguna relación adicional.
 *
 * Crear y eliminar quedan bloqueados por completo para este rol (el frontend
 * del voluntario nunca los usa: `voluntario.actividades.controller.js` solo
 * llama a `toggleCompletada`). En PATCH/PUT, cualquier campo que no sea
 * `completada` se rechaza — así no puede reasignarse la actividad
 * (`voluntario_id`) ni tocar `nombre`/`descripcion`/`prioridad`.
 *
 * Limitación conocida y aceptada: la verificación de propiedad y el `UPDATE`
 * no son atómicos; dado que solo un Administrador puede reasignar
 * actividades y es una operación humana poco frecuente, el riesgo de esa
 * ventana de carrera es despreciable y no justifica una transacción o un
 * bloqueo adicional.
 *
 * @package App\DataGateway
 */
final class ActividadOwnershipGuard implements OwnershipGuardInterface
{
    public function __construct(
        private readonly SupabaseClient $sb,
        private readonly PostgrestQuery $query
    ) {
    }

    /**
     * @param array<string,mixed> $body
     * @throws ApiException 403 si crea/elimina, toca un campo fuera de
     *         `completada`, o la actividad no es suya · 404 si no existe.
     */
    public function assertPermitido(string $method, string $query, array $body, string $miId): void
    {
        if ($method === 'POST' || $method === 'DELETE') {
            throw ApiException::forbidden('Un voluntario no puede crear ni eliminar actividades.');
        }

        if (array_diff(array_keys($body), ['completada']) !== []) {
            throw ApiException::forbidden('Un voluntario solo puede marcar sus actividades como completadas.');
        }

        $id = $this->query->idFilterParam($query);
        if ($id === null) {
            throw ApiException::forbidden('Operación no permitida sin un identificador de actividad.');
        }

        $filas     = $this->sb->select('actividades', ['id' => 'eq.' . $id], 'voluntario_id');
        $actividad = $filas[0] ?? null;
        if ($actividad === null) {
            throw new ApiException('Actividad no encontrada.', 404);
        }
        if ((string) ($actividad['voluntario_id'] ?? '') !== $miId) {
            throw ApiException::forbidden('No puedes modificar actividades de otro voluntario.');
        }
    }
}
