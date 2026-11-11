<?php
declare(strict_types=1);

/**
 * Soft-delete de creativos en el catálogo admin (no borra PNG del repo).
 */

require_once __DIR__ . '/lib_instagram_store.php';

function ig_ensure_hidden_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_creativo_hidden (
        creativo_id VARCHAR(80) PRIMARY KEY,
        hidden_by VARCHAR(64) NOT NULL DEFAULT \'\',
        hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec($sql);
    $ready = true;
}

/** @return list<string> */
function ig_hidden_ids(): array
{
    ig_ensure_hidden_table();
    $rows = db()->query('SELECT creativo_id FROM instagram_creativo_hidden')->fetchAll(PDO::FETCH_COLUMN);
    return array_map('strval', $rows ?: []);
}

function ig_creativo_is_hidden(string $id): bool
{
    if (!ig_valid_id($id)) return false;
    ig_ensure_hidden_table();
    $stmt = db()->prepare('SELECT 1 FROM instagram_creativo_hidden WHERE creativo_id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Oculta del catálogo. Si está en cola queued, la saca. Publishing → rechazo.
 * @return array{ok:bool,http?:int,error?:string}
 */
function ig_creativo_hide(string $id, string $user): array
{
    if (!ig_valid_id($id)) {
        return ['ok' => false, 'http' => 422, 'error' => 'id inválido'];
    }
    $row = ig_queue_find($id);
    $status = (string) ($row['status'] ?? '');
    if ($status === 'publishing') {
        return ['ok' => false, 'http' => 409, 'error' => 'Hay una publicación en curso; no se puede eliminar ahora'];
    }
    if ($status === 'queued') {
        ig_queue_remove($id);
    }
    ig_ensure_hidden_table();
    $u = mb_substr($user, 0, 64);
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_creativo_hidden (creativo_id, hidden_by) VALUES (:id, :u)
             ON CONFLICT(creativo_id) DO UPDATE SET hidden_by = excluded.hidden_by,
               hidden_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_creativo_hidden (creativo_id, hidden_by) VALUES (:id, :u)
             ON DUPLICATE KEY UPDATE hidden_by = VALUES(hidden_by), hidden_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute(['id' => $id, 'u' => $u]);
    return ['ok' => true];
}

function ig_creativo_unhide(string $id): bool
{
    if (!ig_valid_id($id)) return false;
    ig_ensure_hidden_table();
    $stmt = db()->prepare('DELETE FROM instagram_creativo_hidden WHERE creativo_id = :id');
    $stmt->execute(['id' => $id]);
    return $stmt->rowCount() > 0;
}
