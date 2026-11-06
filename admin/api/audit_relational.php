<?php
declare(strict_types=1);

/**
 * CLI — auditoría read-only (lib_relational_audit.php).
 *
 *   php admin/api/audit_relational.php --token=TOKEN
 *   php admin/api/audit_relational.php --token=TOKEN --out=a.json --md=a.md
 *   php admin/api/audit_relational.php --token=TOKEN --full-pii   # solo copia local
 *
 * Auth: --token / KINESICA_AUDIT_TOKEN = install_token.
 * Tests: KINESICA_AUDIT_ALLOW_TEST=1
 * No modifica la base. Docs: docs/codigo-datos-relacionales.md
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'No encontrado'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_relational_audit.php';

$args = array_slice($argv, 1);
$fullPii = in_array('--full-pii', $args, true);
$outJson = '';
$outMd = '';
$token = (string) (getenv('KINESICA_AUDIT_TOKEN') ?: getenv('KINESICA_MIGRATE_TOKEN') ?: '');
foreach ($args as $arg) {
    if (str_starts_with($arg, '--out=')) {
        $outJson = substr($arg, 6);
    } elseif (str_starts_with($arg, '--md=')) {
        $outMd = substr($arg, 5);
    } elseif (str_starts_with($arg, '--token=')) {
        $token = substr($arg, 8);
    }
}

$expected = (string) (cfg()['install_token'] ?? '');
$skipAuth = getenv('KINESICA_MIGRATE_ALLOW_TEST') === '1' || getenv('KINESICA_AUDIT_ALLOW_TEST') === '1';
if (!$skipAuth) {
    if ($expected === '' || in_array($expected, ['disabled', 'CAMBIAR'], true) || $token === '' || !hash_equals($expected, $token)) {
        fwrite(STDERR, "audit_relational.php: token inválido.\n");
        fwrite(STDERR, "Usá --token=... / KINESICA_AUDIT_TOKEN, o KINESICA_AUDIT_ALLOW_TEST=1 en entorno de prueba.\n");
        exit(2);
    }
}

try {
    $pdo = db();
} catch (Throwable $e) {
    fwrite(STDERR, 'audit_relational.php: DB: ' . $e->getMessage() . "\n");
    exit(3);
}

try {
    $report = kinesica_audit_run($pdo, $fullPii);
} catch (Throwable $e) {
    fwrite(STDERR, 'audit_relational.php: ' . $e->getMessage() . "\n");
    exit(1);
}

$json = json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false) {
    fwrite(STDERR, "No se pudo serializar el informe\n");
    exit(1);
}

if ($outJson !== '') {
    $dir = dirname($outJson);
    if ($dir !== '' && $dir !== '.' && !is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    if (file_put_contents($outJson, $json . "\n") === false) {
        fwrite(STDERR, "No se pudo escribir {$outJson}\n");
        exit(1);
    }
    fwrite(STDERR, "JSON: {$outJson}\n");
}

if ($outMd !== '') {
    $md = kinesica_audit_summary_markdown($report);
    $dir = dirname($outMd);
    if ($dir !== '' && $dir !== '.' && !is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    if (file_put_contents($outMd, $md) === false) {
        fwrite(STDERR, "No se pudo escribir {$outMd}\n");
        exit(1);
    }
    fwrite(STDERR, "Markdown: {$outMd}\n");
}

if ($outJson === '' && $outMd === '') {
    echo $json . "\n";
} else {
    $summary = $report['summary'];
    echo json_encode(['ok' => true, 'summary' => $summary], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
}

exit(0);
