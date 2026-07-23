<?php

declare(strict_types=1);

namespace App\Supabase;

use App\Config\Env;
use App\Exceptions\ApiException;
use App\Support\Logger;

/**
 * Cliente HTTP para la API de Supabase.
 *
 * Encapsula el acceso a dos servicios REST de Supabase:
 *  - **GoTrue** (`/auth/v1`): autenticación por correo/contraseña y refresco de
 *    sesión.
 *  - **PostgREST** (`/rest/v1`): lectura/escritura de tablas. Las operaciones
 *    administrativas (p. ej. registro de intentos de login) usan la
 *    `service_role key`, que vive SOLO en el servidor.
 *
 * Toda la comunicación se realiza con cURL sobre HTTPS.
 *
 * @package App\Supabase
 */
final class SupabaseClient
{
    private readonly string $url;
    private readonly string $anonKey;
    private readonly string $serviceKey;
    private readonly Logger $logger;

    public function __construct(?Logger $logger = null)
    {
        $this->url        = rtrim((string) Env::get('SUPABASE_URL', ''), '/');
        $this->anonKey    = (string) Env::get('SUPABASE_ANON_KEY', '');
        $this->serviceKey = (string) Env::get('SUPABASE_SERVICE_KEY', '');
        $this->logger     = $logger ?? new Logger();

        if ($this->url === '' || $this->anonKey === '') {
            throw new ApiException('Configuración de Supabase incompleta.', 500);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  AUTENTICACIÓN (GoTrue)
    // ──────────────────────────────────────────────────────────────────

    /**
     * Valida credenciales contra Supabase Auth.
     *
     * @param string $email    Correo del usuario.
     * @param string $password Contraseña en claro (se envía por TLS).
     * @return array<string,mixed>|null Sesión de Supabase (access_token,
     *         refresh_token, user) o `null` si las credenciales son inválidas.
     */
    public function signInWithPassword(string $email, string $password): ?array
    {
        [$status, $data] = $this->request(
            'POST',
            $this->url . '/auth/v1/token?grant_type=password',
            ['apikey' => $this->anonKey, 'Content-Type' => 'application/json'],
            ['email' => $email, 'password' => $password]
        );

        if ($status === 200 && isset($data['access_token'])) {
            return $data;
        }
        // 400/401 → credenciales inválidas (no se filtra el detalle al cliente).
        return null;
    }

    /**
     * Renueva la sesión a partir de un refresh token de Supabase.
     *
     * @return array<string,mixed>|null Nueva sesión o `null` si el token es inválido.
     */
    public function refreshSession(string $refreshToken): ?array
    {
        [$status, $data] = $this->request(
            'POST',
            $this->url . '/auth/v1/token?grant_type=refresh_token',
            ['apikey' => $this->anonKey, 'Content-Type' => 'application/json'],
            ['refresh_token' => $refreshToken]
        );

        return ($status === 200 && isset($data['access_token'])) ? $data : null;
    }

    // ──────────────────────────────────────────────────────────────────
    //  ACCESO A DATOS (PostgREST con service_role)
    // ──────────────────────────────────────────────────────────────────

    /**
     * SELECT sobre una tabla.
     *
     * @param string               $table  Nombre de la tabla.
     * @param array<string,string> $query  Filtros PostgREST (p. ej.
     *                                      ['correo_electronico' => 'eq.a@b.com']).
     * @param string               $select Columnas (`*` o lista/embeds).
     * @return array<int,array<string,mixed>> Filas encontradas.
     */
    public function select(string $table, array $query = [], string $select = '*'): array
    {
        $params = array_merge(['select' => $select], $query);
        $url    = $this->url . '/rest/v1/' . rawurlencode($table) . '?' . http_build_query($params);

        [$status, $data] = $this->request('GET', $url, $this->serviceHeaders());

        if ($status >= 400) {
            throw new ApiException('Error consultando la base de datos.', 502);
        }
        return is_array($data) ? $data : [];
    }

    /**
     * INSERT o UPSERT (cuando `$upsertOnConflict` indica columnas de conflicto).
     *
     * @param string               $table            Tabla destino.
     * @param array<string,mixed>  $row              Fila a insertar.
     * @param string|null          $upsertOnConflict Columna(s) para upsert.
     * @return array<string,mixed> Fila resultante.
     */
    public function insert(string $table, array $row, ?string $upsertOnConflict = null): array
    {
        $url     = $this->url . '/rest/v1/' . rawurlencode($table);
        $headers = $this->serviceHeaders();
        $prefer  = ['return=representation'];

        if ($upsertOnConflict !== null) {
            $url .= '?on_conflict=' . rawurlencode($upsertOnConflict);
            $prefer[] = 'resolution=merge-duplicates';
        }
        $headers['Prefer'] = implode(',', $prefer);

        [$status, $data] = $this->request('POST', $url, $headers, $row);

        if ($status >= 400) {
            throw new ApiException('Error escribiendo en la base de datos.', 502);
        }
        return is_array($data) && isset($data[0]) ? $data[0] : (array) $data;
    }

    /**
     * UPDATE sobre filas que cumplan los filtros.
     *
     * @param string               $table   Tabla destino.
     * @param array<string,mixed>  $changes Cambios a aplicar.
     * @param array<string,string> $query   Filtros PostgREST.
     * @return array<int,array<string,mixed>> Filas actualizadas.
     */
    public function update(string $table, array $changes, array $query): array
    {
        $url     = $this->url . '/rest/v1/' . rawurlencode($table) . '?' . http_build_query($query);
        $headers = $this->serviceHeaders();
        $headers['Prefer'] = 'return=representation';

        [$status, $data] = $this->request('PATCH', $url, $headers, $changes);

        if ($status >= 400) {
            throw new ApiException('Error actualizando la base de datos.', 502);
        }
        return is_array($data) ? $data : [];
    }

    /**
     * DELETE sobre filas que cumplan los filtros.
     *
     * @param string               $table Tabla destino.
     * @param array<string,string> $query Filtros PostgREST (obligatorios).
     */
    public function delete(string $table, array $query): void
    {
        if ($query === []) {
            throw new ApiException('Eliminación sin filtros no permitida.', 400);
        }
        $url = $this->url . '/rest/v1/' . rawurlencode($table) . '?' . http_build_query($query);

        [$status] = $this->request('DELETE', $url, $this->serviceHeaders());
        if ($status >= 400) {
            throw new ApiException('Error eliminando en la base de datos.', 502);
        }
    }

    /**
     * Crea una cuenta en Supabase Auth mediante la API de administración.
     *
     * Requiere la `service_role key`. El correo queda confirmado de inmediato.
     *
     * @param array<string,mixed> $metadata Metadatos de usuario (p. ej. nombre).
     * @return string ID de la cuenta creada (auth_id).
     * @throws ApiException 409 si el correo ya existe; 502 ante otros errores.
     */
    public function authAdminCreateUser(string $email, string $password, array $metadata = []): string
    {
        [$status, $data] = $this->request(
            'POST',
            $this->url . '/auth/v1/admin/users',
            $this->serviceHeaders(),
            [
                'email'         => $email,
                'password'      => $password,
                'email_confirm' => true,
                'user_metadata' => $metadata,
            ]
        );

        if ($status === 422 || $status === 409) {
            throw new ApiException('El correo electrónico ya está registrado.', 409);
        }
        if ($status >= 400 || !isset($data['id'])) {
            throw new ApiException('No se pudo crear la cuenta de acceso.', 502);
        }
        return (string) $data['id'];
    }

    /**
     * Cambia la contraseña de una cuenta vía la API de administración de Auth.
     *
     * @param string $authId   ID de la cuenta en auth.users (usuarios.auth_id).
     * @param string $password Nueva contraseña en claro (viaja por TLS).
     * @throws ApiException 502 si la operación falla.
     */
    public function authAdminUpdatePassword(string $authId, string $password): void
    {
        [$status] = $this->request(
            'PUT',
            $this->url . '/auth/v1/admin/users/' . rawurlencode($authId),
            $this->serviceHeaders(),
            ['password' => $password]
        );
        if ($status >= 400) {
            throw new ApiException('No se pudo actualizar la contraseña.', 502);
        }
    }

    /**
     * Passthrough genérico a PostgREST (usado por el Data Gateway).
     *
     * Reenvía un método HTTP con su query string ya en formato PostgREST y un
     * cuerpo opcional, usando la `service_role key`.
     *
     * @param array<string,mixed>|null $body
     * @param string[]                 $prefer Cabeceras Prefer (p. ej. return=representation).
     * @return array{0:int,1:mixed} [códigoHttp, datos].
     */
    public function rest(string $method, string $table, string $query, ?array $body = null, array $prefer = []): array
    {
        $url     = $this->url . '/rest/v1/' . rawurlencode($table) . ($query !== '' ? '?' . $query : '');
        $headers = $this->serviceHeaders();
        if ($prefer !== []) {
            $headers['Prefer'] = implode(',', $prefer);
        }
        return $this->request($method, $url, $headers, $body);
    }

    // ──────────────────────────────────────────────────────────────────
    //  INTERNOS
    // ──────────────────────────────────────────────────────────────────

    /**
     * Cabeceras de servicio (saltan RLS; solo uso en el servidor).
     *
     * @return array<string,string>
     */
    private function serviceHeaders(): array
    {
        return [
            'apikey'        => $this->serviceKey,
            'Authorization' => 'Bearer ' . $this->serviceKey,
            'Content-Type'  => 'application/json',
        ];
    }

    /**
     * Ejecuta una petición HTTP con cURL.
     *
     * @param array<string,string> $headers
     * @param array<string,mixed>|null $body
     * @return array{0:int,1:mixed} Tupla [códigoHttp, cuerpoDecodificado].
     */
    private function request(string $method, string $url, array $headers, ?array $body = null): array
    {
        // Un método vacío haría que cURL emplease GET de forma silenciosa,
        // convirtiendo por ejemplo un borrado en una lectura sin aviso alguno.
        if ($method === '') {
            throw new ApiException('Método HTTP no válido.', 500);
        }

        $ch = curl_init($url);
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        $options = [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headerLines,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];
        if ($body !== null) {
            // json_encode() devuelve false ante datos no codificables (por
            // ejemplo UTF-8 mal formado). Sin esta comprobación se enviaba
            // `false` como cuerpo, que cURL convierte en la cadena vacía: la
            // petición viajaba SIN datos y el fallo se manifestaba después,
            // lejos de su origen. Se detecta aquí y se falla de inmediato.
            $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $options[CURLOPT_POSTFIELDS] = $payload;
        }
        curl_setopt_array($ch, $options);

        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0) {
            $this->logger->error('Fallo de red con Supabase', ['url' => $url, 'curl' => $error]);
            throw new ApiException('No se pudo contactar el servicio de datos.', 502);
        }

        $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        return [$status, $decoded];
    }
}
