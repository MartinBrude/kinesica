<?php
declare(strict_types=1);

/**
 * Cuándo unificar pacientes automáticamente:
 * - Al crear uno nuevo → solo candidatos cercanos (tel / DNI / nombre).
 * - Cada cierto tiempo → barrido completo vía maintenance (marker ~6h / cron).
 * Soft-deleted no participan. Docs: docs/pacientes-dedupe.md
 */

require_once __DIR__ . '/pacientes_helpers_dedup_apply.php';
require_once __DIR__ . '/pacientes_helpers_dedupe_candidates.php';

/**
 * Une duplicados que involucren a $patientId.
 *
 * @return array{merged:int,survivor_id:int}
 */
function kinesica_pacientes_dedupe_around_patient(PDO $pdo, int $patientId): array
{
    if ($patientId <= 0) {
        return ['merged' => 0, 'survivor_id' => 0];
    }

    $stmt = $pdo->prepare('SELECT * FROM pacientes WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $patientId]);
    $me = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$me || !kinesica_pacientes_row_is_active($me)) {
        return ['merged' => 0, 'survivor_id' => 0];
    }

    $rows = kinesica_pacientes_dedupe_candidates_for($pdo, $me);
    if (count($rows) <= 1) {
        return ['merged' => 0, 'survivor_id' => $patientId];
    }

    $n = count($rows);
    $parent = range(0, $n - 1);
    $find = static function (int $i) use (&$parent, &$find): int {
        if ($parent[$i] === $i) {
            return $i;
        }
        return $parent[$i] = $find($parent[$i]);
    };
    $union = static function (int $i, int $j) use (&$parent, &$find): void {
        $rootI = $find($i);
        $rootJ = $find($j);
        if ($rootI !== $rootJ) {
            $parent[$rootI] = $rootJ;
        }
    };

    $byDni = [];
    $byName = [];
    $byPhone = [];
    foreach ($rows as $idx => $r) {
        $dni = clean_patient_dni($r['dni'] ?? null);
        if ($dni === '' && str_starts_with((string) ($r['telefono'] ?? ''), 'sin-tel-dni-')) {
            $dni = substr((string) $r['telefono'], 12);
        }
        if ($dni !== '') {
            if (isset($byDni[$dni])) {
                $union($idx, $byDni[$dni]);
            } else {
                $byDni[$dni] = $idx;
            }
        }

        $rawPhone = (string) ($r['telefono'] ?? '');
        $cleanPhone = clean_phone_number($rawPhone);
        if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone) && !is_placeholder_phone($rawPhone)) {
            if (isset($byPhone[$cleanPhone])) {
                $union($idx, $byPhone[$cleanPhone]);
            } else {
                $byPhone[$cleanPhone] = $idx;
            }
        }

        $full = trim((string) (($r['nombre_completo'] ?? '') ?: trim(($r['nombre'] ?? '') . ' ' . ($r['apellido'] ?? ''))));
        $nameKey = canonical_patient_name_key($full);
        if ($nameKey !== '' && str_contains($nameKey, ' ')) {
            if (isset($byName[$nameKey])) {
                $otherIdx = $byName[$nameKey];
                if (kinesica_phones_compatible_for_name_merge(
                    (string) ($rows[$otherIdx]['telefono'] ?? ''),
                    $rawPhone
                )) {
                    $union($idx, $otherIdx);
                }
            } else {
                $byName[$nameKey] = $idx;
            }
        }
    }

    $clusters = [];
    for ($i = 0; $i < $n; $i++) {
        $clusters[$find($i)][] = $rows[$i];
    }

    $relevant = [];
    $clusterIds = [];
    foreach ($clusters as $cluster) {
        if (count($cluster) <= 1) {
            continue;
        }
        foreach ($cluster as $c) {
            if ((int) ($c['id'] ?? 0) === $patientId) {
                $relevant[] = $cluster;
                foreach ($cluster as $row) {
                    $clusterIds[] = (int) ($row['id'] ?? 0);
                }
                break;
            }
        }
    }

    if ($relevant === []) {
        return ['merged' => 0, 'survivor_id' => $patientId];
    }

    $merged = kinesica_pacientes_dedup_apply_clusters($pdo, $relevant);

    $survivorId = $patientId;
    $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
    $chk->execute(['id' => $patientId]);
    if (!$chk->fetchColumn()) {
        $survivorId = 0;
        foreach (array_unique($clusterIds) as $cid) {
            if ($cid <= 0 || $cid === $patientId) {
                continue;
            }
            $chk->execute(['id' => $cid]);
            if ($chk->fetchColumn()) {
                $survivorId = $cid;
                break;
            }
        }
    }

    return ['merged' => $merged, 'survivor_id' => $survivorId > 0 ? $survivorId : $patientId];
}

/**
 * Tras un alta: intenta unificar alrededor del nuevo id.
 * Nunca lanza. Devuelve el id survivor (el original si no hubo unión).
 */
function kinesica_pacientes_try_dedupe_after_create(PDO $pdo, int $patientId): int
{
    if ($patientId <= 0) {
        return 0;
    }
    try {
        $res = kinesica_pacientes_dedupe_around_patient($pdo, $patientId);
        return (int) ($res['survivor_id'] ?? $patientId);
    } catch (Throwable $e) {
        error_log('kinesica_pacientes_try_dedupe_after_create: ' . $e->getMessage());
        return $patientId;
    }
}
