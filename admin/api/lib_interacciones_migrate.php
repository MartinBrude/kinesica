<?php
declare(strict_types=1);

/**
 * Copias de seguridad atómicas y migración idempotente desde el JSON legado (interacciones.json).
 * El archivo legado NUNCA se modifica ni se borra.
 */

require_once __DIR__ . '/lib_interacciones_store.php';

function interacciones_backup_dir(): string
{
    $dir = interacciones_dir() . '/backups';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function interacciones_write_atomic(string $path, string $contents): bool
{
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $contents, LOCK_EX) !== strlen($contents)) {
        @unlink($tmp);
        return false;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/** Vuelca eventos + estado completos a un JSON. */
function interacciones_export_all(?PDO $pdo = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $events = $pdo->query('SELECT event_key, wa_id, direction, body, ts_utc, patient_name, source, exec_id, received_at FROM interaccion_eventos ORDER BY id ASC')->fetchAll();
    $estado = $pdo->query('SELECT * FROM interaccion_estado')->fetchAll();
    return ['version' => 1, 'exported_at' => gmdate('c'), 'events' => $events, 'estado' => $estado];
}

/** Una copia por día (se dispara de forma oportunista). Conserva las últimas $keep. */
function interacciones_backup_daily(?PDO $pdo = null, int $keep = 30): ?string
{
    $path = interacciones_backup_dir() . '/interacciones-' . gmdate('Ymd') . '.json';
    if (is_file($path)) {
        return null;
    }
    $json = json_encode(interacciones_export_all($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || !interacciones_write_atomic($path, $json)) {
        return null;
    }
    $files = glob(interacciones_backup_dir() . '/interacciones-????????.json') ?: [];
    sort($files);
    foreach (array_slice($files, 0, max(0, count($files) - $keep)) as $old) {
        @unlink($old);
    }
    return $path;
}

/** Restaura eventos desde un backup (idempotente: no duplica, no borra nada). */
function interacciones_restore_from_backup(string $file, ?PDO $pdo = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $data = json_decode((string) @file_get_contents($file), true);
    $res = ['stored' => 0, 'duplicates' => 0];
    foreach (($data['events'] ?? []) as $row) {
        $ev = interacciones_normalize_event([
            'event_key' => $row['event_key'] ?? '', 'wa_id' => $row['wa_id'] ?? '', 'direction' => $row['direction'] ?? '',
            'body' => $row['body'] ?? '', 'ts' => $row['ts_utc'] ?? null, 'patient_name' => $row['patient_name'] ?? '',
            'source' => $row['source'] ?? 'restore', 'exec_id' => $row['exec_id'] ?? '',
        ], 'restore');
        if ($ev !== null) {
            $res[interacciones_insert_event($pdo, $ev) === 'stored' ? 'stored' : 'duplicates']++;
        }
    }
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO interaccion_estado (conversation_key, legacy_id, answered, answered_at, archived, archived_at, category, category_label, summary, patient_name, updated_at, updated_by)
         VALUES (:k, :lid, :a, :aa, :r, :ra, :c, :cl, :s, :n, :u, :ub)'
    );
    foreach (($data['estado'] ?? []) as $e) {
        $stmt->execute([
            'k' => $e['conversation_key'], 'lid' => $e['legacy_id'] ?? null, 'a' => (int) ($e['answered'] ?? 0), 'aa' => $e['answered_at'] ?? null,
            'r' => (int) ($e['archived'] ?? 0), 'ra' => $e['archived_at'] ?? null, 'c' => $e['category'] ?? null, 'cl' => $e['category_label'] ?? null,
            's' => $e['summary'] ?? null, 'n' => $e['patient_name'] ?? null, 'u' => $e['updated_at'] ?? gmdate('Y-m-d H:i:s'), 'ub' => $e['updated_by'] ?? 'restore',
        ]);
    }
    return $res;
}

function interacciones_local_to_ts(string $date, string $time): ?int
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{1,2}:\d{2}$/', $time)) {
        return null;
    }
    try {
        return (new DateTimeImmutable($date . ' ' . $time . ':00', interacciones_tz()))->getTimestamp();
    } catch (Throwable $e) {
        return null;
    }
}

function interacciones_dt_utc($value): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }
    try {
        return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Convierte conversaciones en formato legado a eventos. Claves estables ('lg:') para que re-sincronizar no duplique.
 *
 * @param list<array> $items
 * @return list<array> eventos normalizados
 */
function interacciones_legacy_items_to_events(array $items, string $source = 'legacy'): array
{
    $events = [];
    foreach ($items as $it) {
        if (!is_array($it)) {
            continue;
        }
        $wa = interacciones_clean_wa_id((string) ($it['wa_id'] ?? $it['phone_formatted'] ?? ''));
        $date = (string) ($it['date'] ?? '');
        $fallbackTs = interacciones_parse_ts($it['timestamp'] ?? null, time());
        $messages = is_array($it['messages'] ?? null) ? $it['messages'] : [];
        if (!$messages && trim((string) ($it['summary'] ?? '')) !== '') {
            $messages = [['from' => 'patient', 'time' => (string) ($it['time'] ?? ''), 'text' => (string) $it['summary']]];
        }
        $occ = [];
        foreach ($messages as $m) {
            $dir = ($m['from'] ?? '') === 'patient' ? 'patient' : 'clara';
            $body = trim((string) ($m['text'] ?? ''));
            $ts = interacciones_local_to_ts($date, (string) ($m['time'] ?? '')) ?? $fallbackTs;
            $k = $dir . '|' . $body;
            $occ[$k] = ($occ[$k] ?? 0) + 1;
            $ev = interacciones_normalize_event([
                'event_key' => 'lg:' . sha1($wa . '|' . $date . '|' . $dir . '|' . $body . '|' . $occ[$k]),
                'wa_id' => $wa, 'direction' => $dir, 'body' => $body, 'ts' => $ts,
                'patient_name' => $dir === 'patient' ? (string) ($it['patient_name'] ?? '') : '',
            ], $source);
            if ($ev !== null) {
                $events[] = $ev;
            }
        }
    }
    return $events;
}

/**
 * Migración única desde interacciones.json. Idempotente; deja marcador con conteos.
 *
 * @return array{migrated:bool,events:int,conversations:int,reason?:string}
 */
function interacciones_migrate_legacy(?PDO $pdo = null, ?string $legacyFile = null): array
{
    $pdo = interacciones_pdo($pdo);
    $legacyFile = $legacyFile ?? interacciones_dir() . '/interacciones.json';
    $marker = interacciones_dir() . '/interacciones.migrated.json';
    if (is_file($marker)) {
        return ['migrated' => false, 'events' => 0, 'conversations' => 0, 'reason' => 'already_migrated'];
    }
    if (!is_file($legacyFile)) {
        return ['migrated' => false, 'events' => 0, 'conversations' => 0, 'reason' => 'no_legacy_file'];
    }
    $raw = (string) @file_get_contents($legacyFile);
    $items = json_decode($raw, true);
    if (!is_array($items)) {
        error_log('interacciones: interacciones.json ilegible; migración omitida (se conserva el archivo).');
        return ['migrated' => false, 'events' => 0, 'conversations' => 0, 'reason' => 'unreadable_legacy'];
    }
    interacciones_ensure_schema($pdo);
    @copy($legacyFile, interacciones_backup_dir() . '/legacy-interacciones-' . gmdate('Ymd-His') . '.json');

    $events = interacciones_legacy_items_to_events($items, 'legacy');
    foreach ($events as $ev) {
        interacciones_insert_event($pdo, $ev);
    }
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO interaccion_estado (conversation_key, legacy_id, answered, answered_at, archived, archived_at, category, category_label, summary, patient_name, updated_at, updated_by)
         VALUES (:k, :lid, :a, :aa, :r, :ra, :c, :cl, :s, :n, :u, :ub)'
    );
    $convs = 0;
    foreach ($items as $it) {
        $wa = interacciones_clean_wa_id((string) ($it['wa_id'] ?? ''));
        if ($wa === '' || empty($it['date'])) {
            continue;
        }
        $stmt->execute([
            'k' => $wa . '_' . $it['date'], 'lid' => isset($it['id']) ? substr((string) $it['id'], 0, 64) : null,
            'a' => !empty($it['answered']) ? 1 : 0, 'aa' => interacciones_dt_utc($it['answered_at'] ?? null),
            'r' => !empty($it['archived']) ? 1 : 0, 'ra' => interacciones_dt_utc($it['archived_at'] ?? null),
            'c' => $it['category'] ?? null, 'cl' => $it['category_label'] ?? null,
            's' => isset($it['summary']) ? mb_substr((string) $it['summary'], 0, 255, 'UTF-8') : null,
            'n' => ($it['patient_name'] ?? '') !== '' ? (string) $it['patient_name'] : null,
            'u' => gmdate('Y-m-d H:i:s'), 'ub' => 'migracion',
        ]);
        $convs++;
    }
    interacciones_write_atomic($marker, json_encode([
        'migrated_at' => gmdate('c'), 'source_sha1' => sha1($raw), 'items' => count($items), 'events' => count($events), 'conversations' => $convs,
    ]));
    return ['migrated' => true, 'events' => count($events), 'conversations' => $convs];
}
