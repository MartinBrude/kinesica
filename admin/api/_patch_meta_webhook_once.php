<?php
declare(strict_types=1);
/**
 * One-shot: agrega meta_webhook_verify_token a private/admin-config.php
 * sin tocar instagram_token ni otras claves. Borrar tras ejecutar.
 *
 * CLI: php admin/api/_patch_meta_webhook_once.php
 * HTTP (solo con secret): ?token=migrate-{webhook_secret}
 */
$path = dirname(__DIR__, 3) . '/private/admin-config.php';
$log = __DIR__ . '/_patch_meta_webhook_once.log';
$verify = getenv('KINESICA_META_VERIFY') ?: 'fa2d6976dcd61e82223242350940a4631bd353cda21444c1';

function out(string $msg): void
{
    global $log;
    @file_put_contents($log, gmdate('c') . ' ' . $msg . "\n", FILE_APPEND);
    echo $msg . "\n";
}

if (PHP_SAPI !== 'cli') {
    require_once __DIR__ . '/lib.php';
    $token = (string) ($_GET['token'] ?? '');
    $cfg = cfg();
    $expected = 'migrate-' . (string) ($cfg['webhook_secret'] ?? '');
    if ($token === '' || !hash_equals($expected, $token)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo "forbidden\n";
        exit(1);
    }
}

if (!is_file($path)) {
    out('ERROR missing ' . $path);
    exit(1);
}

$raw = (string) file_get_contents($path);
if ($raw === '') {
    out('ERROR empty config');
    exit(1);
}

if (preg_match("/['\"]meta_webhook_verify_token['\"]\s*=>/", $raw)) {
    out('OK already has meta_webhook_verify_token');
    exit(0);
}

if (preg_match("/['\"]instagram_token['\"]/", $raw) !== 1) {
    out('ERROR unexpected: instagram_token marker missing; abort');
    exit(1);
}

$insert = "\n    'meta_webhook_verify_token' => '" . addslashes($verify) . "',\n";
$count = 0;
if (preg_match("/(['\"]webhook_secret['\"]\s*=>\s*'[^']*',)/", $raw)) {
    $new = preg_replace("/(['\"]webhook_secret['\"]\s*=>\s*'[^']*',)/", '$1' . $insert, $raw, 1, $count);
} else {
    $new = preg_replace('/return\s+(\[|array\s*\()/', 'return $1' . $insert, $raw, 1, $count);
}

if (!is_string($new) || $count !== 1) {
    out('ERROR could not insert key (count=' . $count . ')');
    exit(1);
}

if (preg_match("/['\"]instagram_token['\"]/", $new) !== 1) {
    out('ERROR safety check failed after edit');
    exit(1);
}

$bak = $path . '.bak-meta-' . gmdate('YmdHis');
if (!copy($path, $bak)) {
    out('ERROR backup failed');
    exit(1);
}

if (file_put_contents($path, $new, LOCK_EX) === false) {
    out('ERROR write failed');
    exit(1);
}
@chmod($path, 0600);
out('OK patched ' . $path . ' bak=' . $bak);
