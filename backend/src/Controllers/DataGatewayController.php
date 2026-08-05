<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Supabase\SupabaseClient;

/**
 * Data Gateway — acceso genérico y controlado a tablas de Supabase.
 *
 * Centraliza en PHP el acceso a datos del panel (módulos autenticados). Todas
 * las operaciones exigen un JWT válido; las escrituras, además, un rol
 * autorizado. Las tablas no incluidas en la lista blanca se rechazan.
 *
 * Reenvía la query string (ya en formato PostgREST que arma el cliente JS) a
 * Supabase usando la `service_role key`, por lo que la autorización vive aquí.
 *
 * Nota: las páginas PÚBLICAS (home, formulario de PQR) NO usan este gateway;
 * siguen leyendo de Supabase con acceso anónimo para no depender del backend.
 *
 * @package App\Controllers
 */
final class DataGatewayController
{
    /**
     * Lista blanca de tablas y roles de escritura permitidos.
     * `read` => true significa "cualquier usuario autenticado".
     *
     * Claves por tabla:
     *   - write          : roles autorizados a escribir (POST/PATCH/PUT/DELETE).
     *   - public_read    : si true, GET no requiere autenticación (home público).
     *   - public_insert  : si true, POST no requiere autenticación (PQR público).
     *   (la lectura autenticada está permitida para cualquier tabla listada).
     *
     * @var array<string,array{write:string[],public_read?:bool,public_insert?:bool}>
     */
    private const TABLES = [
        'recursos'               => ['write' => ['Administrador', 'Colaborador']],
        'evento_recursos'        => ['write' => ['Administrador', 'Colaborador']],
        'actividades'            => ['write' => ['Administrador', 'Colaborador', 'Voluntario']],
        'informes'               => ['write' => ['Administrador', 'Colaborador']],
        'calificaciones_eventos' => ['write' => ['Administrador', 'Colaborador']],
        'evaluaciones'           => ['write' => ['Administrador', 'Colaborador']],
        'voluntarios_eventos'    => ['write' => ['Administrador', 'Colaborador', 'Voluntario']],
        // Contenido visible en el sitio público (lectura anónima):
        'eventos'                => ['write' => ['Administrador', 'Colaborador'], 'public_read' => true],
        'noticias'               => ['write' => ['Administrador', 'Colaborador'], 'public_read' => true],
        'oraciones'              => ['write' => ['Administrador', 'Colaborador'], 'public_read' => true],
        'sedes'                  => ['write' => ['Administrador', 'Colaborador'], 'public_read' => true],
        // PQR: cualquiera puede radicar (insertar); solo el panel gestiona:
        'pqr'                    => ['write' => ['Administrador', 'Colaborador'], 'public_insert' => true],
        // Solo lectura desde el panel:
        'usuarios'               => ['write' => []],
        'roles'                  => ['write' => []],
    ];

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * Atiende GET/POST/PATCH/PUT/DELETE sobre /api/db/{table}.
     *
     * @param array<string,string> $args Parámetros de ruta (`table`).
     * @throws ApiException 403 tabla/rol no permitido · 502 error de datos.
     */
    public function handle(Request $request, array $args): void
    {
        $table = $args['table'] ?? '';
        if (!isset(self::TABLES[$table])) {
            throw ApiException::forbidden('Recurso no permitido.');
        }
        $cfg    = self::TABLES[$table];
        $method = $request->method();

        // ¿Esta operación está abierta al público (sin JWT)?
        $publicGet    = $method === 'GET'  && ($cfg['public_read'] ?? false);
        $publicInsert = $method === 'POST' && ($cfg['public_insert'] ?? false);
        $isPublic     = $publicGet || $publicInsert;

        // Las operaciones no públicas requieren autenticación.
        $claims = $isPublic ? [] : AuthMiddleware::authenticate($request);

        // Las escrituras NO públicas exigen un rol autorizado.
        $isWrite = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true);
        if ($isWrite && !$publicInsert) {
            $rol = (string) ($claims['rol'] ?? '');
            if ($cfg['write'] === [] || !in_array($rol, $cfg['write'], true)) {
                throw ApiException::forbidden('No tienes permisos para modificar este recurso.');
            }
        }

        // Se toma de la capa HTTP en lugar de leer $_SERVER directamente: así
        // el controlador es probable sin simular el entorno del servidor.
        $query = $request->queryString();

        switch ($method) {
            case 'GET':
                [$status, $data] = $this->sb->rest('GET', $table, $query);
                break;
            case 'POST':
                [$status, $data] = $this->sb->rest('POST', $table, $query, $request->all(), ['return=representation']);
                break;
            case 'PUT':
            case 'PATCH':
                [$status, $data] = $this->sb->rest('PATCH', $table, $query, $request->all(), ['return=representation']);
                break;
            case 'DELETE':
                [$status, $data] = $this->sb->rest('DELETE', $table, $query);
                break;
            default:
                throw new ApiException('Método no permitido.', 405);
        }

        if ($status >= 400) {
            throw new ApiException('Error en la operación de datos.', 502);
        }
        Response::success(is_array($data) ? $data : []);
    }
}
