<?php
declare(strict_types=1);

/** Estado mutable (archivada/respondida) y salud de la vista de interacciones. */

require_once __DIR__ . '/lib_interacciones_store.php';

function interacciones_set_state(PDO $pdo, string $id, string $action, string $by, bool $answered = false): bool
{
    interacciones_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT conversation_key FROM interaccion_estado WHERE conversation_key = :id1 OR legacy_id = :id2 LIMIT 1');
    $stmt->execute(['id1' => $id, 'id2' => $id]);
    $key = $stmt->fetchColumn();
    if ($key === false) {
        if (!preg_match('/^(\d{6,32})_(\d{4}-\d{2}-\d{2})$/', $id, $m)) {
            return false;
        }
        $tz = interacciones_tz();
        $from = (new DateTimeImmutable($m[2] . ' 00:00:00', $tz))->setTimezone(new DateTimeZone('UTC'));
        $to = $from->modify('+1 day');
        $chk = $pdo->prepare('SELECT 1 FROM interaccion_eventos WHERE wa_id = :wa AND ts_utc >= :a AND ts_utc < :b LIMIT 1');
        $chk->execute(['wa' => $m[1], 'a' => $from->format('Y-m-d H:i:s'), 'b' => $to->format('Y-m-d H:i:s')]);
        if (!$chk->fetchColumn()) {
            return false;
        }
        $key = $id;
    }
    $now = gmdate('Y-m-d H:i:s');
    if ($action === 'archive' || $action === 'unarchive') {
        $flag = $action === 'archive' ? 1 : 0;
        $sql = 'INSERT INTO interaccion_estado (conversation_key, archived, archived_at, updated_at, updated_by)
                VALUES (:k, :f, :at, :now, :by)
                ON DUPLICATE KEY UPDATE archived = VALUES(archived), archived_at = VALUES(archived_at),
                    updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)';
        $pdo->prepare($sql)->execute(['k' => $key, 'f' => $flag, 'at' => $flag ? $now : null, 'now' => $now, 'by' => mb_substr($by, 0, 60, 'UTF-8')]);
        return true;
    }
    $sql = 'INSERT INTO interaccion_estado (conversation_key, answered, answered_at, updated_at, updated_by)
            VALUES (:k, :f, :at, :now, :by)
            ON DUPLICATE KEY UPDATE answered = VALUES(answered), answered_at = VALUES(answered_at),
                updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)';
    $pdo->prepare($sql)->execute(['k' => $key, 'f' => $answered ? 1 : 0, 'at' => $answered ? $now : null, 'now' => $now, 'by' => mb_substr($by, 0, 60, 'UTF-8')]);
    return true;
}

function interacciones_health(?PDO $pdo = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $row = $pdo->query('SELECT COUNT(*) AS n, MAX(ts_utc) AS last_ts, MAX(received_at) AS last_rcv FROM interaccion_eventos')->fetch();
    $reconcile = null;
    $file = interacciones_dir() . '/reconcile_state.json';
    if (is_file($file)) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (is_array($decoded)) {
            $reconcile = [
                'last_run' => $decoded['last_run'] ?? null,
                'last_ok' => $decoded['last_ok'] ?? null,
                'status' => $decoded['status'] ?? null,
                'imported_last_run' => $decoded['imported_last_run'] ?? null,
            ];
        }
    }
    return [
        'total_events' => (int) ($row['n'] ?? 0),
        'last_message_at' => interacciones_iso($row['last_ts'] ?? null),
        'last_received_at' => interacciones_iso($row['last_rcv'] ?? null),
        'spool_pending' => interacciones_spool_pending_count(),
        'reconcile' => $reconcile,
    ];
}
