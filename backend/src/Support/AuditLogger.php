<?php

declare(strict_types=1);

namespace App\Support;

use App\Supabase\SupabaseClient;
use Throwable;

/**
 * Registro de auditoría de acciones administrativas.
 *
 * Inserta en `public.auditoria_acciones` con la `service_role key` (mismo
 * cliente que usa el resto del backend para escribir datos). Es de "mejor
 * esfuerzo", igual criterio que {@see Mailer} para los correos de PQR y
 * donaciones: un fallo al registrar la auditoría NUNCA debe interrumpir ni
 * revertir la operación administrativa que se está auditando. Se registra en
 * el log de aplicación y se continúa.
 *
 * Captura la identidad del actor (id/correo/rol) desde los claims del JWT en
 * el momento de la acción — no la resuelve con un join al listar, para que el
 * registro histórico no cambie si el usuario edita su correo o es eliminado
 * más adelante, y para no añadir una consulta extra por fila al listar.
 *
 * @package App\Support
 */
final class AuditLogger
{
    /**
     * Registra una acción administrativa.
     *
     * @param array<string,mixed> $claims      Claims del JWT del actor (sub, rol, correo).
     * @param string               $accion      Verbo de la acción ('crear', 'editar', 'eliminar', ...).
     * @param string               $modulo      Módulo/tabla afectada.
     * @param string|null          $registroId  Id (uuid) del registro afectado, si existe y es válido.
     * @param string               $descripcion Descripción legible de la acción (se acota a 500 caracteres).
     * @param string               $resultado   'exito' o 'error'.
     */
    public static function registrar(
        array $claims,
        string $accion,
        string $modulo,
        ?string $registroId,
        string $descripcion,
        string $resultado = 'exito'
    ): void {
        try {
            $sb = new SupabaseClient();
            $sb->insert('auditoria_acciones', [
                'usuario_id'     => self::esUuid((string) ($claims['sub'] ?? '')) ? $claims['sub'] : null,
                'usuario_correo' => $claims['correo'] ?? null,
                'usuario_rol'    => $claims['rol'] ?? null,
                'accion'         => $accion,
                'modulo'         => $modulo,
                'registro_id'    => $registroId !== null && self::esUuid($registroId) ? $registroId : null,
                'descripcion'    => mb_substr($descripcion, 0, 500),
                'resultado'      => $resultado === 'error' ? 'error' : 'exito',
            ]);
        } catch (Throwable $e) {
            // No se relanza: un fallo de auditoría no puede tumbar la
            // operación real (misma filosofía que el envío de correos).
            (new Logger())->warning('No se pudo registrar la auditoría', [
                'modulo' => $modulo,
                'accion' => $accion,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    /** Valida el formato UUID antes de enviarlo a una columna `uuid` (evita 400 de PostgREST). */
    private static function esUuid(string $valor): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $valor) === 1;
    }
}
