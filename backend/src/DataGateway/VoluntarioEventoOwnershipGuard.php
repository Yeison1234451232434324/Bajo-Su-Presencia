<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Exceptions\ApiException;
use App\Supabase\SupabaseClient;

/**
 * RT-03 — Restringe la escritura de 'voluntarios_eventos' para el rol
 * Voluntario a lo que realmente le corresponde: unirse a un evento como SÍ
 * MISMO e indicar su propia disponibilidad. Nada más.
 *
 * Relación de propiedad: `voluntarios_eventos.usuario_id` referencia
 * `usuarios.id` (mismo esquema que `actividades.voluntario_id`, ver
 * {@see ActividadOwnershipGuard}), que es el mismo id emitido como `sub`
 * del JWT.
 *
 * A diferencia de `actividades` (identificada siempre por `id`), el único
 * flujo funcional descrito en el código para esta tabla
 * (`VoluntariosModel.setDisponibilidad`, `voluntarios.model.js`) filtra por
 * `evento_id`+`usuario_id`, no por `id` — así que aquí se acepta cualquiera
 * de los dos patrones de filtro para resolver el propietario, sin asumir
 * uno solo.
 *
 * - POST: el `usuario_id` del body debe ser el propio (se rechaza, no se
 *   sobrescribe en silencio). `evento_id` y `disponible` son legítimos
 *   (unirse a un evento e indicar disponibilidad); `rol_en_evento` solo se
 *   tolera VACÍO (null/''): el cliente lo envía en null para un voluntario
 *   general, pero fijarse una especialidad NO le corresponde (la asigna
 *   Admin/Colaborador, `eventos.model.js`).
 * - PATCH/PUT: solo el campo `disponible`, y solo sobre su propio registro
 *   (por `id` o por `usuario_id` en el filtro).
 * - DELETE: solo su PROPIA inscripción (cancelarla, `EventosModel.
 *   cancelarInscripcion`): el filtro debe llevar `usuario_id=eq.<su id>`.
 *   Sin ese filtro, o con el de otro usuario, se rechaza.
 *
 * @package App\DataGateway
 */
final class VoluntarioEventoOwnershipGuard implements OwnershipGuardInterface
{
    public function __construct(
        private readonly SupabaseClient $sb,
        private readonly PostgrestQuery $query
    ) {
    }

    /**
     * @param array<string,mixed> $body
     * @throws ApiException 403 si crea/edita/elimina para otro usuario, toca
     *         un campo no permitido, o elimina · 404 si el registro no existe.
     */
    public function assertPermitido(string $method, string $query, array $body, string $miId): void
    {
        if ($method === 'DELETE') {
            // Cancelar la propia inscripción: borra filas filtradas por su usuario_id.
            $usuarioIdFiltro = $this->query->eqFilterParam($query, 'usuario_id');
            if ($usuarioIdFiltro === null) {
                throw ApiException::forbidden('Solo puedes cancelar tu propia inscripción.');
            }
            if ($usuarioIdFiltro !== $miId) {
                throw ApiException::forbidden('No puedes cancelar la inscripción de otro usuario.');
            }
            return;
        }

        if ($method === 'POST') {
            $usuarioId = isset($body['usuario_id']) ? (string) $body['usuario_id'] : null;
            if ($usuarioId !== $miId) {
                throw ApiException::forbidden('No puedes inscribir a otro usuario en un evento.');
            }
            // `rol_en_evento` vacío (null/'') se ignora: es lo que envía el cliente para un
            // voluntario general. Con valor, se rechaza (lo asigna el staff).
            $rol = $body['rol_en_evento'] ?? null;
            if (array_key_exists('rol_en_evento', $body) && ($rol === null || $rol === '')) {
                unset($body['rol_en_evento']);
            }
            if (array_diff(array_keys($body), ['evento_id', 'usuario_id', 'disponible']) !== []) {
                throw ApiException::forbidden('Solo puedes indicar el evento y tu disponibilidad.');
            }
            $this->assertEventoAbierto(isset($body['evento_id']) ? (string) $body['evento_id'] : '');
            return;
        }

        // PATCH/PUT: whitelist de campos.
        if (array_diff(array_keys($body), ['disponible']) !== []) {
            throw ApiException::forbidden('Un voluntario solo puede actualizar su disponibilidad.');
        }

        // Resuelve el propietario del/de los registro(s) afectados, aceptando
        // el filtro por `id` (como el resto del gateway) o por `usuario_id`
        // directo (como usa el único flujo funcional real de esta tabla).
        $usuarioIdFiltro = $this->query->eqFilterParam($query, 'usuario_id');
        if ($usuarioIdFiltro !== null) {
            if ($usuarioIdFiltro !== $miId) {
                throw ApiException::forbidden('No puedes modificar la inscripción de otro usuario.');
            }
            return;
        }

        $id = $this->query->idFilterParam($query);
        if ($id === null) {
            throw ApiException::forbidden('Operación no permitida sin identificar el registro.');
        }

        $filas = $this->sb->select('voluntarios_eventos', ['id' => 'eq.' . $id], 'usuario_id');
        $fila  = $filas[0] ?? null;
        if ($fila === null) {
            throw new ApiException('Registro no encontrado.', 404);
        }
        if ((string) ($fila['usuario_id'] ?? '') !== $miId) {
            throw ApiException::forbidden('No puedes modificar la inscripción de otro usuario.');
        }
    }

    /**
     * Un voluntario solo puede inscribirse en eventos vigentes: ni cancelados
     * ni con fecha ya pasada. El estado "finalizado" se deriva de la fecha
     * (nunca se guarda), igual que en el frontend.
     *
     * @throws ApiException 403 si el evento está cerrado · 404 si no existe.
     */
    private function assertEventoAbierto(string $eventoId): void
    {
        if ($eventoId === '') {
            throw ApiException::forbidden('Debes indicar el evento.');
        }

        $evento = $this->sb->select('eventos', ['id' => 'eq.' . $eventoId], 'fecha,estado')[0] ?? null;
        if ($evento === null) {
            throw new ApiException('El evento no existe.', 404);
        }

        $hoy   = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d');
        $fecha = (string) ($evento['fecha'] ?? '');

        if (($evento['estado'] ?? '') === 'Cancelado' || ($fecha !== '' && $fecha < $hoy)) {
            throw ApiException::forbidden('Este evento ya no admite inscripciones.');
        }
    }
}
