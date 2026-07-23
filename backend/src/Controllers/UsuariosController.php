<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Services\UsuariosService;

/**
 * Controlador del módulo Usuarios (CRUD).
 *
 * Todos los endpoints exigen un JWT válido con rol `Administrador`. Delega la
 * lógica en {@see UsuariosService} y devuelve filas crudas para que el modelo
 * del frontend conserve su propio mapeo.
 *
 * @package App\Controllers
 */
final class UsuariosController
{
    /** Roles autorizados a gestionar usuarios. */
    private const ROLES = ['Administrador'];

    private readonly UsuariosService $service;

    public function __construct(?UsuariosService $service = null)
    {
        $this->service = $service ?? new UsuariosService();
    }

    /**
     * GET /api/usuarios — lista de usuarios.
     *
     * @param array<string,string> $args
     */
    public function index(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        Response::success($this->service->list());
    }

    /**
     * GET /api/usuarios/especialistas — usuarios activos con especialidad.
     *
     * @param array<string,string> $args
     */
    public function especialistas(Request $request, array $args): void
    {
        AuthMiddleware::authenticate($request); // cualquier usuario autenticado
        Response::success($this->service->especialistas());
    }

    /**
     * GET /api/usuarios/mi-perfil — perfil del usuario autenticado (cualquier rol).
     * Usa el id del JWT (sub), así cada quien solo ve SU propio perfil.
     *
     * @param array<string,string> $args
     */
    public function miPerfil(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authenticate($request);
        $id = (string) ($claims['sub'] ?? '');
        Response::success($this->service->get($id));
    }

    /**
     * PUT /api/usuarios/mi-perfil — actualiza el perfil propio (cualquier rol).
     * No permite cambiar el rol ni la contraseña.
     *
     * @param array<string,string> $args
     */
    public function actualizarMiPerfil(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authenticate($request);
        $id = (string) ($claims['sub'] ?? '');
        Response::success($this->service->updateOwnProfile($id, $request->all()), 'Perfil actualizado.');
    }

    /**
     * GET /api/usuarios/{id} — detalle de un usuario.
     *
     * @param array<string,string> $args
     */
    public function show(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        Response::success($this->service->get($args['id']));
    }

    /**
     * POST /api/usuarios — crea un usuario.
     *
     * @param array<string,string> $args
     */
    public function store(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        Response::success($this->service->create($request->all()), 'Usuario creado.', 201);
    }

    /**
     * PUT /api/usuarios/{id} — actualiza un usuario.
     *
     * @param array<string,string> $args
     */
    public function update(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        Response::success($this->service->update($args['id'], $request->all()), 'Usuario actualizado.');
    }

    /**
     * PATCH /api/usuarios/{id}/activo — alterna activo/inactivo.
     *
     * @param array<string,string> $args
     */
    public function toggleActivo(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        Response::success(['activo' => $this->service->toggleActivo($args['id'])], 'Estado actualizado.');
    }

    /**
     * DELETE /api/usuarios/{id} — elimina un usuario.
     *
     * @param array<string,string> $args
     */
    public function destroy(Request $request, array $args): void
    {
        AuthMiddleware::authorize($request, self::ROLES);
        $this->service->remove($args['id']);
        Response::success(null, 'Usuario eliminado.');
    }
}
