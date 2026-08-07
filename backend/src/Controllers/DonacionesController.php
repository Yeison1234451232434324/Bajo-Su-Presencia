<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Env;
use App\Exceptions\ApiException;
use App\Http\Request;
use App\Http\Response;
use App\Support\Logger;
use App\Support\Mailer;
use App\Supabase\SupabaseClient;
use Throwable;

/**
 * Donaciones (público) — MAQUETA.
 *
 * Recibe una donación anónima: correo (obligatorio, para el comprobante), monto
 * y método (PSE / Nequi / Tarjeta). Genera una referencia y envía el comprobante
 * al correo indicado.
 *
 * IMPORTANTE — el cobro es SIMULADO. Aquí es donde se integraría una pasarela de
 * pago colombiana (Wompi, PayU, ePayco…):
 *   1) Crear la transacción en la pasarela con { monto, referencia, correo }.
 *   2) Redirigir al checkout de la pasarela (PSE/Nequi/tarjeta).
 *   3) En el webhook de confirmación (pago APROBADO) → enviar el comprobante.
 * Por ahora se genera la referencia y se envía el comprobante directamente, para
 * poder probar y presentar el flujo completo sin mover dinero real.
 *
 * @package App\Controllers
 */
final class DonacionesController
{
    private const METODOS = ['PSE', 'Nequi', 'Tarjeta'];
    private const MONTO_MIN = 1000;      // $1.000 COP
    private const MONTO_MAX = 20000000;  // $20.000.000 COP (tope de sensatez)

    /**
     * POST /api/donaciones — registra la donación (simulada) y envía comprobante.
     *
     * @param array<string,string> $args
     */
    public function store(Request $request, array $args): void
    {
        $correo    = trim((string) $request->input('correo', ''));
        $nombre    = trim((string) $request->input('nombre', ''));
        $metodo    = trim((string) $request->input('metodo', ''));
        $proposito = trim((string) $request->input('proposito', ''));
        $monto     = (int) $request->input('monto', 0);

        // ── Validaciones ────────────────────────────────────────────────────
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation(
                ['correo' => 'Correo electrónico inválido.'],
                'Ingresa un correo electrónico válido para enviarte el comprobante.'
            );
        }
        if (!in_array($metodo, self::METODOS, true)) {
            throw ApiException::validation(
                ['metodo' => 'Método no válido.'],
                'Selecciona un método de pago: PSE, Nequi o Tarjeta.'
            );
        }
        if ($monto < self::MONTO_MIN || $monto > self::MONTO_MAX) {
            throw ApiException::validation(
                ['monto' => 'Monto fuera de rango.'],
                'El monto debe estar entre $' . number_format(self::MONTO_MIN, 0, ',', '.')
                    . ' y $' . number_format(self::MONTO_MAX, 0, ',', '.') . ' COP.'
            );
        }

        // ── Referencia única de la donación ─────────────────────────────────
        $referencia = 'BSP-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $fecha      = date('d/m/Y H:i');

        // ── (SIMULADO) Aquí iría la creación del cobro en la pasarela ────────
        // $pasarela->crearTransaccion($monto, $referencia, $correo, $metodo);

        // ── Registro en el historial (tabla `donaciones`) ───────────────────
        // Best-effort: si falla el guardado, la donación igual se confirma al
        // donante (el comprobante por correo es la constancia que le llega).
        // El fallo queda en el log para que soporte lo revise, no se propaga.
        try {
            (new SupabaseClient())->insert('donaciones', [
                'referencia' => $referencia,
                'correo'     => $correo,
                'nombre'     => $nombre !== '' ? $nombre : null,
                'metodo'     => $metodo,
                'monto'      => $monto,
                'proposito'  => $proposito !== '' ? $proposito : null,
            ]);
        } catch (Throwable $e) {
            (new Logger())->error('No se pudo registrar la donación en el historial', [
                'referencia' => $referencia,
                'error'      => $e->getMessage(),
            ]);
        }

        // ── Comprobante por correo ──────────────────────────────────────────
        try {
            (new Mailer())->send(
                $correo,
                'Comprobante de tu donación — Bajo Su Presencia',
                $this->comprobanteHtml($nombre, $monto, $metodo, $proposito, $referencia, $fecha)
            );
        } catch (Throwable $e) {
            throw ApiException::validation(
                ['correo' => 'No se pudo enviar el comprobante.'],
                'La donación se registró pero no pudimos enviar el comprobante a ese correo. '
                    . 'Verifica la dirección e inténtalo de nuevo.'
            );
        }

        Response::success([
            'referencia' => $referencia,
            'monto'      => $monto,
            'metodo'     => $metodo,
            'proposito'  => $proposito,
            'fecha'      => $fecha,
            'correo'     => $correo,
        ], 'Gracias por tu donación. Te enviamos el comprobante a tu correo.');
    }

    /**
     * Cuerpo HTML del comprobante de donación.
     */
    private function comprobanteHtml(
        string $nombre,
        int $monto,
        string $metodo,
        string $proposito,
        string $referencia,
        string $fecha
    ): string {
        $saludo    = $nombre !== '' ? htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') : 'Donante';
        $montoFmt  = '$' . number_format($monto, 0, ',', '.') . ' COP';
        $metodoEsc = htmlspecialchars($metodo, ENT_QUOTES, 'UTF-8');
        $propEsc   = htmlspecialchars($proposito, ENT_QUOTES, 'UTF-8') ?: 'Ofrenda general';
        $refEsc    = htmlspecialchars($referencia, ENT_QUOTES, 'UTF-8');
        $fechaEsc  = htmlspecialchars($fecha, ENT_QUOTES, 'UTF-8');
        $logoUrl   = $this->logoUrl();

        // Mismo criterio "sin colores de estado" que la factura del panel
        // admin: un comprobante formal se mantiene en la paleta corporativa
        // (azul marino / grises), sin el dorado usado en otras piezas del sitio.
        return <<<HTML
<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#1a1a2e;background:#ffffff;">
  <div style="background:#0F1E5A;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
    <img src="{$logoUrl}" alt="Bajo Su Presencia" width="56" height="56"
      style="width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 12px;">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Bajo Su Presencia</h1>
    <p style="color:#cbd5e1;margin:6px 0 0;font-size:14px;letter-spacing:0.02em;">Comprobante de donación</p>
  </div>
  <div style="border:1px solid #e5e1d8;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
    <p style="font-size:16px;">Hola <b>{$saludo}</b>,</p>
    <p style="font-size:15px;line-height:1.6;color:#374151;">
      ¡Gracias por tu generosidad! Hemos recibido tu donación. Este es el comprobante:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:15px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;">Referencia</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;">{$refEsc}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;">Monto</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#047857;">{$montoFmt}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;">Método</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;">{$metodoEsc}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;">Propósito</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;">{$propEsc}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Fecha</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;">{$fechaEsc}</td></tr>
    </table>
    <p style="font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px dashed #e5e1d8;padding-top:14px;">
      Esta donación fue realizada de forma voluntaria y no constituye la compra de bienes o servicios.
      Documento generado automáticamente como constancia de la transacción. Que Dios multiplique tu ofrenda.
    </p>
  </div>
</div>
HTML;
    }

    /**
     * URL absoluta y públicamente accesible del logo, para incrustar en el
     * correo (los clientes de correo no pueden resolver rutas relativas ni
     * `file://`; necesitan una URL http(s) real).
     *
     * Se deriva de RESET_URL_BASE (mismo host que ya usa el correo de
     * recuperación de contraseña) en lugar de fijar 'localhost': en
     * producción esa variable ya apunta al dominio real desplegado.
     */
    private function logoUrl(): string
    {
        $base  = (string) Env::get('RESET_URL_BASE', 'http://localhost:5500');
        $partes = parse_url($base);
        $origen = ($partes['scheme'] ?? 'http') . '://' . ($partes['host'] ?? 'localhost')
            . (isset($partes['port']) ? ':' . $partes['port'] : '');
        return $origen . '/Bajo-Su-Presencia/assets/images/logo.png';
    }
}
