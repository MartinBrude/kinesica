<?php
declare(strict_types=1);

/**
 * Locks permanentes anti-duplicado Instagram (día + canal por pieza) y claim atómico.
 * Un slot adquirido no se libera: evita republicar tras timeout/crash.
 */

require_once __DIR__ . '/lib_instagram_store.php';

function ig_ensure_guard_table(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_instagram_tables();
    $sql = 'CREATE TABLE IF NOT EXISTS instagram_publish_guard (
        slot VARCHAR(120) PRIMARY KEY, creativo_id VARCHAR(80) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';
    if (!ig_is_sqlite()) $sql .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec($sql);
    foreach (['feed_container_id', 'story_container_id'] as $col) {
        ig_ensure_cola_column($col, 'VARCHAR(64) NULL');
    }
    $ready = true;
}

function ig_ensure_cola_column(string $name, string $ddl): void
{
    if (!preg_match('/^[a-z_]+$/', $name)) return;
    $pdo = db();
    try {
        if (ig_is_sqlite()) {
            $names = array_column($pdo->query('PRAGMA table_info(instagram_cola)')->fetchAll(PDO::FETCH_ASSOC) ?: [], 'name');
            if ($names && !in_array($name, $names, true)) {
                $pdo->exec("ALTER TABLE instagram_cola ADD COLUMN {$name} {$ddl}");
            }
        } else {
            $cols = $pdo->query('SHOW COLUMNS FROM instagram_cola LIKE ' . $pdo->quote($name))->fetchAll();
            if (empty($cols)) $pdo->exec("ALTER TABLE instagram_cola ADD COLUMN {$name} {$ddl}");
        }
    } catch (Throwable $e) {}
}

function ig_day_slot(string $date): string
{
    return 'day:' . $date;
}

function ig_channel_slot(string $id, string $channel): string
{
    return 'piece:' . $id . ':' . $channel;
}

/** INSERT único. false = ya existía (otro intento o publicación previa). */
function ig_guard_acquire(string $slot, string $creativoId): bool
{
    ig_ensure_guard_table();
    try {
        db()->prepare(
            'INSERT INTO instagram_publish_guard (slot, creativo_id) VALUES (:s, :c)'
        )->execute(['s' => $slot, 'c' => $creativoId]);
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function ig_guard_held(string $slot): bool
{
    ig_ensure_guard_table();
    $stmt = db()->prepare('SELECT 1 FROM instagram_publish_guard WHERE slot = :s LIMIT 1');
    $stmt->execute(['s' => $slot]);
    return (bool) $stmt->fetchColumn();
}

function ig_has_publish_progress(string $id): bool
{
    ig_ensure_guard_table();
    $row = ig_queue_find($id);
    if ($row) {
        foreach (['feed_media_id', 'story_media_id', 'feed_container_id', 'story_container_id'] as $k) {
            if (!empty($row[$k])) return true;
        }
    }
    return ig_guard_held(ig_channel_slot($id, 'feed')) || ig_guard_held(ig_channel_slot($id, 'story'));
}

function ig_save_container(string $id, ?string $feedContainer, ?string $storyContainer): void
{
    if ($feedContainer === null && $storyContainer === null) return;
    ig_ensure_guard_table();
    db()->prepare(
        'UPDATE instagram_cola SET feed_container_id = COALESCE(:f, feed_container_id),
         story_container_id = COALESCE(:s, story_container_id) WHERE creativo_id = :id'
    )->execute(['f' => $feedContainer, 's' => $storyContainer, 'id' => $id]);
}

function ig_save_partial_media(string $id, ?string $feedId, ?string $storyId): void
{
    if ($feedId === null && $storyId === null) return;
    db()->prepare(
        'UPDATE instagram_cola SET feed_media_id = COALESCE(:f, feed_media_id),
         story_media_id = COALESCE(:s, story_media_id) WHERE creativo_id = :id'
    )->execute(['f' => $feedId, 's' => $storyId, 'id' => $id]);
}

/** Edad máxima de un claim `publishing` antes de marcarlo fallido ( > timeout cliente 300s ). */
const IG_PUBLISHING_STALE_SEC = 420;

/** Timestamp UTC `Y-m-d H:i:s` (publishing_at siempre se escribe/compara en UTC). */
function ig_utc_now_sql(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
}

/**
 * Libera el cupo del día si lo tiene esta pieza.
 * @param bool $requireNoPublishThatDay true en CLI ops: no borrar si ya hubo publish ese día.
 */
function ig_guard_release_day_for(
    string $creativoId,
    ?string $date = null,
    bool $requireNoPublishThatDay = false
): bool {
    ig_ensure_guard_table();
    $date = $date ?: ig_today();
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !ig_valid_id($creativoId)) {
        return false;
    }
    if ($requireNoPublishThatDay) {
        $anyPub = db()->prepare('SELECT COUNT(*) FROM instagram_cola WHERE published_on = :d');
        $anyPub->execute(['d' => $date]);
        if ((int) $anyPub->fetchColumn() > 0) {
            return false;
        }
    } else {
        $mine = db()->prepare(
            'SELECT COUNT(*) FROM instagram_cola WHERE published_on = :d AND creativo_id = :id'
        );
        $mine->execute(['d' => $date, 'id' => $creativoId]);
        if ((int) $mine->fetchColumn() > 0) {
            return false;
        }
    }
    $stmt = db()->prepare(
        'DELETE FROM instagram_publish_guard WHERE slot = :s AND creativo_id = :c'
    );
    $stmt->execute(['s' => ig_day_slot($date), 'c' => $creativoId]);
    return $stmt->rowCount() > 0;
}

/** Reserva atómica queued→publishing (anti doble publicación). */
function ig_queue_claim(string $id): ?array
{
    ensure_instagram_tables();
    if (!ig_valid_id($id)) return null;
    $stmt = db()->prepare(
        'UPDATE instagram_cola SET status = \'publishing\', publishing_at = :at
         WHERE creativo_id = :id AND status = \'queued\''
    );
    $stmt->execute(['id' => $id, 'at' => ig_utc_now_sql()]);
    if ($stmt->rowCount() < 1) return null;
    return ig_queue_find($id);
}

/**
 * Desbloquea filas `publishing` huérfanas (timeout/OOM/kill) para que el cron no quede trabado.
 * @return int cantidad liberada
 */
function ig_release_stale_publishing(int $maxAgeSec = IG_PUBLISHING_STALE_SEC): int
{
    ensure_instagram_tables();
    $cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('-' . max(60, $maxAgeSec) . ' seconds')
        ->format('Y-m-d H:i:s');
    $stmt = db()->prepare(
        'SELECT creativo_id FROM instagram_cola WHERE status = \'publishing\'
         AND (publishing_at IS NULL OR publishing_at < :c)'
    );
    $stmt->execute(['c' => $cutoff]);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $n = 0;
    foreach ($ids as $id) {
        $id = (string) $id;
        if ($id === '') continue;
        ig_queue_release_claim($id);
        $n++;
    }
    return $n;
}

/** True si ya hay publicación del día o un claim `publishing` vivo (post-sweeper). */
function ig_published_on_date(string $date): bool
{
    ig_release_stale_publishing();
    ensure_instagram_tables();
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM instagram_cola WHERE published_on = :d OR status = \'publishing\''
    );
    $stmt->execute(['d' => $date]);
    return (int) $stmt->fetchColumn() > 0;
}

/**
 * Solo reencola si no hubo progreso. Con media → published; con guard/container sin media → failed.
 */
function ig_queue_release_claim(string $id): void
{
    if (ig_has_publish_progress($id)) {
        $row = ig_queue_find($id);
        if (!$row) return;
        if (!empty($row['feed_media_id']) || !empty($row['story_media_id'])) {
            ig_mark_published(
                $id,
                ig_today(),
                !empty($row['feed_media_id']) ? (string) $row['feed_media_id'] : null,
                !empty($row['story_media_id']) ? (string) $row['story_media_id'] : null,
                $row['last_error'] ?? 'Publicación parcial; no se reencola'
            );
            return;
        }
        if (($row['status'] ?? '') === 'publishing') {
            ig_mark_attempt_failed($id, 'Publicación interrumpida; canal ya reservado');
        }
        return;
    }
    db()->prepare(
        'UPDATE instagram_cola SET status = \'queued\' WHERE creativo_id = :id AND status = \'publishing\''
    )->execute(['id' => $id]);
    // Sin progreso Meta: no quemar el cupo del día (day guard de esta pieza).
    ig_guard_release_day_for($id);
}
