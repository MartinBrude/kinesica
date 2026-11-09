<?php
declare(strict_types=1);

/**
 * Overrides de caption del catálogo Creativos (persistidos para todos los admins).
 * También sincroniza caption de piezas en cola (status=queued).
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
    if (!ig_is_sqlite()) {
        $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    }
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
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) return false;
    db()->prepare(
        'UPDATE instagram_cola SET channels = :c WHERE creativo_id = :id AND status = \'queued\''
    )->execute(['c' => ig_normalize_channel($channel), 'id' => $id]);
    return true;
}

function ig_ensure_settings_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_settings (
        id TINYINT PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 1,
        updated_by VARCHAR(64) NOT NULL DEFAULT \'\',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) {
        $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    }
    db()->exec($sql);
    $ready = true;
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
    if (ig_is_sqlite()) {
        db()->prepare(
            'INSERT INTO instagram_settings (id, enabled, updated_by) VALUES (1, :e, :u)
             ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP'
        )->execute(['e' => $on, 'u' => $u]);
    } else {
        db()->prepare(
            'INSERT INTO instagram_settings (id, enabled, updated_by) VALUES (1, :e, :u)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by = VALUES(updated_by),
               updated_at = CURRENT_TIMESTAMP'
        )->execute(['e' => $on, 'u' => $u]);
    }
}

/** Reserva atómica queued→publishing (anti doble publicación). */
function ig_queue_claim(string $id): ?array
{
    ensure_instagram_tables();
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) return null;
    $stmt = db()->prepare(
        'UPDATE instagram_cola SET status = \'publishing\' WHERE creativo_id = :id AND status = \'queued\''
    );
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) return null;
    return ig_queue_find($id);
}

/** Solo reencola si no hubo ningún progreso de publicación (media/container/guard). */
function ig_queue_release_claim(string $id): void
{
    if (ig_has_publish_progress($id)) {
        $row = ig_queue_find($id);
        if ($row && (!empty($row['feed_media_id']) || !empty($row['story_media_id']))) {
            $today = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
            ig_mark_published(
                $id,
                $today,
                !empty($row['feed_media_id']) ? (string) $row['feed_media_id'] : null,
                !empty($row['story_media_id']) ? (string) $row['story_media_id'] : null,
                $row['last_error'] ?? 'Publicación parcial; no se reencola'
            );
        }
        return;
    }
    db()->prepare(
        'UPDATE instagram_cola SET status = \'queued\' WHERE creativo_id = :id AND status = \'publishing\''
    )->execute(['id' => $id]);
}

function ig_save_partial_media(string $id, ?string $feedId, ?string $storyId): void
{
    if ($feedId === null && $storyId === null) return;
    db()->prepare(
        'UPDATE instagram_cola SET feed_media_id = COALESCE(:f, feed_media_id),
         story_media_id = COALESCE(:s, story_media_id) WHERE creativo_id = :id'
    )->execute(['f' => $feedId, 's' => $storyId, 'id' => $id]);
}

function ig_caption_save(string $id, string $caption, string $user): bool
{
    ig_ensure_copy_table();
    $caption = trim($caption);
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id) || $caption === '') return false;
    $u = mb_substr($user, 0, 64);
    if (ig_is_sqlite()) {
        db()->prepare(
            'INSERT INTO instagram_creativo_copy (creativo_id, caption, updated_by) VALUES (:id, :c, :u)
             ON CONFLICT(creativo_id) DO UPDATE SET caption = excluded.caption, updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP'
        )->execute(['id' => $id, 'c' => $caption, 'u' => $u]);
    } else {
        db()->prepare(
            'INSERT INTO instagram_creativo_copy (creativo_id, caption, updated_by) VALUES (:id, :c, :u)
             ON DUPLICATE KEY UPDATE caption = VALUES(caption), updated_by = VALUES(updated_by),
               updated_at = CURRENT_TIMESTAMP'
        )->execute(['id' => $id, 'c' => $caption, 'u' => $u]);
    }
    db()->prepare(
        'UPDATE instagram_cola SET caption = :c WHERE creativo_id = :id AND status = \'queued\''
    )->execute(['c' => $caption, 'id' => $id]);
    return true;
}
