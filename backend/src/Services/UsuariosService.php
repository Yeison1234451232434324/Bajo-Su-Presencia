<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Repositories\UserRepository;
use App\Supabase\SupabaseClient;
use App\Validation\Validator;

/**
 * Lógica de negocio del módulo Usuarios (CRUD).
 *
 * Crea cuentas mediante la API de administración de Supabase Auth y mantiene el
 * perfil en la tabla `usuarios`. Esquema certificado: columnas snake_case sin
 * tildes; la especialidad se sincroniza en el catálogo N:M
 * usuario_especialidades (ya no es una columna de usuarios).
 *
 * @package App\Services
 */
final class UsuariosService
{
    private readonly UserRepository $users;
    private readonly SupabaseClient $sb;

    public function __construct(?UserRepository $users = null, ?SupabaseClient $sb = null)
    {
        $this->users = $users ?? new UserRepository();
        $this->sb    = $sb    ?? new SupabaseClient();
    }

    /**
     * Lista todos los usuarios (filas crudas con embed de rol).
     *
     * @return array<int,array<string,mixed>>
     */
    public function list(): array
    {
        return $this->users->all();
    }

    /**
     * Obtiene un usuario por id.
     *
     * @return array<string,mixed>
     * @throws ApiException 404 si no existe.
     */
    public function get(string $id): array
    {
        $user = $this->users->findById($id);
        if ($user === null) {
            throw new ApiException('Usuario no encontrado.', 404);
        }
        return $user;
    }

    /**
     * Crea un usuario: cuenta en Auth + perfil en `usuarios`.
     *
     * @param array<string,mixed> $data Datos del formulario.
     * @return array<string,mixed> Fila resultante.
     */
    public function create(array $data): array
    {
        $email    = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation(['email' => 'Correo electrónico inválido.']);
        }
        if (strlen($password) < 6) {
            throw ApiException::validation(['password' => 'La contraseña debe tener al menos 6 caracteres.']);
        }

        // 1) Crear la cuenta en Auth (servicio). El trigger crea la fila base.
        [$nombres, $apellidos] = $this->splitNombre($data);
        $authId = $this->sb->authAdminCreateUser($email, $password, [
            'nombres'   => $nombres ?? '',
            'apellidos' => $apellidos ?? '',
        ]);

        // 2) Completar el perfil por auth_id.
        $fields = $this->mapFields($data);
        $fields['activo'] = true;
        $row = $this->users->updateByAuthId($authId, $fields);

        // 3) Sincronizar la especialidad en el catálogo N:M.
        if ($row !== null && isset($row['id']) && array_key_exists('especialidad', $data)) {
            $this->users->replaceEspecialidad((string) $row['id'], (string) ($data['especialidad'] ?? ''));
            $row = $this->users->findById((string) $row['id']) ?? $row;
        }

        return $row ?? ['id' => null, 'auth_id' => $authId, 'correo_electronico' => $email];
    }

    /**
     * Actualiza el perfil de un usuario.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     * @throws ApiException 404 si no existe.
     */
    public function update(string $id, array $data): array
    {
        // Cambio de contraseña OPCIONAL: solo si el formulario envía una nueva.
        $password = (string) ($data['password'] ?? '');
        if ($password !== '') {
            if (strlen($password) < 6) {
                throw ApiException::validation(['password' => 'La contraseña debe tener al menos 6 caracteres.']);
            }
            $user   = $this->users->findById($id);
            $authId = $user['auth_id'] ?? null;
            if (!$authId) {
                throw new ApiException('El usuario no tiene cuenta de acceso para cambiar la contraseña.', 400);
            }
            $this->sb->authAdminUpdatePassword((string) $authId, $password);
        }

        $row = $this->users->updateById($id, $this->mapFields($data));
        if ($row === null) {
            throw new ApiException('Usuario no encontrado.', 404);
        }
        if (array_key_exists('especialidad', $data)) {
            $this->users->replaceEspecialidad($id, (string) ($data['especialidad'] ?? ''));
            $row = $this->users->findById($id) ?? $row;
        }
        return $row;
    }

    /**
     * Actualiza el perfil PROPIO del usuario (autoservicio). No cambia el rol ni
     * la contraseña, aunque vengan en los datos.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     * @throws ApiException 404 si no existe.
     */
    public function updateOwnProfile(string $id, array $data): array
    {
        $fields = $this->mapFields($data);
        unset($fields['rol_id']);    // el usuario no puede cambiar su propio rol
        unset($fields['username']);  // ni su nombre de usuario (lo usa para entrar)

        $row = $this->users->updateById($id, $fields);
        if ($row === null) {
            throw new ApiException('Usuario no encontrado.', 404);
        }
        if (array_key_exists('especialidad', $data)) {
            $this->users->replaceEspecialidad($id, (string) ($data['especialidad'] ?? ''));
            $row = $this->users->findById($id) ?? $row;
        }
        return $row;
    }

    /**
     * Alterna el estado activo/inactivo y devuelve el nuevo valor.
     *
     * @throws ApiException 404 si no existe.
     */
    public function toggleActivo(string $id): bool
    {
        $user = $this->users->findById($id);
        if ($user === null) {
            throw new ApiException('Usuario no encontrado.', 404);
        }
        $nuevo = !(($user['activo'] ?? true) !== false);
        $this->users->setActivo($id, $nuevo);
        return $nuevo;
    }

    /**
     * Elimina la fila del usuario.
     */
    public function remove(string $id): void
    {
        $this->users->delete($id);
    }

    /**
     * Especialistas: usuarios activos con al menos una especialidad
     * en el catálogo N:M usuario_especialidades.
     *
     * @return array<int,array<string,mixed>>
     */
    public function especialistas(): array
    {
        $esEspecialistaActivo = static fn(array $u): bool =>
            ($u['activo'] ?? true) !== false
            && !empty($u['usuario_especialidades']);

        return array_values(array_filter($this->users->all(), $esEspecialistaActivo));
    }

    /**
     * Mapea los campos de la app a las columnas de la tabla `usuarios`.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function mapFields(array $data): array
    {
        [$nombres, $apellidos] = $this->splitNombre($data);
        $fields = [
            'nombres'   => $nombres,
            'apellidos' => $apellidos,
            'username'  => ($data['username'] ?? '') ?: null,
            'rol_id'    => $this->users->roleIdByName($data['rol'] ?? null),
            // Validación de servidor: normaliza y exige 10 dígitos exactos.
            // No puede omitirse aunque el cliente salte la validación del DOM.
            'telefono'  => Validator::telefono($data['telefono'] ?? null),
            'ubicacion' => ($data['ubicacion'] ?? '') ?: null,
            'ocupacion' => ($data['ocupacion'] ?? '') ?: null,
            'bio'       => ($data['bio'] ?? '') ?: null,
        ];
        // La foto solo se actualiza si el formulario la envía (perfil propio).
        if (array_key_exists('foto', $data)) {
            $fields['foto_url'] = ($data['foto'] ?? '') ?: null;
        }
        return $fields;
    }

    /**
     * Resuelve los hechos atómicos nombres/apellidos del payload.
     *
     * Prefiere los campos nuevos (`nombres`, `apellidos`). Si solo llega el
     * legado `nombre` (nombre completo en un campo), lo divide con la misma
     * heurística hispana de la migración (fase 15): 2 palabras → 1+1,
     * 3 → 1+2, 4+ → (n-2)+2. Con una sola palabra no se fabrican apellidos.
     *
     * @param array<string,mixed> $data
     * @return array{0:?string,1:?string} [nombres, apellidos]
     */
    private function splitNombre(array $data): array
    {
        if (array_key_exists('nombres', $data)) {
            $nombres   = trim((string) ($data['nombres'] ?? ''));
            $apellidos = trim((string) ($data['apellidos'] ?? ''));
            return [$nombres !== '' ? $nombres : null, $apellidos !== '' ? $apellidos : null];
        }

        $completo = trim(preg_replace('/\s+/u', ' ', (string) ($data['nombre'] ?? '')) ?? '');
        if ($completo === '') {
            return [null, null];
        }

        $t = explode(' ', $completo);
        $n = count($t);
        if ($n >= 4) {
            return [implode(' ', array_slice($t, 0, $n - 2)), implode(' ', array_slice($t, $n - 2))];
        }
        if ($n === 3) {
            return [$t[0], $t[1] . ' ' . $t[2]];
        }
        if ($n === 2) {
            return [$t[0], $t[1]];
        }
        return [$completo, null];
    }
}
