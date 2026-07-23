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
     * Envía un correo HTML. Si existe `assets/logo.png`, lo incrusta como imagen
     * embebida con CID `logo` (referénciala en el HTML como `cid:logo`).
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

            $mail->setFrom($user, (string) Env::get('MAIL_FROM_NAME', 'Bajo Su Presencia'));
            $mail->addAddress($toEmail);

            // Logo embebido (cid:logo) si está disponible.
            $logo = dirname(__DIR__, 2) . '/assets/logo.png';
            if (is_readable($logo)) {
                $mail->addEmbeddedImage($logo, 'logo', 'logo.png');
            }

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
}
