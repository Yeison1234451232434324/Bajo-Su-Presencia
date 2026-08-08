<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Services\AuditoriaService;

/**
 * Controlador del módulo Auditoría (solo lectura).
 *
 * Expone únicamente GET: los registros los escribe el backend en el punto
 * donde ocurre cada acción ({@see \App\Support\AuditLogger}), nunca a
 * petición del cliente. Todos los endpoints exigen JWT con rol
 * `Administrador` — un usuario sin ese rol no puede ver la bitácora.
 *
 * @package App\Controllers
 */
final class AuditoriaController
{
    /** Roles autorizados a consultar la auditoría. */
    private const ROLES = ['Administrador'];

    private readonly AuditoriaService $service;

    public function __construct(?AuditoriaService $service = null)
    {
        $this->service = $service ?? new AuditoriaService();
    }

    /**
     * GET /api/auditoria — lista registros de auditoría con filtros opcionales.
     *
     * Filtros por query string: usuario, modulo, accion, resultado, desde
     * (fecha ISO), hasta (fecha ISO), limite.
     *
     * @param array<string,string> $args
     */
    public function index(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);

        parse_str($request->queryString(), $filtros);
        /** @var array<string,string> $filtros */
        Response::success($this->service->listar($filtros));
    }
}
