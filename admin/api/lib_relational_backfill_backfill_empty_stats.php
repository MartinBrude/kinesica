<?php
declare(strict_types=1);


/**
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   ambiguous:int,unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_empty_stats(string $table): array
{
    return [
        'table' => $table,
        'scanned' => 0,
        'already_set' => 0,
        'updated' => 0,
        'matched' => 0,
        'ambiguous' => 0,
        'unmatched' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
}

/**
 * @param array<string,mixed> $stats
 * @param array<string,mixed> $sample
 */

/**
 * @param array<string,mixed> $stats
 * @param array<string,mixed> $sample
 */
function kinesica_rel_backfill_push_sample(array &$stats, array $sample, int $limit = 25): void
{
    if (count($stats['samples']) >= $limit) {
        return;
    }
    $stats['samples'][] = $sample;
}

/**
 * @return array<string,mixed>
 */

/**
 * @return array<string,mixed>
 */
function kinesica_rel_backfill_fichas(PDO $pdo, bool $apply): array
{
    $stats = kinesica_rel_backfill_empty_stats('fichas');
    if (!kinesica_migrations_table_exists($pdo, 'fichas')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $rows = $pdo->query('SELECT id, payload, paciente_id, profesional FROM fichas')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $upd = $apply
        ? $pdo->prepare('UPDATE fichas SET paciente_id = :pid WHERE id = :id AND paciente_id IS NULL')
        : null;

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['paciente_id'] !== null && $row['paciente_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $payload = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) {
            $stats['unmatched']++;
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (string) $row['id'],
                'status' => 'unmatched',
                'reason' => 'payload_invalido',
            ]);
            continue;
        }
        $res = kinesica_rel_resolve_paciente($pdo, [
            'dni' => (string) ($payload['dni'] ?? ''),
            'nombre' => (string) ($payload['nombre'] ?? ''),
        ], ['ignore_flag' => true]);

        if ($res['status'] === 'matched' && $res['paciente_id'] !== null) {
            $stats['matched']++;
            if ($apply && $upd) {
                $upd->execute(['pid' => $res['paciente_id'], 'id' => $row['id']]);
                $stats['updated'] += $upd->rowCount() > 0 ? 1 : 0;
            }
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (string) $row['id'],
                'status' => 'matched',
                'reason' => $res['reason'],
                'paciente_id' => $res['paciente_id'],
            ]);
        } elseif ($res['status'] === 'ambiguous') {
            $stats['ambiguous']++;
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (string) $row['id'],
                'status' => 'ambiguous',
                'reason' => $res['reason'],
                'candidates' => $res['candidates'],
            ]);
        } else {
            $stats['unmatched']++;
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (string) $row['id'],
                'status' => 'unmatched',
                'reason' => $res['reason'],
            ]);
        }
    }

    return $stats;
}

/**
 * @return array<string,mixed>
 */

/**
 * @return array<string,mixed>
 */
function kinesica_rel_backfill_lista_espera(PDO $pdo, bool $apply): array
{
    $stats = kinesica_rel_backfill_empty_stats('lista_espera');
    if (!kinesica_migrations_table_exists($pdo, 'lista_espera')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $rows = $pdo->query(
        'SELECT id, paciente_telefono, paciente_nombre, paciente_id FROM lista_espera'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $upd = $apply
        ? $pdo->prepare('UPDATE lista_espera SET paciente_id = :pid WHERE id = :id AND paciente_id IS NULL')
        : null;

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['paciente_id'] !== null && $row['paciente_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $res = kinesica_rel_resolve_paciente($pdo, [
            'phone' => (string) ($row['paciente_telefono'] ?? ''),
            'nombre' => (string) ($row['paciente_nombre'] ?? ''),
        ], ['ignore_flag' => true]);

        if ($res['status'] === 'matched' && $res['paciente_id'] !== null) {
            $stats['matched']++;
            if ($apply && $upd) {
                $upd->execute(['pid' => $res['paciente_id'], 'id' => $row['id']]);
                $stats['updated'] += $upd->rowCount() > 0 ? 1 : 0;
            }
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (int) $row['id'],
                'status' => 'matched',
                'reason' => $res['reason'],
                'paciente_id' => $res['paciente_id'],
            ]);
        } elseif ($res['status'] === 'ambiguous') {
            $stats['ambiguous']++;
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (int) $row['id'],
                'status' => 'ambiguous',
                'reason' => $res['reason'],
            ]);
        } else {
            $stats['unmatched']++;
            kinesica_rel_backfill_push_sample($stats, [
                'id' => (int) $row['id'],
                'status' => 'unmatched',
                'reason' => $res['reason'],
            ]);
        }
    }

    return $stats;
}

/**
 * @return array<string,mixed>
 */
