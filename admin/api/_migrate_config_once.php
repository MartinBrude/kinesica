<?php
declare(strict_types=1);
/**
 * One-shot: copia config.php a ../private/admin-config.php (fuera de public_html).
 * Borrar este archivo después de ejecutarlo.
 *
 * GET /admin/api/_migrate_config_once.php?token=TOKEN
 * TOKEN = install_token de config o "migrate-" + webhook_secret
 */
require __DIR__ . '/lib.php';

$token = (string) ($_GET['token'] ?? '');
$cfg = cfg();
$expected = 'migrate-' . (string) ($cfg['webhook_secret'] ?? '');
if ($token === '' || !hash_equals($expected, $token)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "forbidden\n";
    exit;
}

$src = __DIR__ . '/config.php';
if (!is_file($src)) {
    http_response_code(500);
    echo "missing config.php in api/\n";
    exit;
}

$domainRoot = dirname(__DIR__, 3);
$privateDir = $domainRoot . '/private';
$dest = $privateDir . '/admin-config.php';

if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    http_response_code(500);
    echo "cannot create private dir: {$privateDir}\n";
    exit;
}

$deny = $privateDir . '/.htaccess';
if (!is_file($deny)) {
    file_put_contents($deny, "Require all denied\nDeny from all\n");
}

if (!copy($src, $dest)) {
    http_response_code(500);
    echo "copy failed\n";
    exit;
}
@chmod($dest, 0600);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'dest' => $dest,
    'bytes' => filesize($dest),
    'hint' => 'Borrá admin/api/_migrate_config_once.php del servidor.',
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
echo "\n";
