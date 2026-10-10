<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/lib.php';

$dir = dirname(__DIR__, 3) . '/backups/atm';
if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
    fwrite(STDERR, "No se pudo crear $dir\n");
    exit(1);
}

$pdo = db();
$tables = ['users', 'fichas'];
$sql = "-- Kinésica ATM " . gmdate('c') . "\nSET NAMES utf8mb4;\n";
foreach ($tables as $table) {
    $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll();
    $sql .= "DELETE FROM `$table`;\n";
    foreach ($rows as $row) {
        $cols = array_map(static fn ($col) => "`$col`", array_keys($row));
        $vals = array_map(static fn ($value) => $value === null ? 'NULL' : $pdo->quote((string) $value), array_values($row));
        $sql .= 'INSERT INTO `' . $table . '` (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $vals) . ");\n";
    }
}

$path = $dir . '/atm-' . gmdate('Y-m-d') . '.sql';
if (file_put_contents($path, $sql) === false) {
    fwrite(STDERR, "No se pudo escribir $path\n");
    exit(1);
}
chmod($path, 0600);

$files = glob($dir . '/atm-*.sql') ?: [];
rsort($files);
foreach (array_slice($files, 8) as $old) {
    unlink($old);
}

fwrite(STDOUT, basename($path) . ' ' . count($files) . " copias\n");
