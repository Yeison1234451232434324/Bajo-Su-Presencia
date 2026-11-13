<?php

declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Versículo del día (pie de página del sitio público).
 *
 * Cada día muestra UN versículo de la Traducción en Lenguaje Actual (TLA) y lo mantiene hasta la
 * medianoche (hora de Bogotá). No usa IA ni servicios externos en producción:
 *
 *  - Las citas salen de `backend/data/versiculos.json`, una lista curada de
 *    versículos de ánimo y fe cuyo texto se descargó UNA vez de una fuente
 *    bíblica, así que cada texto coincide literalmente con su referencia
 *    (una IA puede inventar o mezclar citas; esto no).
 *  - El orden se baraja de forma determinista con el AÑO como semilla: dentro
 *    de un mismo año no se repite ningún versículo (mientras la lista tenga al
 *    menos tantos como días tiene el año) y cada año el orden es distinto.
 *  - Todas las instancias del servidor coinciden sin base de datos ni caché.
 *
 * Para ampliar la lista basta agregar objetos {"ref","text"} al JSON.
 *
 * Derechos: la TLA es © Sociedades Bíblicas Unidas, 2002, 2004. El sitio muestra el aviso
 * bajo el versículo; la lista contiene solo citas cortas, no la Biblia completa.
 *
 * @package App\Services
 */
final class VersiculoDiaService
{
    private const ZONA_HORARIA = 'America/Bogota';

    /** Si el archivo falta o está dañado, el pie conserva este versículo. */
    private const RESPALDO = [
        'ref'  => 'Mateo 18:20',
        'text' => 'Porque allí donde dos o tres de ustedes se reúnan en mi nombre, allí estaré yo.',
    ];

    private string $archivo;

    /** @var non-empty-list<array{ref:string,text:string}>|null */
    private ?array $lista = null;

    /**
     * @param string|null $archivo Ruta del JSON de versículos (por defecto `backend/data/versiculos.json`).
     */
    public function __construct(?string $archivo = null)
    {
        $this->archivo = $archivo ?? dirname(__DIR__, 2) . '/data/versiculos.json';
    }

    /**
     * @return array{fecha:string,referencia:string,texto:string}
     */
    public function delDia(?DateTimeImmutable $ahora = null): array
    {
        $zona  = new DateTimeZone(self::ZONA_HORARIA);
        $ahora = ($ahora ?? new DateTimeImmutable('now', $zona))->setTimezone($zona);

        $anio   = (int) $ahora->format('Y');
        $diaAno = (int) $ahora->format('z'); // 0..364 (365 en bisiesto)

        $lista = $this->barajada($anio);
        $v     = $lista[$diaAno % count($lista)];

        return [
            'fecha'      => $ahora->format('Y-m-d'),
            'referencia' => $v['ref'],
            'texto'      => $v['text'],
        ];
    }

    /** Cuántos versículos hay disponibles (para avisar si no cubren un año completo). */
    public function total(): int
    {
        return count($this->cargar());
    }

    /**
     * Lista ordenada por una huella (hash) que depende del año: orden estable
     * para ese año y distinto en los demás.
     *
     * @return non-empty-list<array{ref:string,text:string}>
     */
    private function barajada(int $anio): array
    {
        $lista = $this->cargar();
        usort(
            $lista,
            static fn (array $a, array $b): int => strcmp(
                hash('sha256', $anio . '|' . $a['ref']),
                hash('sha256', $anio . '|' . $b['ref'])
            )
        );
        return $lista;
    }

    /** @return non-empty-list<array{ref:string,text:string}> */
    private function cargar(): array
    {
        if ($this->lista !== null) {
            return $this->lista;
        }

        $raw   = is_file($this->archivo) ? @file_get_contents($this->archivo) : false;
        $datos = is_string($raw) ? json_decode($raw, true) : null;

        $lista = [];
        foreach (is_array($datos) ? $datos : [] as $v) {
            if (is_array($v) && isset($v['ref'], $v['text']) && trim((string) $v['text']) !== '') {
                $lista[] = ['ref' => (string) $v['ref'], 'text' => trim((string) $v['text'])];
            }
        }

        return $this->lista = $lista !== [] ? $lista : [self::RESPALDO];
    }
}
