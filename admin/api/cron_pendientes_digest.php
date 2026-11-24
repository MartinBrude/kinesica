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

$args = array_slice($argv, 1);
if (!in_array('--channel=pendientes', $args, true) && !in_array('--channel=all', $args, true)) {
    $args[] = '--channel=pendientes';
}
$php = PHP_BINARY !== '' ? PHP_BINARY : 'php';
$cmd = escapeshellarg($php) . ' ' . escapeshellarg(__DIR__ . '/cron_weekly_digest.php');
foreach ($args as $a) {
    $cmd .= ' ' . escapeshellarg((string) $a);
}
passthru($cmd, $code);
exit($code);
