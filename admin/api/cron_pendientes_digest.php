<?php
declare(strict_types=1);

/**
 * Alias BC → cron_weekly_digest.php --channel=pendientes
 * Preferí cron_weekly_digest.php (ambos canales).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$hasChannel = false;
foreach ($argv as $arg) {
    if (str_starts_with((string) $arg, '--channel=')) {
        $hasChannel = true;
        break;
    }
}
if (!$hasChannel) {
    $argv[] = '--channel=pendientes';
}
require __DIR__ . '/cron_weekly_digest.php';
