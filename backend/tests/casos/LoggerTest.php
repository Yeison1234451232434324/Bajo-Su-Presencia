<?php

/**
 * Pruebas de App\Support\Logger.
 *
 * Se prioriza porque la redacción de datos sensibles es un control de
 * privacidad: una regresión aquí volcaría contraseñas, tokens y correos en
 * archivos que se copian y comparten durante el soporte.
 */

declare(strict_types=1);

use App\Support\Logger;
use App\Tests\Corredor;

return static function (Corredor $c): void {

    /**
     * Escribe en un directorio temporal y devuelve el contenido del log.
     * El callable recibe el Logger y también la ruta, para poder crear
     * instancias adicionales que escriban en el MISMO archivo.
     */
    $capturar = static function (callable $accion): string {
        $dir = sys_get_temp_dir() . '/bsp_pruebas_' . bin2hex(random_bytes(4));
        @mkdir($dir, 0775, true);

        $accion(new Logger($dir), $dir);

        $archivos = glob($dir . '/*.log') ?: [];
        $texto = $archivos !== [] ? (string) file_get_contents($archivos[0]) : '';
        foreach ($archivos as $f) {
            @unlink($f);
        }
        @rmdir($dir);
        return $texto;
    };

    $c->grupo('Logger — redacción de datos sensibles');

    $c->prueba('redacta la contraseña', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static fn(Logger $l) => $l->error('x', ['password' => 'SuperSecreta1!']));
        $c->asegurarCierto(!str_contains($log, 'SuperSecreta1!'), 'la contraseña no debe aparecer');
        $c->asegurarCierto(str_contains($log, '[redactado]'), 'debe marcarse como redactada');
    });

    $c->prueba('redacta tokens de acceso y refresco', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static fn(Logger $l) => $l->error('x', [
            'access_token' => 'eyJSECRETO', 'refresh_token' => 'rtSECRETO',
        ]));
        $c->asegurarCierto(!str_contains($log, 'SECRETO'), 'ningún token debe aparecer');
    });

    $c->prueba('redacta el OTP', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static fn(Logger $l) => $l->info('x', ['otp' => '482913']));
        $c->asegurarCierto(!str_contains($log, '482913'), 'el OTP no debe aparecer');
    });

    $c->prueba('redacta también en contexto anidado', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static fn(Logger $l) => $l->error('x', ['datos' => ['password' => 'ANIDADA']]));
        $c->asegurarCierto(!str_contains($log, 'ANIDADA'), 'la redacción debe ser recursiva');
    });

    $c->grupo('Logger — enmascarado de correo (datos personales)');

    $c->prueba('enmascara la parte local y conserva el dominio', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static fn(Logger $l) => $l->info('x', ['email' => 'yeison@correo.com']));
        $c->asegurarCierto(!str_contains($log, 'yeison@correo.com'), 'el correo íntegro no debe aparecer');
        $c->asegurarCierto(str_contains($log, '@correo.com'), 'el dominio sí es útil para diagnóstico');
    });

    $c->grupo('Logger — niveles y trazabilidad');

    $c->prueba('registra los cuatro niveles', function (Corredor $c) use ($capturar): void {
        $log = $capturar(static function (Logger $l): void {
            $l->info('a');
            $l->warning('b');
            $l->error('c');
            $l->critical('d');
        });
        foreach (['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as $nivel) {
            $c->asegurarCierto(str_contains($log, $nivel), "falta el nivel {$nivel}");
        }
    });

    $c->prueba('dos instancias distintas comparten el identificador', function (Corredor $c) use ($capturar): void {
        // Cada servicio crea su propio Logger: si el identificador no fuera
        // compartido, las líneas de una misma petición no podrían correlacionarse.
        $log = $capturar(static function (Logger $l, string $dir): void {
            $l->info('primera instancia');
            (new Logger($dir))->info('segunda instancia');
        });
        $id = Logger::requestId();
        $ocurrencias = substr_count($log, $id);
        $c->asegurarIgual(2, $ocurrencias, 'ambas líneas deben llevar el mismo id');
    });

    $c->prueba('el identificador es estable dentro de la misma solicitud', function (Corredor $c): void {
        $c->asegurarIgual(Logger::requestId(), Logger::requestId());
    });
};
