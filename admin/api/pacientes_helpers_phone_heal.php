<?php
declare(strict_types=1);

/**
 * Reparación persistente (admin action=heal_phones) de teléfonos 54/549 pegados sobre CC extranjeros.
 */

/**
 * @return array{scanned:int, healed:int, skipped_conflict:int, skipped_error:int, samples:list<array<string,mixed>>}
 */
function kinesica_pacientes_heal_corrupt_phones(PDO $pdo, int $limit = 200): array
{
    $limit = max(1, min(500, $limit));
    if (!function_exists('kinesica_pacientes_alive_sql')) {
        require_once __DIR__ . '/pacientes_helpers_alive.php';
    }
    $alive = kinesica_pacientes_alive_sql($pdo);

    // Overfetch candidatos 54…; el filtro fino (549+CC extranjero) es en PHP.
    $fetchLimit = min(2000, max($limit * 10, 200));
    $stmt = $pdo->query(
        "SELECT id, telefono, contacto_telefono FROM pacientes
         WHERE ({$alive})
           AND (telefono LIKE '54%' OR contacto_telefono LIKE '54%')
         ORDER BY id ASC
         LIMIT " . (int) $fetchLimit
    );
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

    $scannedCorrupt = 0;
    $healed = 0;
    $skippedConflict = 0;
    $skippedError = 0;
    $samples = [];
    $conflictCheck = $pdo->prepare(
        "SELECT id FROM pacientes WHERE telefono = :tel AND id != :id AND ({$alive}) LIMIT 1"
    );
    $updateTel = $pdo->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id LIMIT 1');
    $updateCtel = $pdo->prepare('UPDATE pacientes SET contacto_telefono = :tel WHERE id = :id LIMIT 1');

    foreach ($rows as $row) {
        if ($scannedCorrupt >= $limit) {
            break;
        }
        $id = (int) ($row['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }
        foreach (['telefono' => $updateTel, 'contacto_telefono' => $updateCtel] as $field => $updateStmt) {
            if ($scannedCorrupt >= $limit) {
                break;
            }
            $raw = trim((string) ($row[$field] ?? ''));
            if ($raw === '' || !preg_match('/^\d+$/', $raw) || !kinesica_phone_is_ar_prefix_over_foreign($raw)) {
                continue;
            }
            $scannedCorrupt++;
            $clean = clean_phone_number($raw);
            if ($clean === '' || $clean === $raw) {
                continue;
            }
            if ($field === 'telefono') {
                $conflictCheck->execute(['tel' => $clean, 'id' => $id]);
                $conflict = $conflictCheck->fetch(PDO::FETCH_ASSOC);
                if ($conflict) {
                    $skippedConflict++;
                    if (count($samples) < 20) {
                        $samples[] = [
                            'id' => $id,
                            'field' => $field,
                            'from' => $raw,
                            'to' => $clean,
                            'skipped' => 'conflict',
                            'conflict_id' => (int) ($conflict['id'] ?? 0),
                        ];
                    }
                    continue;
                }
            }
            try {
                $updateStmt->execute(['tel' => $clean, 'id' => $id]);
                $healed++;
                if (count($samples) < 20) {
                    $samples[] = [
                        'id' => $id,
                        'field' => $field,
                        'from' => $raw,
                        'to' => $clean,
                    ];
                }
            } catch (Throwable) {
                $skippedError++;
            }
        }
    }

    return [
        'scanned' => $scannedCorrupt,
        'healed' => $healed,
        'skipped_conflict' => $skippedConflict,
        'skipped_error' => $skippedError,
        'samples' => $samples,
    ];
}
