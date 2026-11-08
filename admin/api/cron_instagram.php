<?php
declare(strict_types=1);

/**
 * Kinésica — Cron: publica la próxima pieza de la cola en Instagram (feed + story).
 * Días y hora en horario Argentina (America/Argentina/Buenos_Aires), sin importar la zona del servidor.
 *
 * Hostinger Cron (cada hora; el script decide si corresponde publicar):
 *   0 * * * *  /usr/bin/php /home/u.../public_html/admin/api/cron_instagram.php
 *
 * Config (config.php): instagram_user_id, instagram_token (semilla inicial),
 *   instagram_days (default [1,3,5] = lun/mié/vie), instagram_hour (default 10),
 *   instagram_story_too (default true).
 * Flags CLI: --dry-run (no publica), --force (ignora día/hora/límite diario).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_instagram.php';

$dry = in_array('--dry-run', $argv, true);
$force = in_array('--force', $argv, true);
$c = cfg();
$userId = (string) ($c['instagram_user_id'] ?? '');
$days = array_map('intval', (array) ($c['instagram_days'] ?? [1, 3, 5]));
$hour = (int) ($c['instagram_hour'] ?? 10);
$withStory = ($c['instagram_story_too'] ?? true) !== false;

$now = new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires'));
$today = $now->format('Y-m-d');

if (!$force) {
    if (!in_array((int) $now->format('N'), $days, true) || (int) $now->format('G') < $hour) {
        exit(0);
    }
    if (ig_published_on_date($today)) {
        exit(0);
    }
}

$item = ig_queue_next();
if ($item === null) {
    echo "Cola vacía: nada que publicar\n";
    exit(0);
}
if ($userId === '') {
    fwrite(STDERR, "Falta instagram_user_id en config.php\n");
    exit(2);
}

ig_token_refresh_if_needed();
$token = ig_token_get()['token'];
if ($token === '') {
    fwrite(STDERR, "Falta el token de Instagram (instagram_token en config.php)\n");
    exit(2);
}

echo "Publicando {$item['creativo_id']}" . ($dry ? " (dry-run)\n" : "\n");
if ($dry) exit(0);

try {
    $feedId = ig_publish_image($userId, $token, ig_asset_url($item['feed_path']), $item['caption'], 'feed');
} catch (Throwable $e) {
    ig_mark_attempt_failed($item['creativo_id'], $e->getMessage());
    fwrite(STDERR, 'Error al publicar: ' . $e->getMessage() . "\n");
    exit(1);
}

$storyId = null;
$storyError = null;
if ($withStory) {
    try {
        $storyId = ig_publish_image($userId, $token, ig_asset_url($item['story_path']), '', 'story');
    } catch (Throwable $e) {
        $storyError = 'Story: ' . $e->getMessage();
        fwrite(STDERR, $storyError . "\n");
    }
}
// El feed ya salió: se marca publicada aunque la story falle, para no duplicar el post.
ig_mark_published($item['creativo_id'], $today, $feedId, $storyId, $storyError);
echo "Publicado. feed={$feedId} story=" . ($storyId ?? 'no') . "\n";
