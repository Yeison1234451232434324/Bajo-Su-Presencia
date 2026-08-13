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
     *   - embed_select   : proyecciones EXACTAS permitidas cuando esta tabla
     *                      aparece EMBEBIDA dentro del `select` de OTRA tabla
     *                      (p. ej. `eventos?select=...,informes(...)`). Es
     *                      independiente de `read`/`read_select`: una tabla
     *                      puede exigir rol de staff para acceso directo y
     *                      aun así permitir una proyección mínima (p. ej. solo
     *                      el nombre) cuando se la embebe desde una tabla
     *                      pública — ver `validarEmbeds()`. Ausente o vacío =
     *                      NUNCA embebible (fail-closed): hay que declararlo
     *                      explícitamente antes de usarlo desde el frontend.
     *
     * IMPORTANTE: el `select` de PostgREST puede pedir columnas o incluso
     * tablas relacionadas ("embeds") no previstas por el módulo que originó
     * la petición, y esta pasarela usa la `service_role key` (que salta RLS).
     * Por eso las tablas con datos sensibles deben declarar `read` y, si
     * corresponde, `read_select`, en lugar de confiar en que el frontend
     * jamás pida más columnas de las que muestra su interfaz. Y por la misma
     * razón, CUALQUIER tabla que aparezca embebida dentro del `select` —a
     * cualquier profundidad de anidamiento— se valida contra `embed_select`
     * de la tabla embebida, sin importar cuál sea la tabla del path ni el rol
     * del solicitante: ver `validarEmbeds()`, invocado para TODO GET.
     *
     * @var array<string,array{write:string[],read?:string[],read_select?:string[],embed_select?:string[],public_read?:bool,public_insert?:bool}>
     */
    private const TABLES = [
        'recursos'               => [
            'write'        => ['Administrador', 'Colaborador'],
            // Embebida dentro de evento_recursos (eventos.model.js) y en las
            // asignaciones de recursos por evento (recursos.model.js).
            'embed_select' => ['nombre, unidad'],
        ],
        'evento_recursos'        => [
            'write'        => ['Administrador', 'Colaborador'],
            // Embebida dentro de eventos (eventos.model.js).
            'embed_select' => ['recurso_id, cantidad, recursos(nombre, unidad)'],
        ],
        'actividades'            => ['write' => ['Administrador', 'Colaborador', 'Voluntario']],
        // Datos financieros por evento: antes sin `read` (cualquier
        // autenticado la leía completa) y alcanzable además vía embed desde
        // `eventos` (tabla pública) — las dos vulnerabilidades confirmadas en
        // la auditoría de la Fase 5. `read` la restringe a quienes ya pueden
        // escribirla; no declara `embed_select`, así que embeberla desde
        // cualquier otra tabla queda bloqueado (no hay un uso legítimo hoy).
        'informes'               => [
            'write' => ['Administrador', 'Colaborador'],
            'read'  => ['Administrador', 'Colaborador'],
        ],
        'calificaciones_eventos' => ['write' => ['Administrador', 'Colaborador']],
        'evaluaciones'           => ['write' => ['Administrador', 'Colaborador']],
        'voluntarios_eventos'    => [
            'write'        => ['Administrador', 'Colaborador', 'Voluntario'],
            // Dos proyecciones legítimas distintas, verificadas por lectura
            // exacta del código (Fase 5.6, corrige regresión de la Fase 5C):
            //  - eventos.model.js: sin `disponible` (no lo necesita esa vista).
            //  - voluntarios.model.js (SEL_EV): con `disponible`, usada por
            //    "Calificar Voluntarios" y "Mi Disponibilidad". Ambas incluyen
            //    a su vez el embed (ya acotado) hacia usuarios.
            'embed_select' => [
                'usuario_id, rol_en_evento, usuarios(nombre:nombre_completo)',
                'usuario_id, rol_en_evento, disponible, usuarios(nombre:nombre_completo)',
            ],
        ],
        // Contenido visible en el sitio público (lectura anónima):
        'eventos'                => [
            'write'        => ['Administrador', 'Colaborador'],
            'public_read'  => true,
            // Embebida dentro de informes/evaluaciones de voluntarios
            // (reportes.model.js, voluntarios.model.js): solo el título.
            'embed_select' => ['titulo'],
        ],
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
        // El mismo string mínimo es lo único embebible desde CUALQUIER otra
        // tabla (noticias, actividades, pqr, informes, reportes, voluntarios).
        'usuarios' => [
            'write'        => [],
            'read'         => ['Administrador', 'Colaborador'],
            'read_select'  => ['id,nombre:nombre_completo'],
            'embed_select' => ['nombre:nombre_completo'],
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

        // Cualquier tabla embebida dentro del `select` (a cualquier nivel de
        // anidamiento) debe estar en su lista blanca `embed_select` — sin
        // importar cuál sea la tabla del path, su rol de `read`, ni si la
        // petición es pública. Esto es lo que impide que una tabla pública
        // (eventos, noticias, oraciones) se use como puerta de entrada hacia
        // tablas sensibles (informes, usuarios, ...) vía
        // `select=...,tabla_sensible(...)`. Se aplica a TODO GET, incluidos
        // los ya autorizados arriba: la autorización de la tabla del path no
        // dice nada sobre qué tablas relacionadas es seguro exponer.
        if ($method === 'GET') {
            $select = $select ?? $this->selectParam($query);
            if ($select !== null) {
                $this->validarEmbeds($select);
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
     * Valida TODAS las relaciones embebidas de un `select` de PostgREST,
     * a cualquier profundidad de anidamiento, contra la lista blanca
     * `embed_select` de cada tabla embebida (ver comentario de `TABLES`).
     *
     * Fail-closed: una tabla embebida que no exista en `TABLES`, o cuya
     * proyección no coincida EXACTAMENTE (tras normalizar espacios) con una
     * de las cadenas declaradas en su `embed_select`, rechaza toda la
     * petición — sin importar qué tan inocua parezca el resto del `select`.
     *
     * @throws ApiException 403 si alguna relación embebida no está autorizada.
     */
    private function validarEmbeds(string $select): void
    {
        foreach ($this->extraerEmbeds($select) as $embed) {
            $tablaEmbebida = $embed['tabla'];
            $cfgEmbebida   = self::TABLES[$tablaEmbebida] ?? null;
            $permitidos    = $cfgEmbebida['embed_select'] ?? [];

            $normalizado          = $this->normalizarSelect($embed['inner']);
            $permitidosNormalizados = array_map([$this, 'normalizarSelect'], $permitidos);

            if ($cfgEmbebida === null || !in_array($normalizado, $permitidosNormalizados, true)) {
                throw ApiException::forbidden('No tienes permisos para consultar este recurso.');
            }
        }
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
    private function extraerEmbeds(string $select): array
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
    private function normalizarSelect(string $select): string
    {
        return preg_replace('/\s+/', '', $select) ?? $select;
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
