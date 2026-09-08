<?php

declare(strict_types=1);

namespace App\DataGateway;

use App\Exceptions\ApiException;

/**
 * Valida las relaciones embebidas de un `select` de PostgREST contra la
 * lista blanca `embed_select` de {@see TableAccessPolicy}.
 *
 * Responsabilidad única (SRP): separado del controlador y de
 * {@see PostgrestQuery} — este colaborador solo decide SI un embed está
 * permitido, no cómo se parsea el `select` (eso lo delega a PostgrestQuery,
 * inyectado por constructor) ni qué tablas/roles existen (delegado a
 * TableAccessPolicy, también inyectado). Depende de abstracciones simples
 * (ambas clases son colaboradores intercambiables) en vez de reimplementar
 * su lógica — Dependency Inversion a nivel de composición interna.
 *
 * @package App\DataGateway
 */
final class EmbedAccessValidator
{
    public function __construct(
        private readonly TableAccessPolicy $policy,
        private readonly PostgrestQuery $query
    ) {
    }

    /**
     * Valida TODAS las relaciones embebidas de un `select`, a cualquier
     * profundidad de anidamiento. Fail-closed: una tabla embebida que no
     * exista en la política, o cuya proyección no coincida EXACTAMENTE (tras
     * normalizar espacios) con una de las cadenas declaradas en su
     * `embed_select`, rechaza toda la petición.
     *
     * @throws ApiException 403 si alguna relación embebida no está autorizada.
     */
    public function validar(string $select): void
    {
        foreach ($this->query->extraerEmbeds($select) as $embed) {
            $tablaEmbebida = $embed['tabla'];

            if (!$this->policy->existe($tablaEmbebida)) {
                throw ApiException::forbidden('No tienes permisos para consultar este recurso.');
            }

            $normalizado            = $this->query->normalizarSelect($embed['inner']);
            $permitidosNormalizados = array_map(
                $this->query->normalizarSelect(...),
                $this->policy->embedsPermitidos($tablaEmbebida)
            );

            if (!in_array($normalizado, $permitidosNormalizados, true)) {
                throw ApiException::forbidden('No tienes permisos para consultar este recurso.');
            }
        }
    }
}
