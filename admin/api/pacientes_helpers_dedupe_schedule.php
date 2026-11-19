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
require_once __DIR__ . '/pacientes_helpers_dedupe_link.php';

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

    $clusters = kinesica_dedupe_build_clusters($rows);

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
