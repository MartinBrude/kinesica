<?php
declare(strict_types=1);

/**
 * Backfill read/write de paciente_id en tablas existentes (etapa 3–4).
 * No fusiona ambiguos. Idempotente: solo toca filas con paciente_id NULL.
 */

require_once __DIR__ . '/lib_relational_resolve.php';
require_once __DIR__ . '/lib_migrations.php';

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
function kinesica_rel_backfill_interacciones(PDO $pdo, bool $apply): array
{
    $stats = kinesica_rel_backfill_empty_stats('interaccion_eventos');
    if (!kinesica_migrations_table_exists($pdo, 'interaccion_eventos')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    // Agrupar por wa_id: un match aplica a todos los eventos de esa conversación.
    $rows = $pdo->query(
        'SELECT id, wa_id, patient_name, paciente_id FROM interaccion_eventos'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $byWa = [];
    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['paciente_id'] !== null && $row['paciente_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $wa = preg_replace('/\D+/', '', (string) ($row['wa_id'] ?? '')) ?? '';
        if ($wa === '') {
            $stats['unmatched']++;
            continue;
        }
        $byWa[$wa][] = $row;
    }

    $updById = $apply
        ? $pdo->prepare(
            'UPDATE interaccion_eventos SET paciente_id = :pid WHERE id = :id AND paciente_id IS NULL'
        )
        : null;

    foreach ($byWa as $wa => $group) {
        $sampleName = (string) ($group[0]['patient_name'] ?? '');
        $res = kinesica_rel_resolve_paciente($pdo, [
            'wa_id' => (string) $wa,
            'nombre' => $sampleName,
        ], ['ignore_flag' => true]);

        if ($res['status'] === 'matched' && $res['paciente_id'] !== null) {
            $stats['matched'] += count($group);
            if ($apply && $updById) {
                foreach ($group as $row) {
                    $updById->execute(['pid' => $res['paciente_id'], 'id' => $row['id']]);
                    $stats['updated'] += $updById->rowCount() > 0 ? 1 : 0;
                }
            }
            kinesica_rel_backfill_push_sample($stats, [
                'wa_suffix' => substr((string) $wa, -4),
                'events' => count($group),
                'status' => 'matched',
                'reason' => $res['reason'],
                'paciente_id' => $res['paciente_id'],
            ]);
        } elseif ($res['status'] === 'ambiguous') {
            $stats['ambiguous'] += count($group);
            kinesica_rel_backfill_push_sample($stats, [
                'wa_suffix' => substr((string) $wa, -4),
                'events' => count($group),
                'status' => 'ambiguous',
                'reason' => $res['reason'],
            ]);
        } else {
            $stats['unmatched'] += count($group);
            kinesica_rel_backfill_push_sample($stats, [
                'wa_suffix' => substr((string) $wa, -4),
                'events' => count($group),
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
function kinesica_rel_backfill_recordatorios(PDO $pdo, bool $apply): array
{
    $stats = kinesica_rel_backfill_empty_stats('recordatorio_eventos');
    if (!kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $rows = $pdo->query(
        'SELECT id, wa_id, patient_name, paciente_id FROM recordatorio_eventos'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $upd = $apply
        ? $pdo->prepare(
            'UPDATE recordatorio_eventos SET paciente_id = :pid WHERE id = :id AND paciente_id IS NULL'
        )
        : null;

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['paciente_id'] !== null && $row['paciente_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $res = kinesica_rel_resolve_paciente($pdo, [
            'wa_id' => (string) ($row['wa_id'] ?? ''),
            'nombre' => (string) ($row['patient_name'] ?? ''),
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
 * @param list<string>|null $onlyTables
 * @return array{generated_at:string,apply:bool,tables:array<string,array>}
 */
function kinesica_rel_backfill_run(PDO $pdo, bool $apply, ?array $onlyTables = null): array
{
    require_once __DIR__ . '/lib_relational_contactos.php';
    require_once __DIR__ . '/lib_relational_profesionales.php';
    $all = [
        'fichas' => 'kinesica_rel_backfill_fichas',
        'lista_espera' => 'kinesica_rel_backfill_lista_espera',
        'interaccion_eventos' => 'kinesica_rel_backfill_interacciones',
        'recordatorio_eventos' => 'kinesica_rel_backfill_recordatorios',
        'paciente_contactos' => 'kinesica_rel_backfill_paciente_contactos',
        'fichas_profesional_id' => 'kinesica_rel_backfill_fichas_profesional_id',
        'lista_espera_profesional_id' => 'kinesica_rel_backfill_lista_profesional_id',
    ];
    $tables = [];
    foreach ($all as $name => $fn) {
        if ($onlyTables !== null && !in_array($name, $onlyTables, true)) {
            continue;
        }
        $tables[$name] = $fn($pdo, $apply);
    }
    return [
        'generated_at' => gmdate('c'),
        'apply' => $apply,
        'tables' => $tables,
    ];
}
