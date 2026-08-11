<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Supabase\SupabaseClient;

/**
 * Acceso a datos de la tabla `usuarios` vía PostgREST.
 *
 * Devuelve las filas tal cual (incluyendo los embeds `roles(nombre)` y
 * `usuario_especialidades(especialidades(nombre))`) para que el frontend
 * conserve su propio mapeo. Esquema certificado: columnas snake_case sin
 * tildes; la especialidad vive en el catálogo N:M usuario_especialidades.
 *
 * @package App\Repositories
 */
final class UserRepository
{
    /** Columnas devueltas, con rol y especialidades embebidos. */
    private const SELECT = '*,roles(nombre),usuario_especialidades(especialidades(nombre))';

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * Busca un usuario por correo (usado por el login).
     *
     * @return array<string,mixed>|null
     */
    public function findByEmail(string $email): ?array
    {
        $rows = $this->sb->select(
            'usuarios',
            ['correo_electronico' => 'eq.' . $email, 'limit' => '1'],
            self::SELECT
        );
        return $rows[0] ?? null;
    }

    /**
     * Busca un usuario por su nombre de usuario (case-insensitive).
     *
     * @return array<string,mixed>|null
     */
    public function findByUsername(string $username): ?array
    {
        // Escapa los comodines de PostgREST (%, _) para que el valor se trate
        // como texto literal y no permita ampliar la coincidencia (p. ej. un
        // atacante enviando "%" para intentar enumerar/adivinar usuarios).
        $literal = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $username);
        $rows    = $this->sb->select(
            'usuarios',
            ['username' => 'ilike.' . $literal, 'limit' => '1'],
            self::SELECT
        );
        return $rows[0] ?? null;
    }

    /**
     * Lista todos los usuarios ordenados por nombre.
     *
     * @return array<int,array<string,mixed>>
     */
    public function all(): array
    {
        return $this->sb->select('usuarios', ['order' => 'nombre_completo.asc'], self::SELECT);
    }

    /**
     * Busca un usuario por su id.
     *
     * @return array<string,mixed>|null
     */
    public function findById(string $id): ?array
    {
        $rows = $this->sb->select('usuarios', ['id' => 'eq.' . $id, 'limit' => '1'], self::SELECT);
        return $rows[0] ?? null;
    }

    /**
     * Resuelve el id de un rol por su nombre.
     */
    public function roleIdByName(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }
        $rows = $this->sb->select('roles', ['nombre' => 'eq.' . $name, 'limit' => '1'], 'id');
        return isset($rows[0]['id']) ? (string) $rows[0]['id'] : null;
    }

    /**
     * Actualiza el perfil de un usuario por su `auth_id` (tras crearlo en Auth).
     *
     * @param array<string,mixed> $fields
     * @return array<string,mixed>|null
     */
    public function updateByAuthId(string $authId, array $fields): ?array
    {
        $rows = $this->sb->update('usuarios', $fields, ['auth_id' => 'eq.' . $authId]);
        return $rows[0] ?? null;
    }

    /**
     * Actualiza el perfil de un usuario por su id.
     *
     * @param array<string,mixed> $fields
     * @return array<string,mixed>|null
     */
    public function updateById(string $id, array $fields): ?array
    {
        $rows = $this->sb->update('usuarios', $fields, ['id' => 'eq.' . $id]);
        return $rows[0] ?? null;
    }

    /**
     * Activa o desactiva un usuario.
     */
    public function setActivo(string $id, bool $activo): void
    {
        $this->sb->update('usuarios', ['activo' => $activo], ['id' => 'eq.' . $id]);
    }

    /**
     * Elimina la fila de un usuario.
     */
    public function delete(string $id): void
    {
        $this->sb->delete('usuarios', ['id' => 'eq.' . $id]);
    }

    /**
     * Reemplaza la especialidad del usuario en el catálogo N:M.
     * Con null o cadena vacía solo elimina la relación existente.
     * Si el nombre no está en el catálogo, lo agrega (lista abierta a admin).
     */
    public function replaceEspecialidad(string $usuarioId, ?string $nombre): void
    {
        $this->sb->delete('usuario_especialidades', ['usuario_id' => 'eq.' . $usuarioId]);

        $nombre = trim((string) $nombre);
        if ($nombre === '') {
            return;
        }

        $rows = $this->sb->select('especialidades', ['nombre' => 'eq.' . $nombre, 'limit' => '1'], 'id');
        $espId = $rows[0]['id'] ?? null;
        if ($espId === null) {
            $ins   = $this->sb->insert('especialidades', ['nombre' => $nombre]);
            $espId = $ins[0]['id'] ?? null;
        }
        if ($espId !== null) {
            $this->sb->insert('usuario_especialidades', [
                'usuario_id'      => $usuarioId,
                'especialidad_id' => $espId,
            ]);
        }
    }
}
