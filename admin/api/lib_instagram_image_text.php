<?php
declare(strict_types=1);

/**
 * Overrides de textos on-image (cat/title/body) + regeneración.
 * Caption: lib_instagram_copy.php. Render: lib_instagram_render.php.
 */

require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_instagram_render.php';

const IG_IMG_CAT_MAX = 32;
const IG_IMG_TITLE_MAX = 72;
const IG_IMG_BODY_MAX = 180;

function ig_ensure_image_text_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_creativo_image_text (
        creativo_id VARCHAR(80) PRIMARY KEY,
        cat VARCHAR(64) NOT NULL,
        title VARCHAR(160) NOT NULL,
        body VARCHAR(400) NOT NULL,
        updated_by VARCHAR(64) NOT NULL DEFAULT \'\',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec($sql);
    $ready = true;
}

/** @return array<string, array{cat:string,title:string,body:string}> */
function ig_image_text_map(): array
{
    ig_ensure_image_text_table();
    $rows = db()->query('SELECT creativo_id, cat, title, body FROM instagram_creativo_image_text')
        ->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows ?: [] as $r) {
        $map[(string) $r['creativo_id']] = [
            'cat' => (string) $r['cat'],
            'title' => (string) $r['title'],
            'body' => (string) $r['body'],
        ];
    }
    return $map;
}

function ig_image_text_normalize(string $cat, string $title, string $body): ?array
{
    $cat = trim($cat);
    $title = trim($title);
    $body = trim($body);
    if ($cat === '' || $title === '' || $body === '') return null;
    if (mb_strlen($cat) > IG_IMG_CAT_MAX || mb_strlen($title) > IG_IMG_TITLE_MAX
        || mb_strlen($body) > IG_IMG_BODY_MAX) {
        return null;
    }
    return ['cat' => $cat, 'title' => $title, 'body' => $body];
}

/**
 * Persiste override, regenera PNG, bust cache, actualiza title en cola queued.
 * @return array{ok:bool,error?:string,http?:int,render?:array,warnings?:list<string>}
 */
function ig_image_text_save(string $id, string $cat, string $title, string $body, string $user): array
{
    ig_ensure_image_text_table();
    if (!ig_valid_id($id)) {
        return ['ok' => false, 'error' => 'id inválido', 'http' => 422];
    }
    $norm = ig_image_text_normalize($cat, $title, $body);
    if (!$norm) {
        return [
            'ok' => false,
            'http' => 422,
            'error' => 'Textos inválidos (cat≤' . IG_IMG_CAT_MAX . ', title≤' . IG_IMG_TITLE_MAX
                . ', body≤' . IG_IMG_BODY_MAX . ', no vacíos)',
        ];
    }
    $row = ig_queue_find($id);
    if ($row && ($row['status'] ?? '') === 'publishing') {
        return ['ok' => false, 'http' => 409, 'error' => 'Hay una publicación en curso; no se puede regenerar'];
    }
    $u = mb_substr($user, 0, 64);
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_creativo_image_text (creativo_id, cat, title, body, updated_by)
             VALUES (:id, :cat, :t, :b, :u)
             ON CONFLICT(creativo_id) DO UPDATE SET cat = excluded.cat, title = excluded.title,
               body = excluded.body, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_creativo_image_text (creativo_id, cat, title, body, updated_by)
             VALUES (:id, :cat, :t, :b, :u)
             ON DUPLICATE KEY UPDATE cat = VALUES(cat), title = VALUES(title), body = VALUES(body),
               updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute([
        'id' => $id, 'cat' => $norm['cat'], 't' => $norm['title'], 'b' => $norm['body'], 'u' => $u,
    ]);
    db()->prepare(
        'UPDATE instagram_cola SET title = :t WHERE creativo_id = :id AND status = \'queued\''
    )->execute(['t' => mb_substr($norm['title'], 0, 200), 'id' => $id]);

    try {
        $render = ig_render_piece($id, $norm['cat'], $norm['title'], $norm['body']);
    } catch (Throwable $e) {
        return ['ok' => false, 'http' => 500, 'error' => $e->getMessage() ?: 'Error al regenerar imagen'];
    }
    return [
        'ok' => true,
        'render' => $render,
        'warnings' => $render['warnings'] ?? [],
    ];
}
