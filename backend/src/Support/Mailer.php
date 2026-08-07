<?php

declare(strict_types=1);

namespace App\Support;

use App\Config\Env;
use App\Exceptions\ApiException;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/**
 * Envío de correos vía SMTP de Gmail (PHPMailer + STARTTLS).
 *
 * Requiere una "Contraseña de aplicación" de Google (`MAIL_APP_PASSWORD`), no la
 * contraseña normal de la cuenta. Las credenciales viven solo en `.env`.
 *
 * @package App\Support
 */
final class Mailer
{
    private readonly Logger $logger;

    public function __construct(?Logger $logger = null)
    {
        $this->logger = $logger ?? new Logger();
    }

    /**
     * Envía un correo HTML.
     *
     * @throws ApiException 500 si el envío falla (el detalle va al log).
     */
    public function send(string $toEmail, string $subject, string $htmlBody): void
    {
        $user = (string) Env::get('MAIL_USERNAME', '');
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
