<?php
declare(strict_types=1);

/**
 * CLI — copia runtime JSON a data/archive/ (etapa 10, sin borrar seeds).
 *
 *   php admin/api/export_json_snapshots.php --token=TOKEN
 *
 * Docs: docs/etapa10-retiro-compatibilidad.md
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'No encontrado'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

require_once __DIR__ . '/lib_db.php';

$args = array_slice($argv, 1);
$token = '';
foreach ($args as $a) {
    if (str_starts_with($a, '--token=')) {
        $token = substr($a, 8);
    }
}
$expected = (string) (cfg()['install_token'] ?? '');
$envTok = getenv('KINESICA_MIGRATE_TOKEN');
if (is_string($envTok) && $envTok !== '') {
    $expected = $envTok;
}
if ($expected === '' || $token === '' || !hash_equals($expected, $token)) {
    fwrite(STDERR, "export_json_snapshots.php: token inválido.\n");
    exit(1);
}

$archive = __DIR__ . '/data/archive';
if (!is_dir($archive) && !@mkdir($archive, 0775, true) && !is_dir($archive)) {
    fwrite(STDERR, "No se pudo crear data/archive\n");
    exit(1);
}

$ts = gmdate('Ymd\THis\Z');
$copied = [];
foreach (['settings', 'gastos', 'encuestas'] as $name) {
    $src = __DIR__ . '/data/' . $name . '.json';
    if (!is_file($src)) {
        $seed = __DIR__ . '/' . $name . '.json';
        if (is_file($seed)) {
            $src = $seed;
        } else {
            continue;
        }
    }
    $dest = $archive . '/' . $name . '-' . $ts . '.json';
    if (@copy($src, $dest)) {
        $copied[] = basename($dest);
    }
}

echo json_encode([
    'status' => 'ok',
    'archive_dir' => $archive,
    'copied' => $copied,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
