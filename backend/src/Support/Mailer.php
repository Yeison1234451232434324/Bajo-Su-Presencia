<?php

declare(strict_types=1);

namespace App\Support;

use App\Config\Env;
use App\Exceptions\ApiException;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/**
 * Envío de correos con dos transportes:
 *
 *  1. **Brevo (API HTTP)** — si `BREVO_API_KEY` está definida. Es el transporte
 *     de producción: viaja por HTTPS (puerto 443), así que funciona en hostings
 *     que bloquean los puertos SMTP salientes (p. ej. el plan gratuito de
 *     Render). El remitente (`MAIL_USERNAME`) debe estar verificado en Brevo.
 *  2. **SMTP de Gmail (PHPMailer + STARTTLS)** — respaldo para desarrollo local.
 *     Requiere una "Contraseña de aplicación" de Google (`MAIL_APP_PASSWORD`).
 *
 * Las credenciales viven solo en el entorno (`.env` / variables del host).
 *
 * @package App\Support
 */
final class Mailer
{
    /** Endpoint de correo transaccional de Brevo. */
    private const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

    private readonly Logger $logger;

    public function __construct(?Logger $logger = null)
    {
        $this->logger = $logger ?? new Logger();
    }

    /**
     * Envía un correo HTML por el transporte disponible.
     *
     * @throws ApiException 500 si el envío falla (el detalle va al log).
     */
    public function send(string $toEmail, string $subject, string $htmlBody): void
    {
        $user     = (string) Env::get('MAIL_USERNAME', '');
        $brevoKey = (string) Env::get('BREVO_API_KEY', '');

        if ($brevoKey !== '') {
            if ($user === '') {
                throw new ApiException('El servicio de correo no está configurado.', 500);
            }
            $this->sendViaBrevo($brevoKey, $user, $toEmail, $subject, $htmlBody);
            return;
        }

        $pass = (string) Env::get('MAIL_APP_PASSWORD', '');
        if ($user === '' || $pass === '') {
            throw new ApiException('El servicio de correo no está configurado.', 500);
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = (string) Env::get('MAIL_HOST', 'smtp.gmail.com');
            $mail->SMTPAuth   = true;
            $mail->Username   = $user;
            $mail->Password   = $pass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = Env::int('MAIL_PORT', 587);
            $mail->CharSet    = 'UTF-8';

            $fromName = (string) Env::get('MAIL_FROM_NAME', 'Bajo Su Presencia');
            $mail->setFrom($user, $fromName);
            $mail->addReplyTo($user, $fromName);
            $mail->addAddress($toEmail);

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlBody;
            $mail->AltBody = strip_tags($htmlBody);

            $mail->send();
        } catch (MailException) {
            $this->logger->error('Fallo enviando correo', ['error' => $mail->ErrorInfo]);
            throw new ApiException('No se pudo enviar el correo.', 500);
        }
    }

    /**
     * Envía el correo a través de la API transaccional de Brevo (HTTPS).
     *
     * @throws ApiException 500 si Brevo rechaza la petición o hay fallo de red.
     */
    private function sendViaBrevo(
        string $apiKey,
        string $fromEmail,
        string $toEmail,
        string $subject,
        string $htmlBody
    ): void {
        $fromName = (string) Env::get('MAIL_FROM_NAME', 'Bajo Su Presencia');

        $payload = json_encode([
            'sender'      => ['name' => $fromName, 'email' => $fromEmail],
            'replyTo'     => ['name' => $fromName, 'email' => $fromEmail],
            'to'          => [['email' => $toEmail]],
            'subject'     => $subject,
            'htmlContent' => $htmlBody,
            'textContent' => strip_tags($htmlBody),
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        $ch = curl_init(self::BREVO_ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => [
                'accept: application/json',
                'content-type: application/json',
                'api-key: ' . $apiKey,
            ],
        ]);

        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0) {
            $this->logger->error('Fallo de red enviando correo (Brevo)', ['curl' => $error]);
            throw new ApiException('No se pudo enviar el correo.', 500);
        }

        // Brevo responde 201 (Created) cuando encola el mensaje.
        if ($status < 200 || $status >= 300) {
            $this->logger->error('Brevo rechazó el envío', [
                'http'     => $status,
                'response' => is_string($raw) ? mb_substr($raw, 0, 500) : '',
            ]);
            throw new ApiException('No se pudo enviar el correo.', 500);
        }
    }

    /**
     * URL pública y absoluta del logo, para referenciarla con `<img src="...">`
     * en los correos: se resuelve como imagen remota (visible, sin descargarse
     * como adjunto), a diferencia de una imagen incrustada en el propio correo.
     * Se deriva de RESET_URL_BASE, que ya apunta al dominio público desplegado.
     *
     * IMPORTANTE: si RESET_URL_BASE apunta a `localhost` (como en desarrollo),
     * el logo se verá roto en cualquier cliente de correo real (Gmail, Outlook,
     * apps móviles), porque esos servidores no pueden alcanzar tu máquina local.
     * En producción, RESET_URL_BASE debe apuntar al dominio público (https)
     * desplegado para que el logo cargue correctamente.
     */
    public static function logoUrl(): string
    {
        $base   = (string) Env::get('RESET_URL_BASE', 'http://localhost:5500');
        $partes = parse_url($base);
        $origen = ($partes['scheme'] ?? 'http') . '://' . ($partes['host'] ?? 'localhost')
            . (isset($partes['port']) ? ':' . $partes['port'] : '');
        return $origen . '/Bajo-Su-Presencia/assets/images/logo.png';
    }
}
