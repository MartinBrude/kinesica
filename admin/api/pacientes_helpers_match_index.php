<?php
declare(strict_types=1);

/**
 * Índice en memoria de `pacientes` por clave canónica de nombre para lotes de lectura
 * (recordatorios, campaña). Reduce kinesica_match_by_canonical_name() de O(N*M) a O(N+M).
 */

function kinesica_match_batch_store(?PDO $pdo = null, ?string $op = null, ?string $aliveSql = null): ?array
{
    static $batches = null;
    $batches = $batches ?? new WeakMap();
    if ($pdo === null) {
        return null;
    }
    if ($op === 'begin') {
        $batches[$pdo] = ['alive' => $aliveSql ?? '1=1', 'by_key' => null];
        return null;
    }
    if ($op === 'end') {
        unset($batches[$pdo]);
        return null;
    }
    if ($op === 'invalidate') {
        if (isset($batches[$pdo])) {
            $entry = $batches[$pdo];
            $entry['by_key'] = null;
            $batches[$pdo] = $entry;
        }
        return null;
    }
    if (!isset($batches[$pdo])) {
        return null;
    }
    $entry = $batches[$pdo];
    if ($aliveSql !== null && $entry['alive'] !== $aliveSql) {
        return null;
    }
    if ($entry['by_key'] === null) {
        $byKey = [];
        $stmt = $pdo->query(
            "SELECT * FROM pacientes WHERE ({$entry['alive']})"
        );
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $full = trim((string) (($row['nombre_completo'] ?? '') ?: trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''))));
                $k1 = canonical_patient_name_key($full);
                if ($k1 !== '') {
                    $byKey[$k1][] = $row;
                }
                $alt = trim((string) (($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? '')));
                $k2 = canonical_patient_name_key($alt);
                if ($k2 !== '' && $k2 !== $k1) {
                    $byKey[$k2][] = $row;
                }
            }
        }
        $entry['by_key'] = $byKey;
        $batches[$pdo] = $entry;
    }
    return $entry['by_key'];
}

function kinesica_match_begin_batch(PDO $pdo, string $aliveSql): void
{
    kinesica_match_batch_store($pdo, 'begin', $aliveSql);
}

function kinesica_match_end_batch(PDO $pdo): void
{
    kinesica_match_batch_store($pdo, 'end');
}
