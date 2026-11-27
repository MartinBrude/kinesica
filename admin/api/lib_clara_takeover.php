<?php
declare(strict_types=1);

/**
 * Pausa puntual de Clara por contacto (human takeover).
 * Fuente de verdad compartida entre /admin API y kinesica-bot.
 */

const CLARA_TAKEOVER_TTL_SECONDS = 30 * 60;

/**
 * Canoniza al mismo formato que Meta/directorio (p. ej. 54911… / 41…).
 * Usa clean_phone_number cuando está disponible.
 */
function clara_takeover_normalize_wa_id(string $raw): string
{
    if (!function_exists('clean_phone_number')) {
        $helpers = __DIR__ . '/pacientes_helpers_search_key.php';
        if (is_file($helpers)) {
            require_once $helpers;
        }
    }
    if (function_exists('clean_phone_number')) {
        $clean = clean_phone_number($raw);
        if ($clean !== '') {
            return $clean;
        }
    }
    return preg_replace('/\D+/', '', $raw) ?? '';
}

function clara_takeover_match_key(string $waId): string
{
    $wa = clara_takeover_normalize_wa_id($waId);
    return strlen($wa) >= 8 ? substr($wa, -8) : $wa;
}

function clara_takeover_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = $pdo ?? (function_exists('db') ? db() : null);
    if (!$pdo instanceof PDO) {
        throw new RuntimeException('PDO requerido para clara_takeover');
    }
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_table_exists($pdo, 'clara_takeover')) {
        $mig = require __DIR__ . '/migrations/021_clara_takeover.php';
        if (is_array($mig) && isset($mig['up']) && is_callable($mig['up'])) {
            ($mig['up'])($pdo);
        }
    }
    $done[$pdo] = true;
}

function clara_takeover_purge_expired(?PDO $pdo = null): int
{
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    $now = gmdate('Y-m-d H:i:s');
    $stmt = $pdo->prepare('DELETE FROM clara_takeover WHERE paused_until <= :now');
    $stmt->execute(['now' => $now]);
    return (int) $stmt->rowCount();
}

/**
 * @return array{wa_id:string,paused_at:string,paused_until:string,paused_by:string,updated_at:string}|null
 */
function clara_takeover_get(string $waId, ?PDO $pdo = null): ?array
{
    $wa = clara_takeover_normalize_wa_id($waId);
    if (strlen($wa) < 6) {
        return null;
    }
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    clara_takeover_purge_expired($pdo);
    $stmt = $pdo->prepare(
        'SELECT wa_id, paused_at, paused_until, paused_by, updated_at
         FROM clara_takeover WHERE wa_id = :wa LIMIT 1'
    );
    $stmt->execute(['wa' => $wa]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (is_array($row)) {
        return $row;
    }
    // Compat: filas viejas sin prefijo 549… (mismo last-8).
    $k8 = clara_takeover_match_key($wa);
    if ($k8 === '' || strlen($k8) < 8) {
        return null;
    }
    require_once __DIR__ . '/lib_migrations.php';
    $tailExpr = kinesica_migrations_is_sqlite($pdo) ? 'substr(wa_id, -8)' : 'RIGHT(wa_id, 8)';
    $stmt2 = $pdo->prepare(
        "SELECT wa_id, paused_at, paused_until, paused_by, updated_at
         FROM clara_takeover
         WHERE wa_id = :k8 OR {$tailExpr} = :k8b
         LIMIT 1"
    );
    $stmt2->execute(['k8' => $k8, 'k8b' => $k8]);
    $row2 = $stmt2->fetch(PDO::FETCH_ASSOC);
    return is_array($row2) ? $row2 : null;
}

function clara_takeover_is_active(string $waId, ?PDO $pdo = null): bool
{
    return clara_takeover_get($waId, $pdo) !== null;
}

/**
 * @return list<array{wa_id:string,paused_at:string,paused_until:string,paused_by:string,updated_at:string}>
 */
function clara_takeover_list_active(?PDO $pdo = null): array
{
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    clara_takeover_purge_expired($pdo);
    $stmt = $pdo->query(
        'SELECT wa_id, paused_at, paused_until, paused_by, updated_at
         FROM clara_takeover
         ORDER BY paused_until ASC'
    );
    if (!$stmt) {
        return [];
    }
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return is_array($rows) ? $rows : [];
}

/**
 * @return array{wa_id:string,paused_at:string,paused_until:string,paused_by:string,ttl_seconds:int}
 */
function clara_takeover_start(string $waId, string $by = '', ?int $ttlSeconds = null, ?PDO $pdo = null): array
{
    $wa = clara_takeover_normalize_wa_id($waId);
    if (strlen($wa) < 6) {
        throw new InvalidArgumentException('wa_id inválido');
    }
    $ttl = $ttlSeconds !== null && $ttlSeconds > 0 ? $ttlSeconds : CLARA_TAKEOVER_TTL_SECONDS;
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    require_once __DIR__ . '/lib_migrations.php';
    $now = time();
    $pausedAt = gmdate('Y-m-d H:i:s', $now);
    $pausedUntil = gmdate('Y-m-d H:i:s', $now + $ttl);
    $byClean = mb_substr(trim($by), 0, 60, 'UTF-8');
    if (kinesica_migrations_is_sqlite($pdo)) {
        $sql = 'INSERT INTO clara_takeover (wa_id, paused_at, paused_until, paused_by, updated_at)
                VALUES (:wa, :at, :until, :by, :upd)
                ON CONFLICT(wa_id) DO UPDATE SET
                    paused_at = excluded.paused_at,
                    paused_until = excluded.paused_until,
                    paused_by = excluded.paused_by,
                    updated_at = excluded.updated_at';
    } else {
        $sql = 'INSERT INTO clara_takeover (wa_id, paused_at, paused_until, paused_by, updated_at)
                VALUES (:wa, :at, :until, :by, :upd)
                ON DUPLICATE KEY UPDATE
                    paused_at = VALUES(paused_at),
                    paused_until = VALUES(paused_until),
                    paused_by = VALUES(paused_by),
                    updated_at = VALUES(updated_at)';
    }
    $pdo->prepare($sql)->execute([
        'wa' => $wa,
        'at' => $pausedAt,
        'until' => $pausedUntil,
        'by' => $byClean,
        'upd' => $pausedAt,
    ]);
    // Eliminar aliases del mismo contacto (p. ej. 1155566666 vs 5491155566666).
    $k8 = clara_takeover_match_key($wa);
    if (strlen($k8) >= 8) {
        $tailExpr = kinesica_migrations_is_sqlite($pdo) ? 'substr(wa_id, -8)' : 'RIGHT(wa_id, 8)';
        $pdo->prepare(
            "DELETE FROM clara_takeover
             WHERE wa_id <> :wa AND (wa_id = :k8 OR {$tailExpr} = :k8b)"
        )->execute(['wa' => $wa, 'k8' => $k8, 'k8b' => $k8]);
    }
    return [
        'wa_id' => $wa,
        'paused_at' => $pausedAt,
        'paused_until' => $pausedUntil,
        'paused_by' => $byClean,
        'ttl_seconds' => $ttl,
    ];
}

function clara_takeover_end(string $waId, ?PDO $pdo = null): bool
{
    $wa = clara_takeover_normalize_wa_id($waId);
    if (strlen($wa) < 6) {
        return false;
    }
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    require_once __DIR__ . '/lib_migrations.php';
    $k8 = clara_takeover_match_key($wa);
    $tailExpr = kinesica_migrations_is_sqlite($pdo) ? 'substr(wa_id, -8)' : 'RIGHT(wa_id, 8)';
    $stmt = $pdo->prepare(
        "DELETE FROM clara_takeover
         WHERE wa_id = :wa OR wa_id = :k8 OR {$tailExpr} = :k8b"
    );
    $stmt->execute([
        'wa' => $wa,
        'k8' => $k8 !== '' ? $k8 : $wa,
        'k8b' => $k8 !== '' ? $k8 : $wa,
    ]);
    return $stmt->rowCount() > 0;
}

/** Limpia todas las pausas puntuales (p. ej. "reanudar bot"). */
function clara_takeover_end_all(?PDO $pdo = null): int
{
    $pdo = $pdo ?? db();
    clara_takeover_ensure_schema($pdo);
    $n = (int) $pdo->exec('DELETE FROM clara_takeover');
    return max(0, $n);
}

require_once __DIR__ . '/lib_clara_takeover_reply.php';
