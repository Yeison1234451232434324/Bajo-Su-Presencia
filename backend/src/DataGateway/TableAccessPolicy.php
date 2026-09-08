<?php

declare(strict_types=1);

namespace App\DataGateway;

/**
 * Lista blanca de tablas y roles del Data Gateway (antes una constante privada
 * dentro de {@see \App\Controllers\DataGatewayController}).
 *
 * Aislada en su propia clase por responsabilidad única (SRP): esta clase solo
 * conoce QUÉ tabla/rol/columna está permitida — no decide autenticación,
 * ownership, ni cómo se ejecuta la petición contra Supabase. Eso permite que
 * el controlador, los guards de ownership y el validador de embeds dependan
 * de esta política sin acoplarse entre sí (DIP).
 *
 * @package App\DataGateway
 */
final class TableAccessPolicy
{
    /**
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
     *   - embed_select   : proyecciones EXACTAS permitidas cuando esta tabla
     *                      aparece EMBEBIDA dentro del `select` de OTRA tabla
     *                      (p. ej. `eventos?select=...,informes(...)`). Es
     *                      independiente de `read`/`read_select`: una tabla
     *                      puede exigir rol de staff para acceso directo y
     *                      aun así permitir una proyección mínima (p. ej. solo
     *                      el nombre) cuando se la embebe desde una tabla
     *                      pública — ver {@see EmbedAccessValidator}. Ausente
     *                      o vacío = NUNCA embebible (fail-closed): hay que
     *                      declararlo explícitamente antes de usarlo desde el
     *                      frontend.
     *
     * IMPORTANTE: el `select` de PostgREST puede pedir columnas o incluso
     * tablas relacionadas ("embeds") no previstas por el módulo que originó
     * la petición, y esta pasarela usa la `service_role key` (que salta RLS).
     * Por eso las tablas con datos sensibles deben declarar `read` y, si
     * corresponde, `read_select`, en lugar de confiar en que el frontend
     * jamás pida más columnas de las que muestra su interfaz.
     *
     * @var array<string,array{write:string[],read?:string[],read_select?:string[],embed_select?:string[],public_read?:bool}>
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
        // PQR: la radicación pública NO se expone aquí a propósito (RT-01,
        // auditoría de seguridad) — ver PqrWriteGuard y PqrController::crear().
        'pqr'                    => [
            'write' => ['Administrador', 'Colaborador'],
            'read'  => ['Administrador', 'Colaborador'],
        ],
        // Datos de cuenta (correo, rol, etc.): solo administración gestiona.
        // `actividades.model.js` necesita listar nombres de voluntarios para
        // asignarlos, así que se permite ese `select` puntual a cualquier
        // usuario autenticado sin exponer correo, teléfono ni demás columnas.
        'usuarios' => [
            'write'        => [],
            'read'         => ['Administrador', 'Colaborador'],
            'read_select'  => ['id,nombre:nombre_completo'],
            'embed_select' => ['nombre:nombre_completo'],
        ],
        'roles' => ['write' => [], 'read' => ['Administrador', 'Colaborador']],
    ];

    public function existe(string $table): bool
    {
        return isset(self::TABLES[$table]);
    }

    public function esLecturaPublica(string $table): bool
    {
        return (bool) (self::TABLES[$table]['public_read'] ?? false);
    }

    public function puedeEscribir(string $table, string $rol): bool
    {
        $permitidos = self::TABLES[$table]['write'] ?? [];
        return $permitidos !== [] && in_array($rol, $permitidos, true);
    }

    /**
     * `null` = sin restricción de lectura declarada (cualquier autenticado puede leer).
     *
     * @return string[]|null
     */
    public function rolesDeLectura(string $table): ?array
    {
        return self::TABLES[$table]['read'] ?? null;
    }

    public function puedeLeer(string $table, string $rol): bool
    {
        $permitidos = $this->rolesDeLectura($table);
        return $permitidos === null || in_array($rol, $permitidos, true);
    }

    /** @return string[] `select` alternativos permitidos a cualquier autenticado aunque `read` lo restrinja. */
    public function selectsDeLecturaAbiertos(string $table): array
    {
        return self::TABLES[$table]['read_select'] ?? [];
    }

    /** @return string[] Proyecciones exactas permitidas cuando `$table` aparece embebida en otro `select`. */
    public function embedsPermitidos(string $table): array
    {
        return self::TABLES[$table]['embed_select'] ?? [];
    }
}
