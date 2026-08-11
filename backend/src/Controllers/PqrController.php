<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Security\AuthMiddleware;
use App\Security\PublicEndpointGuard;
use App\Support\AuditLogger;
use App\Support\Logger;
use App\Support\Mailer;
use App\Supabase\SupabaseClient;
use Throwable;

/**
 * PQR — radicar, responder y cambiar estado de una petición/queja/reclamo,
 * notificando por correo a quien la radicó en cada paso.
 *
 * La lectura/listado de `pqr` sigue centralizada en el Data Gateway (el panel
 * lo usa para listar/filtrar); este controlador se limita a las acciones que,
 * además de tocar la fila, deben enviar un correo — algo que el gateway
 * genérico no puede hacer porque no tiene acceso a Mailer.
 *
 * @package App\Controllers
 */
final class PqrController
{
    private const ROLES = ['Administrador', 'Colaborador'];
    private const TIPOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];
    private const ESTADOS = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];

    private readonly SupabaseClient $sb;

    public function __construct(?SupabaseClient $sb = null)
    {
        $this->sb = $sb ?? new SupabaseClient();
    }

    /**
     * POST /api/pqr — radica una PQR (público, sin autenticación) y envía al
     * correo indicado la confirmación de recepción con el estado inicial.
     *
     * @param array<string,string> $args
     */
    public function crear(Request $request, array $args): void
    {
        // Público y sin autenticación: sin límite, cualquiera podría radicar
        // PQR en bucle usando el correo de un tercero como remitente y
        // bombardearlo de confirmaciones ("email bombing").
        (new PublicEndpointGuard())->assertAllowed('pqr', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), 5, 15);

        $tipo        = trim((string) $request->input('tipo', ''));
        $nombre      = trim((string) $request->input('nombre', ''));
        $correo      = trim((string) $request->input('correo', $request->input('email', '')));
        $telefono    = trim((string) $request->input('telefono', ''));
        $asunto      = trim((string) $request->input('asunto', ''));
        $descripcion = trim((string) $request->input('descripcion', ''));

        if ($nombre === '') {
            throw ApiException::validation(['nombre' => 'El nombre es obligatorio.']);
        }
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation(['correo' => 'El correo electrónico es obligatorio.']);
        }
        if ($asunto === '') {
            throw ApiException::validation(['asunto' => 'El asunto es obligatorio.']);
        }
        if ($descripcion === '') {
            throw ApiException::validation(['descripcion' => 'La descripción es obligatoria.']);
        }

        $fila = [
            'tipo'        => in_array($tipo, self::TIPOS, true) ? $tipo : 'Petición',
            'nombre'      => $nombre,
            'correo'      => strtolower($correo),
            'telefono'    => $telefono !== '' ? $telefono : null,
            'asunto'      => $asunto,
            'descripcion' => $descripcion,
            'estado'      => 'Pendiente',
        ];

        $creada = $this->sb->insert('pqr', $fila);

        try {
            (new Mailer())->send(
                $fila['correo'],
                'Hemos recibido tu ' . strtolower($fila['tipo']) . ' — Bajo Su Presencia',
                $this->confirmacionHtml($creada)
            );
        } catch (Throwable $e) {
            // La PQR ya quedó registrada; el correo es best-effort para no
            // perder la radicación si falla el SMTP.
            (new Logger())->error('No se pudo enviar la confirmación de PQR por correo', [
                'pqr_id' => $creada['id'] ?? null,
                'error'  => $e->getMessage(),
            ]);
        }

        Response::success($creada, 'Tu solicitud fue enviada exitosamente. Te contactaremos pronto.');
    }

    /**
     * PATCH /api/pqr/{id}/estado — cambia solo el estado (sin escribir una
     * respuesta) y notifica el cambio al correo del solicitante.
     *
     * @param array<string,string> $args
     * @throws ApiException 409 si la PQR ya está "Resuelto" (solo se puede eliminar).
     */
    public function cambiarEstado(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        $id = $args['id'] ?? '';
        if ($id === '') {
            throw ApiException::validation(['id' => 'Identificador requerido.']);
        }

        $estado = trim((string) $request->input('estado', ''));
        if (!in_array($estado, self::ESTADOS, true)) {
            throw ApiException::validation(['estado' => 'Estado no válido.']);
        }

        try {
            $pqr = $this->buscarOFallar($id);
            $this->rechazarSiResuelto($pqr);

            $actualizadas = $this->sb->update('pqr', ['estado' => $estado], ['id' => 'eq.' . $id]);
            $actualizada  = $actualizadas[0] ?? array_merge($pqr, ['estado' => $estado]);
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'cambiar_estado',
                'pqr',
                $id,
                "Intentó cambiar el estado de una PQR a \"{$estado}\" (la operación falló).",
                'error'
            );
            throw $e;
        }

        $this->notificarCambioEstado($id, $pqr, $estado);

        AuditLogger::registrar(
            $claims,
            'cambiar_estado',
            'pqr',
            $id,
            "Cambió el estado de la PQR \"" . ($pqr['asunto'] ?? $id) . "\" a \"{$estado}\"."
        );

        Response::success($actualizada, 'El estado se actualizó y se notificó al solicitante.');
    }

    /**
     * PATCH /api/pqr/{id}/responder — guarda la respuesta y la envía al correo
     * que la persona indicó al radicar la PQR.
     *
     * @param array<string,string> $args
     * @throws ApiException 409 si la PQR ya está "Resuelto" (solo se puede eliminar).
     */
    public function responder(Request $request, array $args): void
    {
        $claims = AuthMiddleware::authorize($request, self::ROLES);
        $id = $args['id'] ?? '';
        if ($id === '') {
            throw ApiException::validation(['id' => 'Identificador requerido.']);
        }

        $respuesta = trim((string) $request->input('respuesta', ''));
        $estado    = trim((string) $request->input('estado', ''));
        if ($respuesta === '') {
            throw ApiException::validation(
                ['respuesta' => 'La respuesta no puede estar vacía.'],
                'Escribe una respuesta antes de guardar.'
            );
        }

        try {
            $pqr = $this->buscarOFallar($id);
            $this->rechazarSiResuelto($pqr);

            $cambios = [
                'respuesta'         => $respuesta,
                'respondido_en'     => date('c'),
                'respondido_por_id' => $claims['sub'] ?? null,
            ];
            if (in_array($estado, self::ESTADOS, true)) {
                $cambios['estado'] = $estado;
            }

            $actualizadas = $this->sb->update('pqr', $cambios, ['id' => 'eq.' . $id]);
            $actualizada = $actualizadas[0] ?? array_merge($pqr, $cambios);
        } catch (Throwable $e) {
            AuditLogger::registrar(
                $claims,
                'responder',
                'pqr',
                $id,
                'Intentó responder una PQR (la operación falló).',
                'error'
            );
            throw $e;
        }

        AuditLogger::registrar(
            $claims,
            'responder',
            'pqr',
            $id,
            "Respondió la PQR \"" . ($pqr['asunto'] ?? $id) . "\"."
        );

        $correo = (string) ($pqr['correo'] ?? '');
        if (filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            try {
                (new Mailer())->send(
                    $correo,
                    'Respuesta a tu ' . strtolower((string) ($pqr['tipo'] ?? 'PQR')) . ' — Bajo Su Presencia',
                    $this->respuestaHtml($pqr, $respuesta)
                );
            } catch (Throwable $e) {
                // La respuesta ya quedó guardada; el correo es best-effort para
                // no perder el trabajo del administrador si falla el SMTP.
                (new Logger())->error('No se pudo enviar la respuesta de PQR por correo', [
                    'pqr_id' => $id,
                    'error'  => $e->getMessage(),
                ]);
            }
        }

        Response::success($actualizada, 'Respuesta guardada y enviada al correo del solicitante.');
    }

    /** @return array<string,mixed> */
    private function buscarOFallar(string $id): array
    {
        $filas = $this->sb->select('pqr', ['id' => 'eq.' . $id]);
        $pqr = $filas[0] ?? null;
        if ($pqr === null) {
            throw new ApiException('PQR no encontrada.', 404);
        }
        return $pqr;
    }

    /**
     * Una PQR "Resuelto" queda de solo lectura: no admite nueva respuesta ni
     * cambio de estado, solo eliminación (fuera de este controlador, vía
     * Data Gateway).
     *
     * @param array<string,mixed> $pqr
     */
    private function rechazarSiResuelto(array $pqr): void
    {
        if (($pqr['estado'] ?? '') === 'Resuelto') {
            throw new ApiException(
                'Esta PQR ya fue marcada como resuelta: no se puede responder ni cambiar su estado. Solo puede eliminarse.',
                409
            );
        }
    }

    /** @param array<string,mixed> $pqr */
    private function notificarCambioEstado(string $id, array $pqr, string $estado): void
    {
        $correo = (string) ($pqr['correo'] ?? '');
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            return;
        }
        try {
            (new Mailer())->send(
                $correo,
                'Actualización de tu ' . strtolower((string) ($pqr['tipo'] ?? 'PQR')) . ' — Bajo Su Presencia',
                $this->cambioEstadoHtml($pqr, $estado)
            );
        } catch (Throwable $e) {
            (new Logger())->error('No se pudo enviar la notificación de cambio de estado por correo', [
                'pqr_id' => $id,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    /**
     * Cuerpo HTML del correo de confirmación al radicar la PQR.
     * @param array<string,mixed> $pqr
     */
    private function confirmacionHtml(array $pqr): string
    {
        $nombre  = htmlspecialchars((string) ($pqr['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?: 'Estimado(a)';
        $asunto  = htmlspecialchars((string) ($pqr['asunto'] ?? ''), ENT_QUOTES, 'UTF-8');
        $tipo    = htmlspecialchars((string) ($pqr['tipo'] ?? 'PQR'), ENT_QUOTES, 'UTF-8');
        $tipoMin = htmlspecialchars(strtolower((string) ($pqr['tipo'] ?? 'PQR')), ENT_QUOTES, 'UTF-8');
        $estado  = htmlspecialchars((string) ($pqr['estado'] ?? 'Pendiente'), ENT_QUOTES, 'UTF-8');
        $logoUrl = Mailer::logoUrl();

        return <<<HTML
<div style="margin:0;padding:24px;background:#eef2f8;font-family:Georgia,'Times New Roman',serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 30px rgba(15,30,90,.12)">
        <tr><td style="background:#0F1E5A;padding:28px 24px;text-align:center;">
          <img src="{$logoUrl}" alt="Bajo Su Presencia" width="56" height="56"
            style="width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 12px;">
          <div style="color:#fff;font-size:22px;font-weight:700;">Bajo Su Presencia B.S.P</div>
          <div style="color:#cbd5e1;font-size:14px;margin-top:6px;letter-spacing:0.02em;">Hemos recibido tu {$tipo}</div>
        </td></tr>
        <tr><td style="padding:24px;color:#1a1a2e;">
          <p style="font-size:16px;margin:0 0 12px;">Hola <b>{$nombre}</b>,</p>
          <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
            Recibimos tu {$tipoMin} con asunto <b>{$asunto}</b>. Nuestro equipo la revisará y te avisaremos por
            este mismo correo cada vez que cambie de estado.
          </p>
          <p style="text-align:center;margin:0 0 16px;">
            <span style="display:inline-block;background:#eef2f8;color:#0F1E5A;font-weight:700;
              font-size:14px;padding:8px 18px;border-radius:999px;">Estado actual: {$estado}</span>
          </p>
          <p style="font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px dashed #e5e1d8;padding-top:14px;margin:0;">
            Este correo fue generado automáticamente al radicar tu solicitud en el sitio de Bajo Su Presencia.
          </p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;">
        © Bajo Su Presencia B.S.P — Sistema de Gestión Eclesiástica</p>
    </td></tr>
  </table>
</div>
HTML;
    }

    /**
     * Cuerpo HTML del correo de notificación de cambio de estado.
     * @param array<string,mixed> $pqr
     */
    private function cambioEstadoHtml(array $pqr, string $nuevoEstado): string
    {
        $nombre  = htmlspecialchars((string) ($pqr['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?: 'Estimado(a)';
        $asunto  = htmlspecialchars((string) ($pqr['asunto'] ?? ''), ENT_QUOTES, 'UTF-8');
        $tipo    = htmlspecialchars((string) ($pqr['tipo'] ?? 'PQR'), ENT_QUOTES, 'UTF-8');
        $tipoMin = htmlspecialchars(strtolower((string) ($pqr['tipo'] ?? 'PQR')), ENT_QUOTES, 'UTF-8');
        $estado  = htmlspecialchars($nuevoEstado, ENT_QUOTES, 'UTF-8');
        $logoUrl = Mailer::logoUrl();

        return <<<HTML
<div style="margin:0;padding:24px;background:#eef2f8;font-family:Georgia,'Times New Roman',serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 30px rgba(15,30,90,.12)">
        <tr><td style="background:#0F1E5A;padding:28px 24px;text-align:center;">
          <img src="{$logoUrl}" alt="Bajo Su Presencia" width="56" height="56"
            style="width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 12px;">
          <div style="color:#fff;font-size:22px;font-weight:700;">Bajo Su Presencia B.S.P</div>
          <div style="color:#cbd5e1;font-size:14px;margin-top:6px;letter-spacing:0.02em;">Actualización de tu {$tipo}</div>
        </td></tr>
        <tr><td style="padding:24px;color:#1a1a2e;">
          <p style="font-size:16px;margin:0 0 12px;">Hola <b>{$nombre}</b>,</p>
          <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
            Tu {$tipoMin} con asunto <b>{$asunto}</b> cambió de estado:
          </p>
          <p style="text-align:center;margin:0 0 16px;">
            <span style="display:inline-block;background:#eef2f8;color:#0F1E5A;font-weight:700;
              font-size:14px;padding:8px 18px;border-radius:999px;">Nuevo estado: {$estado}</span>
          </p>
          <p style="font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px dashed #e5e1d8;padding-top:14px;margin:0;">
            Este correo fue generado automáticamente al actualizar el estado de tu solicitud desde el panel de Bajo Su Presencia.
          </p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;">
        © Bajo Su Presencia B.S.P — Sistema de Gestión Eclesiástica</p>
    </td></tr>
  </table>
</div>
HTML;
    }

    /** @param array<string,mixed> $pqr */
    private function respuestaHtml(array $pqr, string $respuesta): string
    {
        $nombre      = htmlspecialchars((string) ($pqr['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?: 'Estimado(a)';
        $asunto      = htmlspecialchars((string) ($pqr['asunto'] ?? ''), ENT_QUOTES, 'UTF-8');
        $tipo        = htmlspecialchars((string) ($pqr['tipo'] ?? 'PQR'), ENT_QUOTES, 'UTF-8');
        $respuestaEsc = nl2br(htmlspecialchars($respuesta, ENT_QUOTES, 'UTF-8'));
        $logoUrl      = Mailer::logoUrl();

        return <<<HTML
<div style="margin:0;padding:24px;background:#eef2f8;font-family:Georgia,'Times New Roman',serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 30px rgba(15,30,90,.12)">
        <tr><td style="background:#0F1E5A;padding:28px 24px;text-align:center;">
          <img src="{$logoUrl}" alt="Bajo Su Presencia" width="56" height="56"
            style="width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 12px;">
          <div style="color:#fff;font-size:22px;font-weight:700;">Bajo Su Presencia B.S.P</div>
          <div style="color:#cbd5e1;font-size:14px;margin-top:6px;letter-spacing:0.02em;">Respuesta a tu {$tipo}</div>
        </td></tr>
        <tr><td style="padding:24px;color:#1a1a2e;">
          <p style="font-size:16px;margin:0 0 12px;">Hola <b>{$nombre}</b>,</p>
          <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
            Hemos respondido tu {$tipo} con asunto <b>{$asunto}</b>:
          </p>
          <div style="background:#f8f7f3;border-left:3px solid #0F1E5A;padding:14px 16px;margin:0 0 16px;font-size:15px;line-height:1.6;">
            {$respuestaEsc}
          </div>
          <p style="font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px dashed #e5e1d8;padding-top:14px;margin:0;">
            Este correo fue generado automáticamente al responder tu solicitud desde el panel de Bajo Su Presencia.
          </p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;">
        © Bajo Su Presencia B.S.P — Sistema de Gestión Eclesiástica</p>
    </td></tr>
  </table>
</div>
HTML;
    }
}
