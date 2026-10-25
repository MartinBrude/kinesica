<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

// Si se solicita desde la web, exigir sesión de administrador antes de tocar la base de datos
if (PHP_SAPI !== 'cli') {
    require_header();
    $auth = require_auth();
    if (!is_admin($auth)) {
        json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    }
}

$pdo = db();
$tables = ['users', 'fichas', 'pacientes', 'lista_espera'];

$sql = "-- Kinésica Backup " . gmdate('c') . "\n";
$sql .= "SET NAMES utf8mb4;\n";
$sql .= "SET foreign_key_checks = 0;\n\n";

foreach ($tables as $table) {
    try {
        $check = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetch();
        if (!$check) {
            continue;
        }
        $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll();
        $sql .= "-- Tabla: $table (" . count($rows) . " registros)\n";
        $sql .= "DELETE FROM `$table`;\n";
        foreach ($rows as $row) {
            $cols = array_map(static fn ($col) => "`$col`", array_keys($row));
            $vals = array_map(static fn ($value) => $value === null ? 'NULL' : $pdo->quote((string) $value), array_values($row));
            $sql .= 'INSERT INTO `' . $table . '` (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $vals) . ");\n";
        }
        $sql .= "\n";
    } catch (Throwable $e) {
        $sql .= "-- Error al respaldar $table: " . $e->getMessage() . "\n";
    }
}
$sql .= "SET foreign_key_checks = 1;\n";

// Si se ejecuta por CLI (Cron job del servidor)
if (PHP_SAPI === 'cli') {
    $dir = dirname(__DIR__, 3) . '/backups/atm';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        fwrite(STDERR, "No se pudo crear $dir\n");
        exit(1);
    }
    $path = $dir . '/kinesica-' . gmdate('Y-m-d') . '.sql';
    if (file_put_contents($path, $sql) === false) {
        fwrite(STDERR, "No se pudo escribir $path\n");
        exit(1);
    }
    chmod($path, 0600);

    $files = glob($dir . '/kinesica-*.sql') ?: [];
    rsort($files);
    foreach (array_slice($files, 14) as $old) {
        unlink($old);
    }
    fwrite(STDOUT, basename($path) . ' ' . count($files) . " copias\n");
    exit(0);
}

$filename = 'kinesica-backup-' . gmdate('Y-m-d') . '.sql';
header('Content-Type: application/sql; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
echo $sql;
exit;
