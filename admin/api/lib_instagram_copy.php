<?php
declare(strict_types=1);

/**
 * Overrides de caption del catálogo Creativos (persistidos para todos los admins).
 * También sincroniza caption de piezas en cola (status=queued).
 */

require_once __DIR__ . '/lib_instagram_store.php';

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
