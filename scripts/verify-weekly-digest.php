<?php
declare(strict_types=1);

/**
 * Tests del digesto semanal (schedule, mail, canales, run dry).
 * Ejecución: php scripts/verify-weekly-digest.php
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_digest_schedule.php';
require_once $root . '/admin/api/lib_digest_marker.php';
require_once $root . '/admin/api/lib_digest_mail.php';
require_once $root . '/admin/api/lib_digest_run.php';

$n = 0;
function check(bool $cond, string $msg): void
{
    global $n;
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    $n++;
}

$tz = new DateTimeZone('America/Argentina/Buenos_Aires');

// --- schedule ---
$holidays = kinesica_digest_holidays();
check($holidays !== [], 'feriados cargados');
check(in_array('2026-11-23', $holidays, true), 'feriado 2026-11-23 (Soberanía)');

$monHoliday = new DateTimeImmutable('2026-11-23', $tz);
check(!kinesica_digest_is_business_day($monHoliday), 'lun feriado no hábil');
$first = kinesica_digest_first_business_day($monHoliday);
check($first->format('Y-m-d') === '2026-11-24', 'primer hábil = mar 24');

$sat = new DateTimeImmutable('2026-11-21', $tz);
check(!kinesica_digest_is_business_day($sat), 'sábado no hábil');
check(kinesica_digest_week_key(new DateTimeImmutable('2026-11-24', $tz)) === '2026-W48', 'week key');

// --- mail builder ---
$channel = [
    'greeting' => 'Norberto',
    'url' => 'https://www.kinesica.com.ar/admin/pendientes',
    'cta' => 'Abrir Pendientes',
    'panel' => 'Pendientes',
    'noun_one' => 'pendiente',
    'noun_many' => 'pendientes',
];
$mail = kinesica_digest_build_mail($channel, [
    ['title' => 'Tarea A', 'badge' => '1'],
    ['title' => '<script>x</script>', 'badge' => '2'],
], new DateTimeImmutable('2026-11-24', $tz));
check(str_contains($mail['subject'], '2 pendientes'), 'subject con count');
check(str_contains($mail['html'], 'logo.png'), 'shell con logo');
check(str_contains($mail['html'], 'Abrir Pendientes'), 'CTA');
check(str_contains($mail['html'], 'Hola Norberto'), 'saludo');
check(!str_contains($mail['html'], '<script>x</script>'), 'escape XSS título');
check(str_contains($mail['html'], '&lt;script&gt;'), 'título escapado');
check(str_contains($mail['text'], 'Tarea A'), 'texto plano');

$empty = kinesica_digest_build_mail($channel, [], new DateTimeImmutable('2026-11-24', $tz));
check(str_contains($empty['subject'], 'todo al día'), 'subject vacío');

try {
    kinesica_digest_build_mail(['greeting' => 'X', 'url' => 'http://inseguro.example/', 'cta' => 'a', 'panel' => 'p', 'noun_one' => 'a', 'noun_many' => 'b'], [], $first);
    check(false, 'url http debe fallar');
} catch (InvalidArgumentException $e) {
    check(true, 'url http rechazada');
}
$okHttps = kinesica_digest_build_mail([
    'greeting' => 'Admin',
    'url' => 'https://ejemplo.com/admin/pendientes',
    'cta' => 'Abrir',
    'panel' => 'Pendientes',
    'noun_one' => 'pendiente',
    'noun_many' => 'pendientes',
], [['title' => 'X', 'badge' => '1']], $first);
check(str_contains($okHttps['html'], 'https://ejemplo.com/admin/pendientes'), 'https genérico OK');

// --- resolve email ---
check(
    kinesica_digest_resolve_email([], [], 'martin.brude@gmail.com') === 'martin.brude@gmail.com',
    'fallback email'
);
try {
    kinesica_digest_resolve_email([], [], 'not-an-email');
    check(false, 'fallback inválido');
} catch (InvalidArgumentException $e) {
    check(true, 'fallback inválido rechazado');
}

// --- run: skip día / empty / dry ---
require_once $root . '/admin/api/lib_digest_channels.php';

$chErr = kinesica_digest_channel_errores();
$chErr['load_items'] = static fn(): array => [];
$wed = new DateTimeImmutable('2026-11-25 09:00', $tz);
$rSkip = kinesica_digest_run($chErr, ['now' => $wed, 'dry_run' => true, 'items' => [['title' => 'Bug']]]);
check(($rSkip['action'] ?? '') === 'skip_not_first_business_day', 'skip mid-week');

$tue = new DateTimeImmutable('2026-11-24 09:00', $tz);
$rEmpty = kinesica_digest_run($chErr, ['now' => $tue, 'dry_run' => true, 'items' => []]);
check(($rEmpty['action'] ?? '') === 'skip_empty', 'errores skip_if_empty');

$chPend = kinesica_digest_channel_pendientes();
$rPendEmpty = kinesica_digest_run($chPend, ['now' => $tue, 'dry_run' => true, 'items' => []]);
check(($rPendEmpty['action'] ?? '') === 'skip_empty', 'pendientes skip_if_empty');
$rDry = kinesica_digest_run($chPend, [
    'now' => $tue,
    'dry_run' => true,
    'items' => [['title' => 'Demo', 'badge' => '1']],
]);
check(($rDry['action'] ?? '') === 'dry_run', 'pendientes dry_run');
check(($rDry['to'] ?? '') === 'norberto1712@gmail.com', 'to Norberto');
check(($rDry['count'] ?? 0) === 1, 'count dry');

$rPrev = kinesica_digest_run($chErr, [
    'now' => $tue,
    'preview' => true,
    'items' => [
        ['title' => 'Bug Clara', 'subtitle' => 'Clara (IA)', 'badge' => '1'],
    ],
]);
check(($rPrev['action'] ?? '') === 'preview', 'preview errores');
check(($rPrev['to'] ?? '') === 'martin.brude@gmail.com', 'to Martín');
check(str_contains((string) ($rPrev['subject'] ?? ''), '1 bug'), 'subject singular bug');
check(str_contains((string) $rPrev['html'], 'Abrir Reporte de Errores'), 'CTA errores');
check(str_contains((string) $rPrev['html'], 'Bug Clara'), 'título bug');
check(str_contains((string) $rPrev['html'], 'Clara (IA)'), 'sección subtitle');
check(str_contains((string) $rPrev['html'], 'www.kinesica.com.ar/admin/errores'), 'link errores');

// --- markers ---
$tmpId = 'test_digest_' . getmypid();
$marker = kinesica_digest_marker_file($tmpId);
@unlink($marker);
check(!kinesica_digest_already_sent($tmpId, '2026-W48'), 'marker ausente');
kinesica_digest_mark_sent($tmpId, '2026-W48', 'martin.brude@gmail.com');
check(kinesica_digest_already_sent($tmpId, '2026-W48'), 'marker presente');
check(!kinesica_digest_already_sent($tmpId, '2026-W49'), 'otra semana');
@unlink($marker);

// --- line budget admin digest modules ---
foreach ([
    'lib_digest.php',
    'lib_digest_schedule.php',
    'lib_digest_marker.php',
    'lib_digest_mail.php',
    'lib_digest_channels.php',
    'lib_digest_run.php',
    'cron_weekly_digest.php',
    'cron_pendientes_digest.php',
] as $rel) {
    $path = $root . '/admin/api/' . $rel;
    check(is_file($path), "existe {$rel}");
    $lines = substr_count((string) file_get_contents($path), "\n") + 1;
    check($lines <= 250, "{$rel} ≤250 líneas (tiene {$lines})");
}

check(!is_file($root . '/admin/api/lib_pendientes_digest.php'), 'sin lib_pendientes_digest legacy');

echo "verify-weekly-digest OK ({$n} checks)\n";
