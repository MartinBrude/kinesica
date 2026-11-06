<?php
declare(strict_types=1);

/**
 * Aplica migraciones versionadas. Solo CLI.
 *
 *   php admin/api/migrate.php
 *   php admin/api/migrate.php --status
 *   php admin/api/migrate.php --dry-run
 *
 * Auth: install_token vía argv --token=... o env KINESICA_MIGRATE_TOKEN
 * (debe coincidir con cfg install_token, salvo en SQLite de pruebas).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'No encontrado'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

require_once __DIR__ . '/lib_db.php';
require_once __DIR__ . '/lib_migrations.php';

$args = array_slice($argv, 1);
$dryRun = in_array('--dry-run', $args, true);
$statusOnly = in_array('--status', $args, true);
$token = '';
foreach ($args as $arg) {
    if (str_starts_with($arg, '--token=')) {
        $token = substr($arg, 8);
    }
}
if ($token === '') {
    $token = (string) (getenv('KINESICA_MIGRATE_TOKEN') ?: '');
}

$cfg = function_exists('cfg') ? cfg() : [];
$expected = (string) ($cfg['install_token'] ?? '');
$skipAuth = getenv('KINESICA_MIGRATE_ALLOW_TEST') === '1';
if (!$skipAuth) {
    if ($expected === '' || in_array($expected, ['disabled', 'CAMBIAR'], true) || $token === '' || !hash_equals($expected, $token)) {
        fwrite(STDERR, "migrate.php: token inválido o install_token no configurado.\n");
        fwrite(STDERR, "Usá --token=... o KINESICA_MIGRATE_TOKEN. Para tests: KINESICA_MIGRATE_ALLOW_TEST=1.\n");
        exit(2);
    }
}

try {
    $pdo = db();
} catch (Throwable $e) {
    fwrite(STDERR, 'migrate.php: no se pudo conectar a la DB: ' . $e->getMessage() . "\n");
    exit(3);
}

try {
    if ($statusOnly) {
        $st = kinesica_migrations_status($pdo);
        echo json_encode(['ok' => true, 'status' => $st], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
        exit(0);
    }
    $result = kinesica_migrations_run($pdo, $dryRun);
    echo json_encode(['ok' => true, 'dry_run' => $dryRun, 'result' => $result], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'migrate.php: ' . $e->getMessage() . "\n");
    exit(1);
}
