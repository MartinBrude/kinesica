<?php
declare(strict_types=1);

/**
 * Kinésica — Cron: digesto semanal (pendientes → Norberto, errores → Martín).
 *
 * Primer día hábil de la semana (lun–vie, feriados AR). Markers independientes.
 *
 * Hostinger (Lun–Vie 09:00 AR = 12:00 UTC):
 *   0 12 * * 1-5  /usr/bin/php .../admin/api/cron_weekly_digest.php
 *
 * Flags: --dry-run  --force  --preview  --channel=pendientes|errores|all
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_digest.php';

$dry = in_array('--dry-run', $argv, true);
$force = in_array('--force', $argv, true);
$preview = in_array('--preview', $argv, true);
$channelArg = 'all';
foreach ($argv as $arg) {
    if (str_starts_with((string) $arg, '--channel=')) {
        $channelArg = strtolower(trim(substr((string) $arg, 10)));
    }
}

$opts = ['dry_run' => $dry, 'force' => $force, 'preview' => $preview];

if ($channelArg !== 'all') {
    $ch = kinesica_digest_channel_by_id($channelArg);
    if ($ch === null) {
        fwrite(STDERR, "Canal desconocido: {$channelArg}\n");
        exit(1);
    }
    $results = [kinesica_digest_run($ch, $opts)];
} else {
    $results = kinesica_digest_run_all($opts);
}

if ($preview) {
    foreach ($results as $res) {
        $id = (string) ($res['channel'] ?? 'digest');
        $html = (string) ($res['html'] ?? '');
        $outPath = __DIR__ . '/data/digest_' . $id . '_preview.html';
        $dir = dirname($outPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if ($html !== '' && @file_put_contents($outPath, $html) !== false) {
            fwrite(STDERR, "Preview {$id} → {$outPath}\n");
        }
        echo "<!-- channel:{$id} -->\n{$html}\n";
    }
    exit(0);
}

$tz = new DateTimeZone('America/Argentina/Buenos_Aires');
$nowIso = (new DateTimeImmutable('now', $tz))->format(DateTimeInterface::ATOM);
$okAll = true;

echo "=== Kinésica: Cron digesto semanal ===\n";
echo "Fecha/Hora: {$nowIso}\n";

foreach ($results as $res) {
    $ok = !empty($res['ok']);
    $okAll = $okAll && $ok;
    echo "---\n";
    echo 'Canal: ' . ($res['channel'] ?? '?') . "\n";
    echo 'Semana: ' . ($res['week'] ?? '?') . "\n";
    echo 'Hoy / primer hábil: ' . ($res['today'] ?? '?') . ' / ' . ($res['first_business_day'] ?? '?') . "\n";
    echo 'Ítems: ' . (int) ($res['count'] ?? 0) . "\n";
    echo 'Acción: ' . ($res['action'] ?? '?') . "\n";
    echo 'Destino: ' . ($res['to'] ?? '?') . "\n";
    if (!empty($res['subject'])) {
        echo 'Asunto: ' . $res['subject'] . "\n";
    }
    echo 'Mensaje: ' . ($res['message'] ?? '') . "\n";
    if (!empty($res['error'])) {
        echo 'Error: ' . $res['error'] . "\n";
    }
    echo 'Resultado: ' . ($ok ? 'OK' : 'FAIL') . "\n";
}

exit($okAll ? 0 : 1);
