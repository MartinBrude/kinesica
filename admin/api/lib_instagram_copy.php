<?php
declare(strict_types=1);

/**
 * Overrides de caption + settings del servicio + canales de cola.
 * Claim/guards: lib_instagram_guard.php.
 */

require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_instagram_guard.php';

function ig_ensure_copy_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_creativo_copy (
        creativo_id VARCHAR(80) PRIMARY KEY, caption TEXT NOT NULL,
        updated_by VARCHAR(64) NOT NULL DEFAULT \'\',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec($sql);
    $ready = true;
}

/** @return array<string, string> creativo_id => caption */
function ig_copy_map(): array
{
    ig_ensure_copy_table();
    $rows = db()->query('SELECT creativo_id, caption FROM instagram_creativo_copy')->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows ?: [] as $r) {
        $map[(string) $r['creativo_id']] = (string) $r['caption'];
    }
    return $map;
}

function ig_queue_set_channels(string $id, string $channel): bool
{
    ensure_instagram_tables();
    if (!ig_valid_id($id)) return false;
    $stmt = db()->prepare(
        'UPDATE instagram_cola SET channels = :c WHERE creativo_id = :id AND status = \'queued\''
    );
    $stmt->execute(['c' => ig_normalize_channel($channel), 'id' => $id]);
    return $stmt->rowCount() > 0;
}

function ig_ensure_settings_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $pdo = db();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_settings (
        id TINYINT PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 1,
        publish_days VARCHAR(32) NULL, publish_hour TINYINT NULL,
        updated_by VARCHAR(64) NOT NULL DEFAULT \'\',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec($sql);
    try {
        if (ig_is_sqlite()) {
            $names = array_column($pdo->query('PRAGMA table_info(instagram_settings)')->fetchAll(PDO::FETCH_ASSOC) ?: [], 'name');
            foreach (['publish_days' => 'VARCHAR(32) NULL', 'publish_hour' => 'TINYINT NULL'] as $col => $ddl) {
                if ($names && !in_array($col, $names, true)) {
                    $pdo->exec("ALTER TABLE instagram_settings ADD COLUMN {$col} {$ddl}");
                }
            }
        } else {
            foreach (['publish_days' => 'VARCHAR(32) NULL', 'publish_hour' => 'TINYINT NULL'] as $col => $ddl) {
                if (empty($pdo->query('SHOW COLUMNS FROM instagram_settings LIKE ' . $pdo->quote($col))->fetchAll())) {
                    $pdo->exec("ALTER TABLE instagram_settings ADD COLUMN {$col} {$ddl}");
                }
            }
        }
    } catch (Throwable $e) {
    }
    $ready = true;
}

/** @return list<int> ISO-8601 1=lun … 7=dom */
function ig_default_publish_days(): array
{
    $raw = array_map('intval', (array) (cfg()['instagram_days'] ?? [1, 3, 5]));
    return ig_normalize_publish_days($raw);
}

function ig_default_publish_hour(): int
{
    return max(0, min(23, (int) (cfg()['instagram_hour'] ?? 10)));
}

/** @param list<int|string> $days @return list<int> */
function ig_normalize_publish_days(array $days): array
{
    $out = [];
    foreach ($days as $d) {
        $n = (int) $d;
        if ($n >= 1 && $n <= 7) $out[$n] = $n;
    }
    $out = array_values($out);
    sort($out);
    return $out !== [] ? $out : [1, 3, 5];
}

/** @return array{days:list<int>,hour:int} */
function ig_schedule_get(): array
{
    ig_ensure_settings_table();
    $row = db()->query('SELECT publish_days, publish_hour FROM instagram_settings WHERE id = 1')
        ->fetch(PDO::FETCH_ASSOC);
    $days = ig_default_publish_days();
    $hour = ig_default_publish_hour();
    if ($row) {
        if (isset($row['publish_days']) && is_string($row['publish_days']) && $row['publish_days'] !== '') {
            $parsed = array_map('intval', preg_split('/\s*,\s*/', $row['publish_days']) ?: []);
            $days = ig_normalize_publish_days($parsed);
        }
        if ($row['publish_hour'] !== null && $row['publish_hour'] !== '') {
            $hour = max(0, min(23, (int) $row['publish_hour']));
        }
    }
    return ['days' => $days, 'hour' => $hour];
}

/** @param list<int|string> $days */
function ig_schedule_set(array $days, int $hour, string $user): array
{
    ig_ensure_settings_table();
    $norm = ig_normalize_publish_days($days);
    $hour = max(0, min(23, $hour));
    $u = mb_substr($user, 0, 64);
    $csv = implode(',', $norm);
    $enabled = ig_service_enabled() ? 1 : 0;
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_settings (id, enabled, publish_days, publish_hour, updated_by) VALUES (1, :en, :d, :h, :u)
             ON CONFLICT(id) DO UPDATE SET publish_days = excluded.publish_days, publish_hour = excluded.publish_hour,
               updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_settings (id, enabled, publish_days, publish_hour, updated_by) VALUES (1, :en, :d, :h, :u)
             ON DUPLICATE KEY UPDATE publish_days = VALUES(publish_days), publish_hour = VALUES(publish_hour),
               updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute(['en' => $enabled, 'd' => $csv, 'h' => $hour, 'u' => $u]);
    return ['days' => $norm, 'hour' => $hour];
}

/** Default activo si aún no hay fila. */
function ig_service_enabled(): bool
{
    ig_ensure_settings_table();
    $row = db()->query('SELECT enabled FROM instagram_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
    if (!$row) return true;
    return (int) $row['enabled'] === 1;
}

function ig_service_set_enabled(bool $enabled, string $user): void
{
    ig_ensure_settings_table();
    $u = mb_substr($user, 0, 64);
    $on = $enabled ? 1 : 0;
    $sched = ig_schedule_get();
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_settings (id, enabled, publish_days, publish_hour, updated_by) VALUES (1, :e, :d, :h, :u)
             ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_settings (id, enabled, publish_days, publish_hour, updated_by) VALUES (1, :e, :d, :h, :u)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by = VALUES(updated_by),
               updated_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute([
        'e' => $on,
        'd' => implode(',', $sched['days']),
        'h' => $sched['hour'],
        'u' => $u,
    ]);
}

function ig_caption_save(string $id, string $caption, string $user): bool
{
    ig_ensure_copy_table();
    $caption = trim($caption);
    if (!ig_valid_id($id) || $caption === '' || mb_strlen($caption) > IG_CAPTION_MAX) return false;
    $u = mb_substr($user, 0, 64);
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_creativo_copy (creativo_id, caption, updated_by) VALUES (:id, :c, :u)
             ON CONFLICT(creativo_id) DO UPDATE SET caption = excluded.caption, updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_creativo_copy (creativo_id, caption, updated_by) VALUES (:id, :c, :u)
             ON DUPLICATE KEY UPDATE caption = VALUES(caption), updated_by = VALUES(updated_by),
               updated_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute(['id' => $id, 'c' => $caption, 'u' => $u]);
    db()->prepare(
        'UPDATE instagram_cola SET caption = :c WHERE creativo_id = :id AND status = \'queued\''
    )->execute(['c' => $caption, 'id' => $id]);
    return true;
}
