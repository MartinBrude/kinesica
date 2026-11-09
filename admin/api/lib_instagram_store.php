<?php
declare(strict_types=1);

/** Cola Instagram (MariaDB/SQLite). Caption overrides: lib_instagram_copy.php. */
require_once __DIR__ . '/lib_db.php';

const IG_MAX_ATTEMPTS = 3;
const IG_CAPTION_MAX = 2200;
const IG_TZ = 'America/Argentina/Buenos_Aires';

/** Base pública de /admin/ (trailing slash) para image_url de Meta. */
function ig_asset_base(): string
{
    return rtrim((string) (cfg()['admin_url'] ?? 'https://www.kinesica.com.ar/admin/'), '/') . '/';
}

function ig_is_sqlite(): bool
{
    return db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
}

function ig_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone(IG_TZ)))->format('Y-m-d');
}

function ig_valid_id(string $id): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id);
}

function ensure_instagram_tables(): void
{
    static $ready = false;
    if ($ready) return;
    $pdo = db();
    $cola = "creativo_id VARCHAR(80) PRIMARY KEY, title VARCHAR(200) NOT NULL, caption TEXT NOT NULL,
            feed_path VARCHAR(200) NOT NULL, story_path VARCHAR(200) NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'queued', sort_order INT NOT NULL DEFAULT 0,
            channels VARCHAR(12) NOT NULL DEFAULT 'both',
            queued_by VARCHAR(64) NOT NULL DEFAULT '', queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            published_on DATE NULL, feed_media_id VARCHAR(64) NULL, story_media_id VARCHAR(64) NULL,
            attempts SMALLINT NOT NULL DEFAULT 0, last_error TEXT NULL";
    if (ig_is_sqlite()) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS instagram_cola ($cola)");
        $pdo->exec('CREATE TABLE IF NOT EXISTS instagram_token (
            id TINYINT PRIMARY KEY, token TEXT NOT NULL, expires_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        try {
            $names = array_column($pdo->query('PRAGMA table_info(instagram_cola)')->fetchAll(PDO::FETCH_ASSOC) ?: [], 'name');
            if ($names && !in_array('channels', $names, true)) {
                $pdo->exec("ALTER TABLE instagram_cola ADD COLUMN channels VARCHAR(12) NOT NULL DEFAULT 'both'");
            }
        } catch (Throwable $e) {}
    } else {
        $pdo->exec("CREATE TABLE IF NOT EXISTS instagram_cola (
            $cola, INDEX idx_ig_cola_order (status, sort_order, queued_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        foreach (['sort_order' => 'INT NOT NULL DEFAULT 0 AFTER status', 'channels' => "VARCHAR(12) NOT NULL DEFAULT 'both' AFTER sort_order"] as $col => $ddl) {
            try {
                if (empty($pdo->query("SHOW COLUMNS FROM instagram_cola LIKE " . $pdo->quote($col))->fetchAll())) {
                    $pdo->exec("ALTER TABLE instagram_cola ADD COLUMN {$col} {$ddl}");
                }
            } catch (Throwable $e) {}
        }
        $pdo->exec('CREATE TABLE IF NOT EXISTS instagram_token (
            id TINYINT PRIMARY KEY, token TEXT NOT NULL, expires_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }
    $ready = true;
}

function ig_normalize_channel(string $channel): string
{
    $ch = strtolower(trim($channel));
    return in_array($ch, ['feed', 'story', 'both'], true) ? $ch : 'both';
}

/** Rutas internas estrictas sin dot-traversal: campanas/(feed|story)/nombre.png */
function ig_valid_asset(string $path, string $kind): bool
{
    return (bool) preg_match('#^campanas/' . $kind . '/[A-Za-z0-9_-]+\.(png|jpe?g)$#', $path);
}

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
    return ig_asset_base() . $rel;
}

function ig_queue_add(array $item, string $user): bool
{
    ensure_instagram_tables();
    $id = (string) ($item['id'] ?? '');
    $feed = (string) ($item['feed_path'] ?? '');
    $story = (string) ($item['story_path'] ?? '');
    $caption = trim((string) ($item['caption'] ?? ''));
    if (!ig_valid_id($id) || $caption === '' || mb_strlen($caption) > IG_CAPTION_MAX
        || !ig_valid_asset($feed, 'feed') || !ig_valid_asset($story, 'story')) {
        return false;
    }
    $ex = ig_queue_find($id);
    if ($ex && in_array((string) ($ex['status'] ?? ''), ['published', 'publishing'], true)) return false;
    if ($ex && (!empty($ex['feed_media_id']) || !empty($ex['story_media_id']))) return false;
    $title = mb_substr((string) ($item['title'] ?? $id), 0, 200);
    $channels = ig_normalize_channel((string) ($item['channel'] ?? $item['channels'] ?? 'both'));
    $sortOrder = (int) db()->query("SELECT COALESCE(MAX(sort_order), 0) FROM instagram_cola WHERE status = 'queued'")->fetchColumn() + 1;
    $params = ['id' => $id, 't' => $title, 'c' => $caption, 'f' => $feed, 's' => $story, 'ord' => $sortOrder, 'ch' => $channels, 'u' => $user];
    if (ig_is_sqlite()) {
        db()->prepare('INSERT INTO instagram_cola (creativo_id, title, caption, feed_path, story_path, status, sort_order, channels, queued_by)
             VALUES (:id, :t, :c, :f, :s, \'queued\', :ord, :ch, :u)
             ON CONFLICT(creativo_id) DO UPDATE SET title = excluded.title, caption = excluded.caption,
               feed_path = excluded.feed_path, story_path = excluded.story_path, status = \'queued\',
               sort_order = excluded.sort_order, channels = excluded.channels, queued_by = excluded.queued_by,
               queued_at = CURRENT_TIMESTAMP, attempts = 0, last_error = NULL,
               published_on = NULL, feed_media_id = NULL, story_media_id = NULL'
        )->execute($params);
    } else {
        $params['ord2'] = $sortOrder;
        db()->prepare('INSERT INTO instagram_cola (creativo_id, title, caption, feed_path, story_path, status, sort_order, channels, queued_by)
             VALUES (:id, :t, :c, :f, :s, \'queued\', :ord, :ch, :u)
             ON DUPLICATE KEY UPDATE title = VALUES(title), caption = VALUES(caption), feed_path = VALUES(feed_path),
               story_path = VALUES(story_path), status = \'queued\', sort_order = :ord2, channels = VALUES(channels),
               queued_by = VALUES(queued_by), queued_at = CURRENT_TIMESTAMP, attempts = 0, last_error = NULL,
               published_on = NULL, feed_media_id = NULL, story_media_id = NULL'
        )->execute($params);
    }
    return true;
}

function ig_queue_remove(string $id): void
{
    ensure_instagram_tables();
    db()->prepare('DELETE FROM instagram_cola WHERE creativo_id = :id AND status NOT IN (\'published\',\'publishing\')')
        ->execute(['id' => $id]);
}

function ig_queue_reorder(array $orderedIds): void
{
    ensure_instagram_tables();
    $pdo = db();
    $inTx = $pdo->inTransaction();
    if (!$inTx) $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE instagram_cola SET sort_order = :ord WHERE creativo_id = :id AND status = \'queued\'');
        foreach ($orderedIds as $idx => $id) {
            $stmt->execute(['ord' => $idx + 1, 'id' => (string) $id]);
        }
        if (!$inTx) $pdo->commit();
    } catch (Throwable $e) {
        if (!$inTx) $pdo->rollBack();
        throw $e;
    }
}

function ig_queue_list(): array
{
    ensure_instagram_tables();
    $rows = db()->query(
        'SELECT creativo_id, title, caption, status, sort_order, channels, queued_by, queued_at, published_on, feed_media_id, story_media_id, attempts, last_error
         FROM instagram_cola ORDER BY (status = \'queued\') DESC, (status = \'publishing\') DESC, sort_order ASC, queued_at ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    return $rows ?: [];
}

function ig_queue_next(): ?array
{
    ensure_instagram_tables();
    $stmt = db()->prepare(
        'SELECT * FROM instagram_cola WHERE status = \'queued\' AND attempts < ' . (int) IG_MAX_ATTEMPTS . ' ORDER BY sort_order ASC, queued_at ASC LIMIT 1'
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ig_published_on_date(string $date): bool
{
    ensure_instagram_tables();
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM instagram_cola WHERE published_on = :d OR status = \'publishing\''
    );
    $stmt->execute(['d' => $date]);
    return (int) $stmt->fetchColumn() > 0;
}

function ig_mark_attempt_failed(string $id, string $error): void
{
    // Desde publishing nunca vuelve a queued (evita reintentos que republican).
    db()->prepare(
        'UPDATE instagram_cola SET attempts = attempts + 1, last_error = :e,
         status = CASE
           WHEN status = \'publishing\' THEN \'failed\'
           WHEN attempts + 1 >= ' . (int) IG_MAX_ATTEMPTS . ' THEN \'failed\'
           ELSE \'queued\' END WHERE creativo_id = :id'
    )->execute(['e' => mb_substr($error, 0, 1000), 'id' => $id]);
}

function ig_mark_published(string $id, string $date, ?string $feedId, ?string $storyId, ?string $error): void
{
    db()->prepare(
        'UPDATE instagram_cola SET status = \'published\', published_on = :d, feed_media_id = :f,
         story_media_id = :s, last_error = :e WHERE creativo_id = :id'
    )->execute(['d' => $date, 'f' => $feedId, 's' => $storyId, 'e' => $error, 'id' => $id]);
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
    $sql = ig_is_sqlite()
        ? 'INSERT INTO instagram_token (id, token, expires_at) VALUES (1, :t, :e)
             ON CONFLICT(id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO instagram_token (id, token, expires_at) VALUES (1, :t, :e)
             ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), updated_at = CURRENT_TIMESTAMP';
    db()->prepare($sql)->execute(['t' => $token, 'e' => $expiresAt]);
}

function ig_queue_find(string $id): ?array
{
    ensure_instagram_tables();
    $stmt = db()->prepare('SELECT * FROM instagram_cola WHERE creativo_id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
