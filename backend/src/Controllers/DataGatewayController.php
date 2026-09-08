<?php

declare(strict_types=1);

namespace App\Controllers;

use App\DataGateway\ActividadOwnershipGuard;
use App\DataGateway\EmbedAccessValidator;
use App\DataGateway\GatewayAuditor;
use App\DataGateway\OwnershipGuardInterface;
use App\DataGateway\PostgrestQuery;
use App\DataGateway\PqrWriteGuard;
use App\DataGateway\TableAccessPolicy;
use App\DataGateway\VoluntarioEventoOwnershipGuard;
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
 * REFACTOR SOLID: esta clase era originalmente una única clase de ~700
 * líneas que mezclaba política de acceso (qué tabla/rol/columna), parseo de
 * PostgREST, dos reglas de ownership distintas (RT-02/RT-03), las reglas de
 * escritura de PQR (RT-04/RT-05), auditoría y el despacho HTTP. Se dividió en
 * colaboradores de una sola responsabilidad (namespace `App\DataGateway`):
 *   - {@see TableAccessPolicy}      — SRP: solo conoce la lista blanca.
 *   - {@see PostgrestQuery}         — SRP: solo parsea query strings PostgREST.
 *   - {@see EmbedAccessValidator}   — SRP: solo valida relaciones embebidas.
 *   - {@see OwnershipGuardInterface} — abstracción (DIP) de la que dependen
 *     {@see ActividadOwnershipGuard} y {@see VoluntarioEventoOwnershipGuard};
 *     agregar ownership para una tabla nueva es registrar un guard nuevo, sin
 *     tocar esta clase (OCP).
 *   - {@see PqrWriteGuard}          — SRP: reglas de escritura de PQR.
 *   - {@see GatewayAuditor}         — SRP: solo describe la operación para
 *     el registro de auditoría.
 * Esta clase queda como orquestador delgado: decide EN QUÉ ORDEN se
 * consultan esos colaboradores para una petición HTTP dada, sin conocer el
 * detalle de cómo cada uno decide lo suyo.
 *
 * @package App\Controllers
 */
final class DataGatewayController
{
    private readonly SupabaseClient $sb;
    private readonly TableAccessPolicy $policy;
    private readonly PostgrestQuery $query;
    private readonly EmbedAccessValidator $embeds;
    private readonly PqrWriteGuard $pqrGuard;
    private readonly GatewayAuditor $auditor;

    /** @var array<string,OwnershipGuardInterface> Guard de ownership por tabla, solo para escrituras del rol Voluntario. */
    private readonly array $ownershipGuards;

    /**
     * @param array<string,OwnershipGuardInterface>|null $ownershipGuards Permite
     *        registrar/sustituir guards de ownership sin tocar esta clase (OCP).
     */
    public function __construct(
        ?SupabaseClient $sb = null,
        ?TableAccessPolicy $policy = null,
        ?PostgrestQuery $query = null,
        ?EmbedAccessValidator $embeds = null,
        ?PqrWriteGuard $pqrGuard = null,
        ?GatewayAuditor $auditor = null,
        ?array $ownershipGuards = null
    ) {
        $this->sb       = $sb ?? new SupabaseClient();
        $this->policy   = $policy ?? new TableAccessPolicy();
        $this->query    = $query ?? new PostgrestQuery();
        $this->embeds   = $embeds ?? new EmbedAccessValidator($this->policy, $this->query);
        $this->pqrGuard = $pqrGuard ?? new PqrWriteGuard($this->sb, $this->query);
        $this->auditor  = $auditor ?? new GatewayAuditor($this->query);

        $this->ownershipGuards = $ownershipGuards ?? [
            // RT-02
            'actividades'         => new ActividadOwnershipGuard($this->sb, $this->query),
            // RT-03
            'voluntarios_eventos' => new VoluntarioEventoOwnershipGuard($this->sb, $this->query),
        ];
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
        if (!$this->policy->existe($table)) {
            throw ApiException::forbidden('Recurso no permitido.');
        }
        $method = $request->method();

        // ¿Esta lectura está abierta al público (sin JWT)? Ninguna tabla
        // declara ya `public_insert` (RT-01: se eliminó de 'pqr', la única
        // que lo tenía) — la creación pública pasa siempre por un controller
        // dedicado (`PqrController::crear`), nunca por este gateway genérico.
        $isPublic = $method === 'GET' && $this->policy->esLecturaPublica($table);

        // Las operaciones no públicas requieren autenticación.
        $claims = $isPublic ? [] : AuthMiddleware::authenticate($request);
        $rol    = (string) ($claims['rol'] ?? '');

        // Las escrituras exigen un rol autorizado.
        $isWrite = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true);
        if ($isWrite && !$this->policy->puedeEscribir($table, $rol)) {
            throw ApiException::forbidden('No tienes permisos para modificar este recurso.');
        }

        // Se toma de la capa HTTP en lugar de leer $_SERVER directamente: así
        // el controlador es probable sin simular el entorno del servidor.
        $queryString = $request->queryString();

        // RT-02 / RT-03 — Ownership: el chequeo de arriba (tabla+rol) autoriza
        // a Voluntario a escribir 'actividades'/'voluntarios_eventos' en
        // general, pero no distingue de QUIÉN es cada fila. Cada guard
        // registrado resuelve esa distinción para su propia tabla (OCP: una
        // tabla nueva con ownership solo requiere un guard nuevo).
        if ($isWrite && $rol === 'Voluntario' && isset($this->ownershipGuards[$table])) {
            $this->ownershipGuards[$table]->assertPermitido(
                $method,
                $queryString,
                $request->all(),
                (string) ($claims['sub'] ?? '')
            );
        }

        // RT-05 — edición directa de PQR bloqueada por completo en el gateway.
        if ($isWrite && $table === 'pqr' && in_array($method, ['PATCH', 'PUT'], true)) {
            $this->pqrGuard->assertEdicionPermitida();
        }

        // RT-04 — defensa en profundidad (nunca alcanzado hoy, ver PqrWriteGuard).
        if ($isWrite && $table === 'pqr' && in_array($method, ['PATCH', 'PUT'], true)) {
            $this->pqrGuard->assertNoResuelta($queryString);
        }

        // Lecturas NO públicas: si la tabla restringe `read`, el usuario debe
        // tener uno de esos roles, salvo que el `select` solicitado coincida
        // EXACTAMENTE con uno de los patrones inofensivos de `read_select`.
        $select        = null;
        $lecturaAbierta = $this->policy->rolesDeLectura($table) === null || $this->policy->puedeLeer($table, $rol);
        if (!$isPublic && $method === 'GET' && !$lecturaAbierta) {
            $select           = $this->query->selectParam($queryString);
            $selectPermitido  = $select !== null
                && in_array($select, $this->policy->selectsDeLecturaAbiertos($table), true);
            if (!$selectPermitido) {
                throw ApiException::forbidden('No tienes permisos para consultar este recurso.');
            }
        }

        // Cualquier tabla embebida dentro del `select` (a cualquier nivel de
        // anidamiento) debe estar en su lista blanca `embed_select` — sin
        // importar cuál sea la tabla del path, su rol de `read`, ni si la
        // petición es pública. Se aplica a TODO GET.
        if ($method === 'GET') {
            $select ??= $this->query->selectParam($queryString);
            if ($select !== null) {
                $this->embeds->validar($select);
            }
        }

        switch ($method) {
            case 'GET':
                [$status, $data] = $this->sb->rest('GET', $table, $queryString);
                break;
            case 'POST':
                [$status, $data] = $this->sb->rest('POST', $table, $queryString, $request->all(), ['return=representation']);
                break;
            case 'PUT':
            case 'PATCH':
                [$status, $data] = $this->sb->rest('PATCH', $table, $queryString, $request->all(), ['return=representation']);
                break;
            case 'DELETE':
                [$status, $data] = $this->sb->rest('DELETE', $table, $queryString);
                break;
            default:
                throw new ApiException('Método no permitido.', 405);
        }

        // Auditoría: solo escrituras hechas por un usuario autenticado (nunca
        // el POST público, que no existe hoy en este gateway — $claims
        // estaría vacío si lo hubiera). El Data Gateway es el único punto de
        // entrada de la mayoría de las escrituras administrativas, así que
        // centralizar aquí el registro cubre todas ellas.
        if ($isWrite && $claims !== []) {
            $this->auditor->registrar($method, $table, $queryString, $request->all(), $claims, $status, $data);
        }

        if ($status >= 400) {
            throw new ApiException('Error en la operación de datos.', 502);
        }
        Response::success(is_array($data) ? $data : []);
    }
}
