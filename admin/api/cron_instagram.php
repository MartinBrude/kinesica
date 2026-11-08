<?php
declare(strict_types=1);

/**
 * Kinésica — Cron: publica la próxima pieza de la cola en Instagram (feed + story).
 * Días y hora en horario Argentina (America/Argentina/Buenos_Aires), sin importar la zona del servidor.
 *
 * Hostinger Cron (cada hora; el script decide si corresponde publicar):
 *   0 * * * *  /usr/bin/php /home/u.../public_html/admin/api/cron_instagram.php
 *
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

echo "Publicando {$item['creativo_id']}" . ($dry ? " (dry-run)\n" : "\n");
if ($dry) exit(0);

try {
    $res = ig_publish_piece($item, true, $withStory);
    echo "Publicado con éxito. feed=" . ($res['feed_media_id'] ?? 'no') . " story=" . ($res['story_media_id'] ?? 'no') . "\n";
    if (!empty($res['last_error'])) {
        echo "Aviso: {$res['last_error']}\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Error al publicar: ' . $e->getMessage() . "\n");
    exit(1);
}
