<?php

/**
 * Micro-framework de aserciones para la suite de pruebas.
 *
 * Vive en su propio archivo porque PSR-1 prohíbe que un archivo declare
 * símbolos y además produzca efectos secundarios: `run.php` ejecuta las
 * pruebas, así que no puede definir también la clase.
 */

declare(strict_types=1);

namespace App\Tests;

use RuntimeException;
use Throwable;

final class Corredor
{
    private int $pasadas = 0;
    private int $fallidas = 0;
    /** @var string[] */
    private array $errores = [];
    private string $grupoActual = '';

    public function grupo(string $nombre): void
    {
        $this->grupoActual = $nombre;
        echo "\n\033[1m{$nombre}\033[0m\n";
    }

    /** Ejecuta una prueba capturando cualquier excepción imprevista. */
    public function prueba(string $descripcion, callable $caso): void
    {
        try {
            $caso($this);
            $this->pasadas++;
            echo "  \033[32mOK\033[0m   {$descripcion}\n";
        } catch (Throwable $e) {
            $this->fallidas++;
            $this->errores[] = "{$this->grupoActual} › {$descripcion}: {$e->getMessage()}";
            echo "  \033[31mFALLA\033[0m {$descripcion}\n         {$e->getMessage()}\n";
        }
    }

    /**
     * @param mixed $esperado
     * @param mixed $obtenido
     */
    public function asegurarIgual(mixed $esperado, mixed $obtenido, string $mensaje = ''): void
    {
        if ($esperado !== $obtenido) {
            throw new RuntimeException(sprintf(
                '%sesperado %s, obtenido %s',
                $mensaje !== '' ? $mensaje . ' — ' : '',
                var_export($esperado, true),
                var_export($obtenido, true)
            ));
        }
    }

    /** Verifica que el callable lance una excepción del tipo indicado. */
    public function asegurarLanza(string $clase, callable $caso, string $mensaje = ''): void
    {
        try {
            $caso();
        } catch (Throwable $e) {
            if ($e instanceof $clase) {
                return;
            }
            throw new RuntimeException("se esperaba {$clase}, llegó " . $e::class);
        }
        throw new RuntimeException(($mensaje !== '' ? $mensaje . ' — ' : '') . "no se lanzó {$clase}");
    }

    public function asegurarCierto(bool $condicion, string $mensaje = 'condición falsa'): void
    {
        if (!$condicion) {
            throw new RuntimeException($mensaje);
        }
    }

    /** Imprime el resumen y devuelve el código de salida del proceso. */
    public function resumen(): int
    {
        $total = $this->pasadas + $this->fallidas;
        echo "\n" . str_repeat('─', 58) . "\n";
        if ($this->fallidas === 0) {
            echo "\033[32m  {$this->pasadas}/{$total} pruebas correctas\033[0m\n";
            return 0;
        }
        echo "\033[31m  {$this->fallidas} de {$total} pruebas FALLARON\033[0m\n";
        foreach ($this->errores as $e) {
            echo "   · {$e}\n";
        }
        return 1;
    }
}
