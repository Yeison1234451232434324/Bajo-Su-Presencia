<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Services\VersiculoDiaService;

/**
 * Versículo del día para el pie de página público (sin autenticación).
 *
 * @package App\Controllers
 */
final class VersiculoController
{
    private readonly VersiculoDiaService $servicio;

    public function __construct(?VersiculoDiaService $servicio = null)
    {
        $this->servicio = $servicio ?? new VersiculoDiaService();
    }

    public function hoy(Request $request): void
    {
        if (!headers_sent()) {
            // El versículo cambia una vez al día: los navegadores/CDN pueden reutilizarlo un rato.
            header('Cache-Control: public, max-age=900');
        }
        Response::success($this->servicio->delDia(), 'Versículo del día.');
    }
}
