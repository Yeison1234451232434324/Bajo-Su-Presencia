<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Env;
use App\Http\Request;
use App\Http\Response;
use App\Supabase\SupabaseClient;
use App\Support\Logger;
use Throwable;

/**
 * Endpoint de diagnóstico operativo.
 *
 * Pensado para sondas de disponibilidad (balanceadores, monitorización) y para
 * el diagnóstico rápido de incidencias.
 *
 * Principio de diseño: informa del ESTADO, nunca de la CONFIGURACIÓN. No
 * revela URLs, claves, versiones exactas de dependencias, rutas del sistema de
 * archivos ni mensajes de error internos, porque este endpoint es público y
 * esos datos facilitarían el reconocimiento a un atacante.
 *
 * @package App\Controllers
 */
final class HealthController
{
    /** Umbral en milisegundos a partir del cual una dependencia se considera degradada. */
    private const UMBRAL_LENTITUD_MS = 2000;

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * Sonda superficial: responde si el proceso PHP está vivo.
     *
     * No consulta dependencias externas, por lo que es apta para sondas de
     * alta frecuencia sin generar carga sobre la base de datos.
     */
    public function live(Request $request): void
    {
        Response::success(['estado' => 'vivo'], 'Servicio activo.');
    }

    /**
     * Sonda profunda: comprueba la aplicación y sus dependencias.
     *
     * Devuelve HTTP 200 si todo está operativo y HTTP 503 si alguna
     * dependencia esencial falla, para que un balanceador pueda retirar la
     * instancia del reparto de tráfico automáticamente.
     */
    public function ready(Request $request): void
    {
        $comprobaciones = [
            'base_datos'      => $this->comprobarBaseDatos(),
            'almacenamiento'  => $this->comprobarAlmacenamiento(),
            'correo'          => $this->comprobarCorreo(),
            'configuracion'   => $this->comprobarConfiguracion(),
        ];

        $degradado = false;
        $caido     = false;
        foreach ($comprobaciones as $c) {
            if ($c['estado'] === 'caido') {
                $caido = true;
            } elseif ($c['estado'] === 'degradado') {
                $degradado = true;
            }
        }

        $estadoGlobal = $caido ? 'caido' : ($degradado ? 'degradado' : 'operativo');

        $carga = [
            'estado'        => $estadoGlobal,
            'version'       => $this->version(),
            'commit'        => $this->commit(),
            'entorno'       => Env::get('APP_ENV', 'production'),
            'php'           => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'marca_tiempo'  => gmdate('c'),
            'solicitud_id'  => Logger::requestId(),
            'comprobaciones' => $comprobaciones,
        ];

        // 503 permite a la infraestructura reaccionar sin leer el cuerpo.
        Response::success($carga, 'Diagnóstico completado.', $caido ? 503 : 200);
    }

    /**
     * Verifica la conectividad con la base de datos mediante una consulta
     * mínima (un registro de la tabla de roles, la más pequeña del esquema).
     *
     * @return array{estado:string,latencia_ms:int}
     */
    private function comprobarBaseDatos(): array
    {
        $inicio = microtime(true);
        try {
            [$status] = $this->sb->rest('GET', 'roles', 'select=id&limit=1');
            $ms = (int) round((microtime(true) - $inicio) * 1000);

            if ($status >= 400) {
                return ['estado' => 'caido', 'latencia_ms' => $ms];
            }
            return [
                'estado'      => $ms > self::UMBRAL_LENTITUD_MS ? 'degradado' : 'operativo',
                'latencia_ms' => $ms,
            ];
        } catch (Throwable $e) {
            // El detalle va al log; al cliente solo el estado.
            (new Logger())->error('Health: fallo de base de datos', ['error' => $e->getMessage()]);
            return ['estado' => 'caido', 'latencia_ms' => (int) round((microtime(true) - $inicio) * 1000)];
        }
    }

    /**
     * Comprueba que el directorio de logs exista y admita escritura.
     * Sin él, el sistema perdería toda la trazabilidad de forma silenciosa.
     *
     * @return array{estado:string,escritura:bool}
     */
    private function comprobarAlmacenamiento(): array
    {
        $dir = dirname(__DIR__, 2) . '/logs';
        $ok  = is_dir($dir) && is_writable($dir);

        return ['estado' => $ok ? 'operativo' : 'degradado', 'escritura' => $ok];
    }

    /**
     * Comprueba que el envío de correo esté configurado. No envía nada: un
     * health check no debe producir efectos secundarios.
     *
     * @return array{estado:string,configurado:bool}
     */
    private function comprobarCorreo(): array
    {
        $configurado = (string) Env::get('MAIL_USERNAME', '') !== ''
            && (string) Env::get('MAIL_APP_PASSWORD', '') !== '';

        // Degradado y no caído: sin correo el sistema funciona, pero la
        // recuperación de contraseña queda inoperativa.
        return ['estado' => $configurado ? 'operativo' : 'degradado', 'configurado' => $configurado];
    }

    /**
     * Verifica que las variables críticas estén presentes y que el secreto de
     * firma tenga la longitud mínima exigida. Nunca expone sus valores.
     *
     * @return array{estado:string,faltantes:int}
     */
    private function comprobarConfiguracion(): array
    {
        $requeridas = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
        $faltantes  = 0;
        foreach ($requeridas as $clave) {
            if ((string) Env::get($clave, '') === '') {
                $faltantes++;
            }
        }
        $secretoDebil = strlen((string) Env::get('JWT_SECRET', '')) < 32;

        return [
            'estado'    => ($faltantes > 0 || $secretoDebil) ? 'caido' : 'operativo',
            'faltantes' => $faltantes,
        ];
    }

    /** Versión de la aplicación, tomada de VERSION si existe. */
    private function version(): string
    {
        $archivo = dirname(__DIR__, 2) . '/VERSION';
        if (is_readable($archivo)) {
            $v = trim((string) file_get_contents($archivo));
            if ($v !== '') {
                return $v;
            }
        }
        return 'desconocida';
    }

    /**
     * Commit desplegado, si el despliegue lo registró.
     *
     * Se lee de un archivo generado en el despliegue y no ejecutando `git`:
     * invocar comandos del sistema desde una petición HTTP pública sería un
     * riesgo innecesario, y en producción no suele existir el repositorio.
     */
    private function commit(): string
    {
        $archivo = dirname(__DIR__, 2) . '/COMMIT';
        if (is_readable($archivo)) {
            $c = trim((string) file_get_contents($archivo));
            if ($c !== '') {
                return substr($c, 0, 12);
            }
        }
        return 'desconocido';
    }
}
