<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Support\AuditLogger;

/**
 * Registra en la auditoría del sistema las escrituras hechas a través del
 * Data Gateway — extraído de {@see \App\Controllers\DataGatewayController}
 * por responsabilidad única: el controlador orquesta la petición, esta clase
 * decide cómo describirla para el registro de auditoría.
 *
 * @package App\DataGateway
 */
final class GatewayAuditor
{
    private readonly PostgrestQuery $query;

    public function __construct(?PostgrestQuery $query = null)
    {
        $this->query = $query ?? new PostgrestQuery();
    }

    /**
     * @param array<string,mixed> $claims Claims del JWT del actor.
     * @param array<string,mixed> $body   Cuerpo enviado por el cliente.
     * @param mixed $data Respuesta de PostgREST (filas o null).
     */
    public function registrar(
        string $method,
        string $table,
        string $query,
        array $body,
        array $claims,
        int $status,
        $data
    ): void {
        $acciones = ['POST' => 'crear', 'PUT' => 'editar', 'PATCH' => 'editar', 'DELETE' => 'eliminar'];
        $accion   = $acciones[$method] ?? strtolower($method);
        $exito    = $status < 400;

        $registroId = $this->extraerRegistroId($query, $data);
        $rol        = (string) ($claims['rol'] ?? '');
        $correo     = (string) ($claims['correo'] ?? '');
        $verbo      = ['crear' => 'creó', 'editar' => 'editó', 'eliminar' => 'eliminó'][$accion] ?? $accion;
        $referencia = $this->identificarRegistro($body);

        $descripcion = trim("{$rol} ({$correo}) {$verbo} un registro en \"{$table}\"")
            . ($referencia !== null ? " — {$referencia}" : '')
            . ($exito ? '.' : ' (la operación falló).');

        AuditLogger::registrar($claims, $accion, $table, $registroId, $descripcion, $exito ? 'exito' : 'error');
    }

    /**
     * Extrae el id (uuid) del registro afectado: de la fila devuelta por
     * PostgREST (POST/PATCH con `return=representation`) o, si no hay cuerpo
     * de respuesta (DELETE), del filtro `id=eq.…` de la query string.
     *
     * @param mixed $data
     */
    private function extraerRegistroId(string $query, $data): ?string
    {
        if (is_array($data) && isset($data[0]) && is_array($data[0]) && isset($data[0]['id'])) {
            return (string) $data[0]['id'];
        }
        return $this->query->idFilterParam($query);
    }

    /**
     * Busca en el cuerpo enviado un campo identificador genérico (no asume
     * el esquema de ninguna tabla en particular: solo revisa los nombres de
     * campo más comunes entre los módulos del panel) para hacer la
     * descripción legible sin una consulta adicional.
     *
     * @param array<string,mixed> $body
     */
    private function identificarRegistro(array $body): ?string
    {
        foreach (['titulo', 'nombre', 'asunto', 'referencia', 'tipo'] as $campo) {
            $valor = $body[$campo] ?? null;
            if (is_string($valor) && trim($valor) !== '') {
                return '"' . mb_substr(trim($valor), 0, 120) . '"';
            }
        }
        return null;
    }
}
