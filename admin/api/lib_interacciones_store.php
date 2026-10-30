<?php
declare(strict_types=1);

/**
 * Almacén durable de interacciones de WhatsApp.
 *
 * Principios:
 *  - Solo se AGREGA: los eventos (mensajes) son inmutables y tienen clave única (idempotencia).
 *  - Si la BD falla, el evento se guarda en un spool en disco y se reintegra luego: nunca se descarta.
 *  - La vista (conversaciones) se deriva de los eventos; ver lib_interacciones_view.php.
 */

require_once __DIR__ . '/lib_interacciones_spool.php';

const INTERACCIONES_MAX_BODY = 16000;
const INTERACCIONES_MAX_BATCH = 200;

function interacciones_dir(): string
{
    $dir = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    if ($dir === '') {
        $dir = __DIR__ . '/data';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function interacciones_tz(): DateTimeZone
{
    $name = 'America/Argentina/Buenos_Aires';
    if (function_exists('cfg')) {
        $configured = cfg()['interacciones_tz'] ?? '';
        if (is_string($configured) && $configured !== '') {
            $name = $configured;
        }
    }
    try {
        return new DateTimeZone($name);
    } catch (Throwable $e) {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    }
}

function interacciones_pdo(?PDO $pdo = null): PDO
{
    return $pdo ?? db();
}

function interacciones_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = interacciones_pdo($pdo);
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_eventos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(100) NOT NULL,
            wa_id VARCHAR(32) NOT NULL,
            direction VARCHAR(16) NOT NULL,
            body MEDIUMTEXT NOT NULL,
            ts_utc DATETIME NOT NULL,
            patient_name VARCHAR(120) NOT NULL DEFAULT \'\',
            source VARCHAR(24) NOT NULL DEFAULT \'\',
            exec_id VARCHAR(32) NULL,
            received_at DATETIME NOT NULL,
            UNIQUE KEY uq_event_key (event_key),
            KEY idx_wa_ts (wa_id, ts_utc),
            KEY idx_ts (ts_utc)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_estado (
            conversation_key VARCHAR(64) NOT NULL PRIMARY KEY,
            legacy_id VARCHAR(64) NULL,
            answered TINYINT(1) NOT NULL DEFAULT 0,
            answered_at DATETIME NULL,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            archived_at DATETIME NULL,
            category VARCHAR(40) NULL,
            category_label VARCHAR(80) NULL,
            summary VARCHAR(255) NULL,
            patient_name VARCHAR(120) NULL,
            updated_at DATETIME NOT NULL,
            updated_by VARCHAR(60) NOT NULL DEFAULT \'\',
            KEY idx_legacy (legacy_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $done[$pdo] = true;
}

/** Epoch desde epoch numérico, ISO-8601 o 'Y-m-d H:i:s' (UTC si no trae zona). */
function interacciones_parse_ts($value, int $fallback): int
{
    if (is_int($value) || (is_string($value) && preg_match('/^\d{9,13}(\.\d+)?$/', $value))) {
        $n = (float) $value;
        return (int) ($n > 99999999999 ? $n / 1000 : $n);
    }
    if (is_string($value) && trim($value) !== '') {
        try {
            return (new DateTimeImmutable(trim($value), new DateTimeZone('UTC')))->getTimestamp();
        } catch (Throwable $e) {
        }
    }
    return $fallback;
}

function interacciones_clean_wa_id(string $raw): string
{
    return preg_replace('/\D/', '', $raw) ?? '';
}

/**
 * Normaliza un evento entrante. Devuelve null si no es válido (nunca lanza).
 *
 * @return array{event_key:string,wa_id:string,direction:string,body:string,ts:int,patient_name:string,source:string,exec_id:?string}|null
 */
function interacciones_normalize_event(array $in, string $defaultSource = 'push', ?int $now = null): ?array
{
    $now = $now ?? time();
    $wa = interacciones_clean_wa_id((string) ($in['wa_id'] ?? ''));
    $dir = strtolower(trim((string) ($in['direction'] ?? $in['from'] ?? '')));
    $body = trim((string) ($in['body'] ?? $in['text'] ?? ''));
    if (strlen($wa) < 6 || ($dir !== 'patient' && $dir !== 'clara') || $body === '') {
        return null;
    }
    if (mb_strlen($body, 'UTF-8') > INTERACCIONES_MAX_BODY) {
        $body = mb_substr($body, 0, INTERACCIONES_MAX_BODY, 'UTF-8');
    }
    $ts = interacciones_parse_ts($in['ts'] ?? $in['timestamp'] ?? null, $now);
    $msgId = trim((string) ($in['message_id'] ?? ''));
    $execId = trim((string) ($in['exec_id'] ?? ''));
    $explicit = trim((string) ($in['event_key'] ?? ''));
    $suffix = $dir === 'clara' ? ':r' : '';
    if ($explicit !== '') {
        $key = substr(preg_replace('/[^A-Za-z0-9:_\-.|]/', '', $explicit) ?? '', 0, 100);
    } elseif ($msgId !== '') {
        $key = 'wa:' . substr(preg_replace('/[^A-Za-z0-9=_\-.]/', '', $msgId) ?? '', 0, 80) . $suffix;
    } elseif ($execId !== '') {
        $key = 'ex:' . substr(preg_replace('/[^A-Za-z0-9_\-]/', '', $execId) ?? '', 0, 40) . ':' . $dir;
    } else {
        $key = '';
    }
    if ($key === '') {
        $key = 'h:' . sha1($wa . '|' . $dir . '|' . $ts . '|' . $body);
    }
    return [
        'event_key' => $key,
        'wa_id' => $wa,
        'direction' => $dir,
        'body' => $body,
        'ts' => $ts,
        'patient_name' => mb_substr(trim((string) ($in['patient_name'] ?? '')), 0, 120, 'UTF-8'),
        'source' => substr(preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) ($in['source'] ?? $defaultSource))) ?? '', 0, 24),
        'exec_id' => $execId !== '' ? substr($execId, 0, 32) : null,
    ];
}

/**
 * Inserta un evento. Idempotente y sin pérdida:
 *  - misma clave y mismo texto => duplicado (se ignora)
 *  - misma clave y texto distinto => se guarda como variante (nunca se descarta)
 * Lanza PDOException solo ante fallos reales de BD.
 *
 * @return string 'stored'|'duplicate'
 */
function interacciones_insert_event(PDO $pdo, array $ev): string
{
    $sql = 'INSERT INTO interaccion_eventos (event_key, wa_id, direction, body, ts_utc, patient_name, source, exec_id, received_at)
            VALUES (:k, :wa, :dir, :body, :ts, :name, :src, :exec, :rcv)';
    $params = [
        'k' => $ev['event_key'], 'wa' => $ev['wa_id'], 'dir' => $ev['direction'], 'body' => $ev['body'],
        'ts' => gmdate('Y-m-d H:i:s', (int) $ev['ts']), 'name' => $ev['patient_name'], 'src' => $ev['source'],
        'exec' => $ev['exec_id'], 'rcv' => gmdate('Y-m-d H:i:s'),
    ];
    try {
        $pdo->prepare($sql)->execute($params);
        return 'stored';
    } catch (PDOException $e) {
        if (!interacciones_is_duplicate_error($e)) {
            throw $e;
        }
    }
    $stmt = $pdo->prepare('SELECT body FROM interaccion_eventos WHERE event_key = :k LIMIT 1');
    $stmt->execute(['k' => $ev['event_key']]);
    $existing = $stmt->fetchColumn();
    if ($existing === $ev['body']) {
        return 'duplicate';
    }
    $params['k'] = substr($ev['event_key'], 0, 90) . '~' . substr(sha1($ev['body']), 0, 8);
    try {
        $pdo->prepare($sql)->execute($params);
        return 'stored';
    } catch (PDOException $e) {
        if (interacciones_is_duplicate_error($e)) {
            return 'duplicate';
        }
        throw $e;
    }
}

function interacciones_is_duplicate_error(PDOException $e): bool
{
    return (string) $e->getCode() === '23000' || (int) ($e->errorInfo[1] ?? 0) === 1062;
}

/**
 * Guarda eventos de forma durable. Si la BD falla, los pasa al spool en disco.
 *
 * @param list<array> $events eventos YA normalizados
 * @return array{stored:int,duplicates:int,spooled:int,failed:int}
 */
function interacciones_store_events(array $events, ?PDO $pdo = null): array
{
    $res = ['stored' => 0, 'duplicates' => 0, 'spooled' => 0, 'failed' => 0];
    $remaining = array_values($events);
    try {
        $pdo = interacciones_pdo($pdo);
        interacciones_ensure_schema($pdo);
        while ($remaining) {
            $outcome = interacciones_insert_event($pdo, $remaining[0]);
            $res[$outcome === 'stored' ? 'stored' : 'duplicates']++;
            array_shift($remaining);
        }
    } catch (Throwable $e) {
        error_log('interacciones: BD no disponible, enviando a spool: ' . $e->getMessage());
        if ($remaining) {
            if (interacciones_spool_append($remaining)) {
                $res['spooled'] += count($remaining);
            } else {
                $res['failed'] += count($remaining);
            }
        }
    }
    return $res;
}
