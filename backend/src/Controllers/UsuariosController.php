<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Services\UsuariosService;
use App\Support\AuditLogger;
use Throwable;

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
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        $correoNuevo = (string) ($request->input('email', '') ?: $request->input('correo', ''));
        try {
            $row = $this->service->create($request->all());
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'crear',
                'usuarios',
                null,
                "Intentó crear el usuario \"{$correoNuevo}\" (la operación falló).",
                'error'
            );
            throw $e;
        }
        AuditLogger::registrar(
            $claims,
            'crear',
            'usuarios',
            isset($row['id']) ? (string) $row['id'] : null,
            "Creó el usuario \"{$correoNuevo}\"."
        );
        Response::success($row, 'Usuario creado.', 201);
    }

    /**
     * PUT /api/usuarios/{id} — actualiza un usuario.
     *
     * @param array<string,string> $args
     */
    public function update(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        try {
            $row = $this->service->update($args['id'], $request->all());
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'editar',
                'usuarios',
                $args['id'] ?? null,
                'Intentó editar un usuario (la operación falló).',
                'error'
            );
            throw $e;
        }
        $identificador = $row['correo_electronico'] ?? $row['username'] ?? $args['id'];
        AuditLogger::registrar($claims, 'editar', 'usuarios', $args['id'] ?? null, "Editó el usuario \"{$identificador}\".");
        Response::success($row, 'Usuario actualizado.');
    }

    /**
     * PATCH /api/usuarios/{id}/activo — alterna activo/inactivo.
     *
     * @param array<string,string> $args
     */
    public function toggleActivo(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        try {
            $nuevo = $this->service->toggleActivo($args['id']);
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'activar_desactivar',
                'usuarios',
                $args['id'] ?? null,
                'Intentó cambiar el estado activo/inactivo de un usuario (la operación falló).',
                'error'
            );
            throw $e;
        }
        AuditLogger::registrar(
            $claims,
            $nuevo ? 'activar' : 'desactivar',
            'usuarios',
            $args['id'] ?? null,
            ($nuevo ? 'Activó' : 'Desactivó') . " el usuario con id \"{$args['id']}\"."
        );
        Response::success(['activo' => $nuevo], 'Estado actualizado.');
    }

    /**
     * DELETE /api/usuarios/{id} — elimina un usuario.
     *
     * @param array<string,string> $args
     */
    public function destroy(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        try {
            $this->service->remove($args['id']);
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'eliminar',
                'usuarios',
                $args['id'] ?? null,
                'Intentó eliminar un usuario (la operación falló).',
                'error'
            );
            throw $e;
        }
        AuditLogger::registrar($claims, 'eliminar', 'usuarios', $args['id'] ?? null, "Eliminó el usuario con id \"{$args['id']}\".");
        Response::success(null, 'Usuario eliminado.');
    }
}
