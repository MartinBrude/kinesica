<?php
declare(strict_types=1);

/**
 * CLI — backfill de IDs / contactos / profesional_id / turnos (lib_relational_backfill.php).
 *
 *   php admin/api/backfill_relational.php --dry-run --token=TOKEN
 *   php admin/api/backfill_relational.php --apply --token=TOKEN
 *   php admin/api/backfill_relational.php --only=turnos,recordatorios_turno_id --apply --token=TOKEN
 *   php admin/api/backfill_relational.php --only=interaccion_estado,encuestas --apply --token=TOKEN
 *   php admin/api/backfill_relational.php --only=profesionales_contactos,configuraciones,gastos --apply --token=TOKEN
 *
 * Default: dry-run. --apply solo rellena columnas NULL con match inequívoco.
 * No requiere REL_WRITE_IDS.
 * Etapa 8: profesionales_contactos, configuraciones, gastos.
 * Etapa 9: no backfill propio (FKs vía migrate 013).
 *
 * Docs: docs/runbook-datos-relacionales-antigravity.md · docs/codigo-datos-relacionales.md
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'No encontrado'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_relational_backfill.php';

$args = array_slice($argv, 1);
$wantApply = in_array('--apply', $args, true);
$wantDry = in_array('--dry-run', $args, true) || !$wantApply;
if ($wantApply && $wantDry && in_array('--dry-run', $args, true)) {
    fwrite(STDERR, "Usá --apply o --dry-run, no ambos. Priorizando dry-run.\n");
    $wantApply = false;
}
$apply = $wantApply && !$wantDry;

$outJson = '';
$token = (string) (getenv('KINESICA_AUDIT_TOKEN') ?: getenv('KINESICA_MIGRATE_TOKEN') ?: '');
$only = null;
foreach ($args as $arg) {
    if (str_starts_with($arg, '--out=')) {
        $outJson = substr($arg, 6);
    } elseif (str_starts_with($arg, '--token=')) {
        $token = substr($arg, 8);
    } elseif (str_starts_with($arg, '--only=')) {
        $only = array_values(array_filter(array_map('trim', explode(',', substr($arg, 7)))));
    }
}

$expected = (string) (cfg()['install_token'] ?? '');
$skipAuth = getenv('KINESICA_MIGRATE_ALLOW_TEST') === '1' || getenv('KINESICA_AUDIT_ALLOW_TEST') === '1';
if (!$skipAuth) {
    if ($expected === '' || in_array($expected, ['disabled', 'CAMBIAR'], true) || $token === '' || !hash_equals($expected, $token)) {
        fwrite(STDERR, "backfill_relational.php: token inválido.\n");
        exit(2);
    }
}

try {
    $pdo = db();
} catch (Throwable $e) {
    fwrite(STDERR, 'backfill_relational.php: DB: ' . $e->getMessage() . "\n");
    exit(3);
}

try {
    $report = kinesica_rel_backfill_run($pdo, $apply, $only);
    $report['mode'] = $apply ? 'apply' : 'dry-run';
} catch (Throwable $e) {
    fwrite(STDERR, 'backfill_relational.php: ' . $e->getMessage() . "\n");
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

$summary = ['mode' => $report['mode'], 'tables' => []];
foreach ($report['tables'] as $name => $t) {
    $summary['tables'][$name] = [
        'scanned' => $t['scanned'],
        'already_set' => $t['already_set'],
        'matched' => $t['matched'],
        'updated' => $t['updated'],
        'ambiguous' => $t['ambiguous'],
        'unmatched' => $t['unmatched'],
        'skipped_no_column' => $t['skipped_no_column'],
    ];
}
echo json_encode(['ok' => true, 'summary' => $summary], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
if ($outJson === '') {
    echo $json . "\n";
}

exit(0);
