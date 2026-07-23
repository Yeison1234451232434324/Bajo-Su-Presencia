<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Emisor de respuestas JSON estandarizadas.
 *
 * Formato uniforme: `{"status": "success|error", "data": ..., "message": "..."}`.
 *
 * @package App\Http
 */
final class Response
{
    /**
     * Respuesta de éxito.
     *
     * @param mixed $data Carga útil.
     */
    public static function success($data = null, string $message = '', int $httpStatus = 200): void
    {
        self::send('success', $data, $message, $httpStatus, []);
    }

    /**
     * Respuesta de error.
     *
     * @param array<string,string> $errors Errores de validación por campo.
     */
    public static function error(string $message, int $httpStatus = 400, array $errors = []): void
    {
        self::send('error', null, $message, $httpStatus, $errors);
    }

    /**
     * Serializa y envía la respuesta.
     *
     * @param mixed                $data
     * @param array<string,string> $errors
     */
    private static function send(string $status, $data, string $message, int $httpStatus, array $errors): void
    {
        if (!headers_sent()) {
            http_response_code($httpStatus);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
        }

        $payload = ['status' => $status, 'data' => $data, 'message' => $message];
        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
