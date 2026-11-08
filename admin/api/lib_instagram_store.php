<?php
declare(strict_types=1);

/**
 * Kinésica — Cola de publicación automática en Instagram (persistencia).
 * Tablas: instagram_cola (piezas "subibles" con orden custom) e instagram_token (token renovable).
 * Estados: queued → published | failed.
 */

require_once __DIR__ . '/lib_db.php';

const IG_ASSET_BASE = 'https://www.kinesica.com.ar/admin/';
const IG_MAX_ATTEMPTS = 3;

function ensure_instagram_tables(): void
{
    static $ready = false;
    if ($ready) return;
    $pdo = db();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS instagram_cola (
            creativo_id VARCHAR(80) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            caption TEXT NOT NULL,
            feed_path VARCHAR(200) NOT NULL,
            story_path VARCHAR(200) NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT \'queued\',
            sort_order INT NOT NULL DEFAULT 0,
            queued_by VARCHAR(64) NOT NULL DEFAULT \'\',
            queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            published_on DATE NULL,
            feed_media_id VARCHAR(64) NULL,
            story_media_id VARCHAR(64) NULL,
            attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            last_error TEXT NULL,
            INDEX idx_ig_cola_order (status, sort_order, queued_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    try {
        $cols = $pdo->query('SHOW COLUMNS FROM instagram_cola LIKE \'sort_order\'')->fetchAll();
        if (empty($cols)) {
            $pdo->exec('ALTER TABLE instagram_cola ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status');
        }
    } catch (Throwable $e) {}
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS instagram_token (
            id TINYINT PRIMARY KEY,
            token TEXT NOT NULL,
            expires_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}

/** Solo rutas internas de campaña: campanas/(feed|story)/nombre.png */
function ig_valid_asset(string $path, string $kind): bool
{
    return (bool) preg_match('#^campanas/' . $kind . '/[A-Za-z0-9_.-]+\.(png|jpe?g)$#', $path);
}

/**
 * Instagram solo acepta JPEG: convierte el PNG de campaña (GD) a campanas/ig/<kind>/<nombre>.jpg,
 * una sola vez (cache en disco), y devuelve la URL pública del JPG.
 */
function ig_asset_url(string $path): string
{
    $src = dirname(__DIR__) . '/' . $path;
    $rel = 'campanas/ig/' . preg_replace('#^campanas/#', '', preg_replace('#\.\w+$#', '.jpg', $path));
    $dst = dirname(__DIR__) . '/' . $rel;
    if (!is_file($dst)) {
        if (!is_file($src)) throw new RuntimeException('No existe la imagen ' . $path);
        $img = @imagecreatefromstring((string) file_get_contents($src));
        if ($img === false) throw new RuntimeException('Imagen ilegible ' . $path);
        $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
        if (!is_dir(dirname($dst)) && !mkdir(dirname($dst), 0755, true)) {
            throw new RuntimeException('No se pudo crear ' . dirname($rel));
        }
        if (!imagejpeg($flat, $dst, 92)) throw new RuntimeException('No se pudo escribir ' . $rel);
    }
    return IG_ASSET_BASE . $rel;
}

function ig_queue_add(array $item, string $user): bool
{
    ensure_instagram_tables();
    $id = (string) ($item['id'] ?? '');
    $feed = (string) ($item['feed_path'] ?? '');
    $story = (string) ($item['story_path'] ?? '');
    $caption = trim((string) ($item['caption'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id) || $caption === ''
        || !ig_valid_asset($feed, 'feed') || !ig_valid_asset($story, 'story')) {
        return false;
    }
    $title = mb_substr((string) ($item['title'] ?? $id), 0, 200);
    $maxOrder = (int) db()->query("SELECT COALESCE(MAX(sort_order), 0) FROM instagram_cola WHERE status = 'queued'")->fetchColumn();
    $sortOrder = $maxOrder + 1;

    db()->prepare(
        'INSERT INTO instagram_cola (creativo_id, title, caption, feed_path, story_path, status, sort_order, queued_by)
         VALUES (:id, :t, :c, :f, :s, \'queued\', :ord, :u)
         ON DUPLICATE KEY UPDATE title = VALUES(title), caption = VALUES(caption), feed_path = VALUES(feed_path),
           story_path = VALUES(story_path), status = \'queued\', sort_order = :ord2, queued_by = VALUES(queued_by),
           queued_at = CURRENT_TIMESTAMP, attempts = 0, last_error = NULL'
    )->execute(['id' => $id, 't' => $title, 'c' => $caption, 'f' => $feed, 's' => $story, 'ord' => $sortOrder, 'ord2' => $sortOrder, 'u' => $user]);
    return true;
}

function ig_queue_remove(string $id): void
{
    ensure_instagram_tables();
    db()->prepare('DELETE FROM instagram_cola WHERE creativo_id = :id AND status <> \'published\'')
        ->execute(['id' => $id]);
}

function ig_queue_reorder(array $orderedIds): void
{
    ensure_instagram_tables();
    $stmt = db()->prepare('UPDATE instagram_cola SET sort_order = :ord WHERE creativo_id = :id AND status = \'queued\'');
    foreach ($orderedIds as $idx => $id) {
        $stmt->execute(['ord' => $idx + 1, 'id' => (string) $id]);
    }
}

function ig_queue_list(): array
{
    ensure_instagram_tables();
    $rows = db()->query(
        'SELECT creativo_id, title, status, sort_order, queued_by, queued_at, published_on, feed_media_id, story_media_id, attempts, last_error
         FROM instagram_cola ORDER BY (status = \'queued\') DESC, sort_order ASC, queued_at ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    return $rows ?: [];
}

function ig_queue_next(): ?array
{
    ensure_instagram_tables();
    $stmt = db()->prepare(
        'SELECT * FROM instagram_cola WHERE status = \'queued\' AND attempts < :max ORDER BY sort_order ASC, queued_at ASC LIMIT 1'
    );
    $stmt->execute(['max' => IG_MAX_ATTEMPTS]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ig_published_on_date(string $date): bool
{
    ensure_instagram_tables();
    $stmt = db()->prepare('SELECT COUNT(*) FROM instagram_cola WHERE published_on = :d');
    $stmt->execute(['d' => $date]);
    return (int) $stmt->fetchColumn() > 0;
}

function ig_mark_attempt_failed(string $id, string $error): void
{
    db()->prepare(
        'UPDATE instagram_cola SET attempts = attempts + 1, last_error = :e,
         status = CASE WHEN attempts + 1 >= :max THEN \'failed\' ELSE status END WHERE creativo_id = :id'
    )->execute(['e' => mb_substr($error, 0, 1000), 'max' => IG_MAX_ATTEMPTS, 'id' => $id]);
}

function ig_mark_published(string $id, string $date, string $feedId, ?string $storyId, ?string $storyError): void
{
    db()->prepare(
        'UPDATE instagram_cola SET status = \'published\', published_on = :d, feed_media_id = :f,
         story_media_id = :s, last_error = :e WHERE creativo_id = :id'
    )->execute(['d' => $date, 'f' => $feedId, 's' => $storyId, 'e' => $storyError, 'id' => $id]);
}

function ig_token_get(): array
{
    ensure_instagram_tables();
    $row = db()->query('SELECT token, expires_at FROM instagram_token WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
    if ($row && $row['token'] !== '') return $row;
    $seed = (string) (cfg()['instagram_token'] ?? '');
    if ($seed === '') return ['token' => '', 'expires_at' => null];
    ig_token_save($seed, null);
    return ['token' => $seed, 'expires_at' => null];
}

function ig_token_save(string $token, ?string $expiresAt): void
{
    db()->prepare(
        'INSERT INTO instagram_token (id, token, expires_at) VALUES (1, :t, :e)
         ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), updated_at = CURRENT_TIMESTAMP'
    )->execute(['t' => $token, 'e' => $expiresAt]);
}

function ig_queue_find(string $id): ?array
{
    ensure_instagram_tables();
    $stmt = db()->prepare('SELECT * FROM instagram_cola WHERE creativo_id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}
