<?php
declare(strict_types=1);


/**
 * @param array{wa_id?:string,patient_name?:string,force?:bool,updated_by?:string} $opts
 */
function kinesica_rel_set_interaccion_estado_paciente(
    PDO $pdo,
    string $key,
    ?int $pacienteId,
    array $opts = []
): void {
    if (!kinesica_rel_interaccion_estado_has_paciente($pdo) || $key === '') {
        return;
    }
    $force = !empty($opts['force']);
    $wa = preg_replace('/\D+/', '', (string) ($opts['wa_id'] ?? '')) ?? '';
    $name = mb_substr(trim((string) ($opts['patient_name'] ?? '')), 0, 120, 'UTF-8');
    $by = mb_substr(trim((string) ($opts['updated_by'] ?? 'rel')), 0, 60, 'UTF-8') ?: 'rel';
    $now = gmdate('Y-m-d H:i:s');
    $pid = $pacienteId !== null && $pacienteId > 0 ? $pacienteId : null;
    $hasWa = kinesica_migrations_column_exists($pdo, 'interaccion_estado', 'wa_id');

    $exists = $pdo->prepare('SELECT conversation_key, paciente_id FROM interaccion_estado WHERE conversation_key = :k LIMIT 1');
    $exists->execute(['k' => $key]);
    $row = $exists->fetch(PDO::FETCH_ASSOC);

    $nextPid = $pid;
    if (is_array($row) && !$force) {
        $cur = $row['paciente_id'] !== null && $row['paciente_id'] !== '' ? (int) $row['paciente_id'] : null;
        if ($cur !== null && $cur > 0) {
            $nextPid = $cur; // no pisa
        } elseif ($pid === null) {
            $nextPid = null;
        }
    }

    if (is_array($row)) {
        if ($hasWa) {
            $pdo->prepare(
                'UPDATE interaccion_estado SET
                    paciente_id = :pid,
                    wa_id = COALESCE(wa_id, :wa),
                    patient_name = CASE WHEN :name = \'\' THEN patient_name ELSE :name2 END,
                    updated_at = :now,
                    updated_by = :by
                 WHERE conversation_key = :k'
            )->execute([
                'pid' => $nextPid,
                'wa' => $wa !== '' ? $wa : null,
                'name' => $name,
                'name2' => $name,
                'now' => $now,
                'by' => $by,
                'k' => $key,
            ]);
        } else {
            $pdo->prepare(
                'UPDATE interaccion_estado SET paciente_id = :pid, updated_at = :now, updated_by = :by
                 WHERE conversation_key = :k'
            )->execute(['pid' => $nextPid, 'now' => $now, 'by' => $by, 'k' => $key]);
        }
        return;
    }

    if ($hasWa) {
        $pdo->prepare(
            'INSERT INTO interaccion_estado (conversation_key, paciente_id, wa_id, patient_name, updated_at, updated_by)
             VALUES (:k, :pid, :wa, :name, :now, :by)'
        )->execute([
            'k' => $key,
            'pid' => $nextPid,
            'wa' => $wa !== '' ? $wa : null,
            'name' => $name,
            'now' => $now,
            'by' => $by,
        ]);
        return;
    }
    $pdo->prepare(
        'INSERT INTO interaccion_estado (conversation_key, paciente_id, patient_name, updated_at, updated_by)
         VALUES (:k, :pid, :name, :now, :by)'
    )->execute([
        'k' => $key,
        'pid' => $nextPid,
        'name' => $name,
        'now' => $now,
        'by' => $by,
    ]);
}

/**
 * Backfill paciente_id en interaccion_estado desde eventos del mismo wa_id.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */

/**
 * Backfill paciente_id en interaccion_estado desde eventos del mismo wa_id.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_interaccion_estado(PDO $pdo, bool $apply): array
{
    $stats = [
        'table' => 'interaccion_estado',
        'scanned' => 0,
        'already_set' => 0,
        'updated' => 0,
        'matched' => 0,
        'unmatched' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
    if (!kinesica_rel_interaccion_estado_has_paciente($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_table_exists($pdo, 'interaccion_eventos')
        || !kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $rows = $pdo->query('SELECT conversation_key, paciente_id FROM interaccion_estado')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    // Match por wa_id exacto o sufijo (AR 54/549).
    $findEv = $pdo->prepare(
        'SELECT paciente_id FROM interaccion_eventos
         WHERE paciente_id IS NOT NULL AND paciente_id != \'\'
           AND (wa_id = :wa OR wa_id LIKE :wa_like)
         ORDER BY id DESC LIMIT 1'
    );
    $upd = $apply
        ? $pdo->prepare(
            'UPDATE interaccion_estado SET paciente_id = :pid
             WHERE conversation_key = :k AND (paciente_id IS NULL OR paciente_id = \'\')'
        )
        : null;
    $updWa = null;
    if ($apply && kinesica_migrations_column_exists($pdo, 'interaccion_estado', 'wa_id')) {
        $updWa = $pdo->prepare(
            'UPDATE interaccion_estado SET wa_id = COALESCE(wa_id, :wa) WHERE conversation_key = :k'
        );
    }

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['paciente_id'] !== null && $row['paciente_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $key = (string) $row['conversation_key'];
        $wa = '';
        if (preg_match('/^(\d{6,32})_(\d{4}-\d{2}-\d{2})$/', $key, $m)) {
            $wa = $m[1];
        }
        if ($wa === '') {
            $stats['unmatched']++;
            continue;
        }
        $findEv->execute(['wa' => $wa, 'wa_like' => '%' . substr($wa, -10)]);
        $pid = $findEv->fetchColumn();
        if (!$pid) {
            // Resolve from pacientes by phone if no event ID yet.
            try {
                require_once __DIR__ . '/lib_relational_resolve.php';
                $res = kinesica_rel_resolve_paciente($pdo, ['wa_id' => $wa, 'phone' => $wa], ['ignore_flag' => true]);
                $pid = ($res['status'] ?? '') === 'matched' ? ($res['paciente_id'] ?? null) : null;
            } catch (Throwable) {
                $pid = null;
            }
        }
        if (!$pid) {
            $stats['unmatched']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['key' => $key, 'status' => 'unmatched'];
            }
            continue;
        }
        $stats['matched']++;
        if ($apply && $upd) {
            $upd->execute(['pid' => (int) $pid, 'k' => $key]);
            $stats['updated'] += $upd->rowCount() > 0 ? 1 : 0;
            if ($updWa) {
                $updWa->execute(['wa' => $wa, 'k' => $key]);
            }
        }
        if (count($stats['samples']) < 25) {
            $stats['samples'][] = ['key' => $key, 'status' => 'matched', 'paciente_id' => (int) $pid];
        }
    }

    return $stats;
}
