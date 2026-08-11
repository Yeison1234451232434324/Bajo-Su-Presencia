<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Support\AuditLogger;
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
     * Lista blanca de tablas y roles de escritura/lectura permitidos.
     *
     * Claves por tabla:
     *   - write          : roles autorizados a escribir (POST/PATCH/PUT/DELETE).
     *   - read           : roles autorizados a leer (GET) autenticados. Si se
     *                      omite, cualquier usuario autenticado puede leer
     *                      (usado solo para catálogos sin datos sensibles).
     *   - read_select    : cuando `read` está restringido, expresiones `select`
     *                      adicionales permitidas para CUALQUIER usuario
     *                      autenticado (aunque no tenga el rol de `read`),
     *                      para exponer solo columnas no sensibles a módulos
     *                      que las necesitan (p. ej. nombres para asignar
     *                      actividades). Cualquier otro valor de `select` es
     *                      rechazado para esos usuarios.
     *   - public_read    : si true, GET no requiere autenticación (home público).
     *   - public_insert  : si true, POST no requiere autenticación (PQR público).
     *
     * IMPORTANTE: el `select` de PostgREST puede pedir columnas o incluso
     * tablas relacionadas ("embeds") no previstas por el módulo que originó
     * la petición, y esta pasarela usa la `service_role key` (que salta RLS).
     * Por eso las tablas con datos sensibles deben declarar `read` y, si
     * corresponde, `read_select`, en lugar de confiar en que el frontend
     * jamás pida más columnas de las que muestra su interfaz.
     *
     * @var array<string,array{write:string[],read?:string[],read_select?:string[],public_read?:bool,public_insert?:bool}>
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
        // PQR: cualquiera puede radicar (insertar); solo el panel gestiona
        // (contiene datos de contacto de quien radica, no es de lectura libre):
        'pqr'                    => [
            'write'         => ['Administrador', 'Colaborador'],
            'read'          => ['Administrador', 'Colaborador'],
            'public_insert' => true,
        ],
        // Datos de cuenta (correo, rol, etc.): solo administración gestiona.
        // `actividades.model.js` necesita listar nombres de voluntarios para
        // asignarlos, así que se permite ese `select` puntual a cualquier
        // usuario autenticado sin exponer correo, teléfono ni demás columnas.
        'usuarios' => [
            'write'       => [],
            'read'        => ['Administrador', 'Colaborador'],
            'read_select' => ['id,nombre:nombre_completo'],
        ],
        'roles' => ['write' => [], 'read' => ['Administrador', 'Colaborador']],
        // Historial de donaciones: el backend inserta al procesar el pago
        // (DonacionesController); solo el panel admin lee y elimina.
        'donaciones' => ['write' => ['Administrador'], 'read' => ['Administrador']],
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
        $rol    = (string) ($claims['rol'] ?? '');

        // Las escrituras NO públicas exigen un rol autorizado.
        $isWrite = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true);
        if ($isWrite && !$publicInsert) {
            if ($cfg['write'] === [] || !in_array($rol, $cfg['write'], true)) {
                throw ApiException::forbidden('No tienes permisos para modificar este recurso.');
            }
        }

        // Se toma de la capa HTTP en lugar de leer $_SERVER directamente: así
        // el controlador es probable sin simular el entorno del servidor.
        $query = $request->queryString();

        // Lecturas NO públicas: si la tabla restringe `read`, el usuario debe
        // tener uno de esos roles, salvo que el `select` solicitado coincida
        // EXACTAMENTE con uno de los patrones inofensivos de `read_select`.
        // Esto evita que un usuario autenticado con un rol menor pida, vía
        // `select=*` u otro `select` no previsto, columnas o tablas
        // relacionadas ("embeds") fuera de lo que su módulo necesita — la
        // pasarela usa la `service_role key`, que ignora RLS por completo.
        if (!$isPublic && $method === 'GET' && isset($cfg['read']) && !in_array($rol, $cfg['read'], true)) {
            $select        = $this->selectParam($query);
            $selectPermitido = $select !== null && in_array($select, $cfg['read_select'] ?? [], true);
            if (!$selectPermitido) {
                throw ApiException::forbidden('No tienes permisos para consultar este recurso.');
            }
        }

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

        // Auditoría: solo escrituras hechas por un usuario autenticado (nunca
        // el POST público de `pqr`, donde $claims está vacío). El Data Gateway
        // es el único punto de entrada de la mayoría de las escrituras
        // administrativas (eventos, noticias, oraciones, actividades,
        // recursos, voluntarios_eventos, calificaciones_eventos,
        // evaluaciones, informes, sedes, pqr, donaciones), así que centralizar
        // aquí el registro cubre todas ellas sin repetir el código en cada
        // modelo del frontend ni en cada endpoint.
        if ($isWrite && $claims !== []) {
            $this->auditar($method, $table, $query, $request->all(), $claims, $status, $data);
        }

        if ($status >= 400) {
            throw new ApiException('Error en la operación de datos.', 502);
        }
        Response::success(is_array($data) ? $data : []);
    }

    /**
     * Registra en la auditoría una escritura hecha a través del gateway.
     *
     * @param array<string,mixed> $claims Claims del JWT del actor.
     * @param array<string,mixed> $body   Cuerpo enviado por el cliente.
     * @param mixed                $data  Respuesta de PostgREST (filas o null).
     */
    private function auditar(
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
     * Extrae el valor (decodificado) del parámetro `select` de una query
     * string cruda en formato PostgREST, o `null` si no está presente.
     */
    private function selectParam(string $query): ?string
    {
        if (preg_match('/(?:^|&)select=([^&]*)/', $query, $m) !== 1) {
            return null;
        }
        return urldecode($m[1]);
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
        if (preg_match('/(?:^|&)id=eq\.([^&]+)/', $query, $m) === 1) {
            return urldecode($m[1]);
        }
        return null;
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
