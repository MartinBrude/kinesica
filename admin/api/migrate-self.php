<?php
declare(strict_types=1);

/**
 * CLI — aplica migraciones usando install_token del config del servidor.
 * Útil en Hostinger sin pasar el token en la línea de comando.
 *
 *   php admin/api/migrate-self.php
 *   php admin/api/migrate-self.php --status
 *   php admin/api/migrate-self.php --dry-run
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

try {
    $pdo = db();
} catch (Throwable $e) {
    fwrite(STDERR, 'migrate-self.php: no se pudo conectar a la DB: ' . $e->getMessage() . "\n");
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
    fwrite(STDERR, 'migrate-self.php: ' . $e->getMessage() . "\n");
    exit(1);
}
