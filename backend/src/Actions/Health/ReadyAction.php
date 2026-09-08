<?php

declare(strict_types=1);

namespace App\Actions\Health;

use App\Actions\Health\Checks\AlmacenamientoCheck;
use App\Actions\Health\Checks\AppVersion;
use App\Actions\Health\Checks\BaseDatosCheck;
use App\Actions\Health\Checks\ConfiguracionCheck;
use App\Actions\Health\Checks\CorreoCheck;
use App\Config\Env;
use App\Http\Request;
use App\Http\Response;
use App\Support\Logger;

/**
 * GET /api/health/ready — sonda profunda: comprueba la aplicación y sus
 * dependencias.
 *
 * Una clase por acción (antes uno de los métodos de
 * `App\Controllers\HealthController`). Devuelve HTTP 200 si todo está
 * operativo y HTTP 503 si alguna dependencia esencial falla, para que un
 * balanceador pueda retirar la instancia del reparto de tráfico
 * automáticamente. Orquesta las comprobaciones (cada una su propia clase de
 * responsabilidad única, ver `App\Actions\Health\Checks`) sin conocer su
 * detalle interno.
 *
 * @package App\Actions\Health
 */
final class ReadyAction
{
    public function __construct(
        private readonly BaseDatosCheck $baseDatos = new BaseDatosCheck(),
        private readonly AlmacenamientoCheck $almacenamiento = new AlmacenamientoCheck(),
        private readonly CorreoCheck $correo = new CorreoCheck(),
        private readonly ConfiguracionCheck $configuracion = new ConfiguracionCheck(),
        private readonly AppVersion $version = new AppVersion()
    ) {
    }

    /** @param array<string,string> $args */
    public function handle(Request $request, array $args): void
    {
        $comprobaciones = [
            'base_datos'     => $this->baseDatos->handle(),
            'almacenamiento' => $this->almacenamiento->handle(),
            'correo'         => $this->correo->handle(),
            'configuracion'  => $this->configuracion->handle(),
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
            'estado'         => $estadoGlobal,
            'version'        => $this->version->version(),
            'commit'         => $this->version->commit(),
            'entorno'        => Env::get('APP_ENV', 'production'),
            'php'            => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'marca_tiempo'   => gmdate('c'),
            'solicitud_id'   => Logger::requestId(),
            'comprobaciones' => $comprobaciones,
        ];

        // 503 permite a la infraestructura reaccionar sin leer el cuerpo.
        Response::success($carga, 'Diagnóstico completado.', $caido ? 503 : 200);
    }
}
