<?php

declare(strict_types=1);

namespace App\Validation;

use App\Exceptions\ApiException;

/**
 * Reglas de validación de campos reutilizables (capa de validación).
 *
 * Se separa de los servicios para cumplir responsabilidad única: los servicios
 * orquestan negocio, esta clase decide si un valor es admisible. Toda regla
 * lanza {@see ApiException::validation()} (HTTP 422) con el mensaje del campo.
 *
 * Principio aplicado: la validación del navegador es una comodidad para el
 * usuario, NO un control de seguridad. Cualquiera puede llamar al API con curl,
 * así que estas reglas se ejecutan siempre en el servidor.
 *
 * @package App\Validation
 */
final class Validator
{
    /** Longitud exacta exigida a un número telefónico nacional (Colombia). */
    private const TELEFONO_DIGITOS = 10;

    /** Indicativo de país que se descarta si el usuario lo escribe. */
    private const INDICATIVO_PAIS = '57';

    /**
     * Normaliza y valida un número de teléfono.
     *
     * Acepta que el usuario escriba separadores habituales (espacios, guiones,
     * paréntesis, o el prefijo +57) y los descarta; después exige EXACTAMENTE
     * 10 dígitos. El valor devuelto son solo dígitos, listo para almacenar.
     *
     * Ejemplos admitidos → almacenado:
     *   "300 123 4567"      → "3001234567"
     *   "+57 (601) 234-5678"→ "6012345678"
     *   "3001234567"        → "3001234567"
     * Rechazados: "300123456" (9), "30012345678" (11), "300-ABC-4567" (letras).
     *
     * @param mixed  $valor  Valor recibido del formulario.
     * @param string $campo  Nombre del campo para el mensaje de error.
     * @param bool   $obligatorio Si false, un valor vacío devuelve null.
     * @return string|null Número normalizado (10 dígitos) o null si es opcional y vino vacío.
     * @throws ApiException 422 si no cumple la regla.
     */
    public static function telefono($valor, string $campo = 'telefono', bool $obligatorio = false): ?string
    {
        $original = trim((string) ($valor ?? ''));

        if ($original === '') {
            if ($obligatorio) {
                throw ApiException::validation([$campo => 'El teléfono es obligatorio.']);
            }
            return null;
        }

        // Rechaza de entrada cualquier letra: evita que "300ABC4567" pase por
        // el filtro de dígitos y quede convertido en un número más corto.
        if (preg_match('/\p{L}/u', $original) === 1) {
            throw ApiException::validation([
                $campo => 'El teléfono solo puede contener números (10 dígitos).',
            ]);
        }

        $digitos = preg_replace('/\D+/', '', $original) ?? '';

        // "+57 300 123 4567" → 12 dígitos: se descarta el indicativo de país.
        if (
            strlen($digitos) === self::TELEFONO_DIGITOS + strlen(self::INDICATIVO_PAIS)
            && str_starts_with($digitos, self::INDICATIVO_PAIS)
        ) {
            $digitos = substr($digitos, strlen(self::INDICATIVO_PAIS));
        }

        if (strlen($digitos) !== self::TELEFONO_DIGITOS) {
            throw ApiException::validation([
                $campo => 'El teléfono debe tener exactamente 10 dígitos numéricos.',
            ]);
        }

        return $digitos;
    }
}
