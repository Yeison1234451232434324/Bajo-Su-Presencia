<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Excepción de dominio cuyo mensaje es seguro para mostrar al cliente.
 *
 * Transporta el código de estado HTTP y, opcionalmente, errores de validación
 * campo→mensaje. Cualquier otra excepción (no `ApiException`) se considera un
 * fallo interno y se oculta tras un mensaje genérico.
 *
 * @package App\Exceptions
 */
class ApiException extends RuntimeException
{
    /**
     * @param string               $message    Mensaje seguro para el cliente.
     * @param int                  $httpStatus Código HTTP (por defecto 400).
     * @param array<string,string> $errors     Errores de validación opcionales.
     * @param Throwable|null       $previous   Excepción previa encadenada.
     */
    public function __construct(
        string $message,
        int $httpStatus = 400,
        private readonly array $errors = [],
        ?Throwable $previous = null
    ) {
        parent::__construct($message, $httpStatus, $previous);
    }

    /** Devuelve el código de estado HTTP asociado. */
    public function httpStatus(): int
    {
        return $this->getCode() !== 0 ? (int) $this->getCode() : 400;
    }

    /** @return array<string,string> Errores de validación. */
    public function errors(): array
    {
        return $this->errors;
    }

    /** 401 — credenciales/identidad no válidas. */
    public static function unauthorized(string $message = 'No autenticado.'): self
    {
        return new self($message, 401);
    }

    /** 403 — autenticado pero sin permiso. */
    public static function forbidden(string $message = 'No autorizado.'): self
    {
        return new self($message, 403);
    }

    /**
     * 422 — datos de entrada inválidos.
     *
     * @param array<string,string> $errors Mapa campo → mensaje.
     */
    public static function validation(array $errors, string $message = 'Datos inválidos.'): self
    {
        return new self($message, 422, $errors);
    }

    /** 423 — recurso/cuenta bloqueada. */
    public static function locked(string $message = 'Cuenta bloqueada temporalmente.'): self
    {
        return new self($message, 423);
    }
}
