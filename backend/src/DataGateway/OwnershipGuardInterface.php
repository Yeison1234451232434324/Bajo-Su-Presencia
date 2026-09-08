<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Exceptions\ApiException;

/**
 * Contrato común para las reglas de "ownership" (RT-02, RT-03: un Voluntario
 * solo puede escribir SU PROPIO registro) del Data Gateway.
 *
 * Introducido para que {@see \App\Controllers\DataGatewayController} dependa
 * de esta abstracción — no de las clases concretas de cada tabla (DIP) — y
 * para que agregar una regla de ownership para una tabla nueva sea abrir una
 * clase nueva y registrarla, sin tocar la lógica ya existente del
 * controlador ni de los otros guards (OCP).
 *
 * @package App\DataGateway
 */
interface OwnershipGuardInterface
{
    /**
     * @param array<string,mixed> $body Cuerpo enviado por el cliente.
     * @param string $miId `sub` del JWT del usuario autenticado.
     * @throws ApiException Si la operación no corresponde a un registro propio,
     *         o toca campos/operaciones fuera de lo permitido a este rol.
     */
    public function assertPermitido(string $method, string $query, array $body, string $miId): void;
}
