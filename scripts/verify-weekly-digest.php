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

$tue = new DateTimeImmutable('2026-11-24', $tz);
$wed = new DateTimeImmutable('2026-11-25', $tz);
$thu = new DateTimeImmutable('2026-11-26', $tz);
$firstTue = kinesica_digest_first_business_day($tue);
check(kinesica_digest_may_send_today($tue, $firstTue, '2026-11-25') === false, 'mar 24 < not_before no envía');
check(kinesica_digest_may_send_today($wed, $firstTue, '2026-11-25') === true, 'mié inaugural OK');
check(kinesica_digest_may_send_today($thu, $firstTue, '2026-11-25') === true, 'jue inaugural retry OK');
$nextMon = new DateTimeImmutable('2026-11-30', $tz);
$firstNext = kinesica_digest_first_business_day($nextMon);
check(kinesica_digest_may_send_today($nextMon, $firstNext, '2026-11-25') === true, 'lun siguiente = primer hábil');
$nextTue = new DateTimeImmutable('2026-12-01', $tz);
check(kinesica_digest_may_send_today($nextTue, $firstNext, '2026-11-25') === false, 'mar post-inaugural no envía');

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

// --- resolve email (fail-closed) ---
check(
    kinesica_digest_resolve_email([], [], 'martin@example.test') === 'martin@example.test',
    'fallback email explícito (tests)'
);
try {
    kinesica_digest_resolve_email([], [], '');
    check(false, 'sin email debe fallar');
} catch (InvalidArgumentException $e) {
    check(true, 'fail-closed sin email');
}
try {
    kinesica_digest_resolve_email([], [], 'not-an-email');
    check(false, 'fallback inválido');
} catch (InvalidArgumentException $e) {
    check(true, 'fallback inválido rechazado');
}

// --- run: skip día / empty / dry ---
// Env aísla destinos de cfg.php real (fail-closed sigue testeable sin env/cfg/fallback).
putenv('MARTIN_EMAIL=martin@example.test');
putenv('NORBERTO_EMAIL=norberto@example.test');
$_ENV['MARTIN_EMAIL'] = 'martin@example.test';
$_ENV['NORBERTO_EMAIL'] = 'norberto@example.test';

$chErr = kinesica_digest_channel_errores();
$chErr['load_items'] = static fn(): array => [];
$tueRun = new DateTimeImmutable('2026-11-24 09:00', $tz);
$rEarly = kinesica_digest_run($chErr, ['now' => $tueRun, 'dry_run' => true, 'items' => [['title' => 'Bug']]]);
check(($rEarly['action'] ?? '') === 'skip_too_early', 'skip antes de not_before (2026-11-25)');
check(($rEarly['html'] ?? null) === null, 'skip no arma html');

$wedRun = new DateTimeImmutable('2026-11-25 09:00', $tz);
$rInaug = kinesica_digest_run($chErr, ['now' => $wedRun, 'dry_run' => true, 'items' => [['title' => 'Bug']]]);
check(($rInaug['action'] ?? '') === 'dry_run', 'inaugural mié 25 aunque no sea primer hábil');

$thuRun = new DateTimeImmutable('2026-11-26 09:00', $tz);
$rRetry = kinesica_digest_run($chErr, ['now' => $thuRun, 'dry_run' => true, 'items' => [['title' => 'Bug']]]);
check(($rRetry['action'] ?? '') === 'dry_run', 'jue inaugural permite reintento si no marcado');

$friNext = new DateTimeImmutable('2026-12-04 09:00', $tz);
$rSkip = kinesica_digest_run($chErr, ['now' => $friNext, 'dry_run' => true, 'items' => [['title' => 'Bug']]]);
check(($rSkip['action'] ?? '') === 'skip_not_first_business_day', 'skip mid-week post-inaugural');

$rEmpty = kinesica_digest_run($chErr, ['now' => $wedRun, 'dry_run' => true, 'items' => []]);
check(($rEmpty['action'] ?? '') === 'skip_empty', 'errores skip_if_empty');

$chPend = kinesica_digest_channel_pendientes();
$rPendEmpty = kinesica_digest_run($chPend, ['now' => $wedRun, 'dry_run' => true, 'items' => []]);
check(($rPendEmpty['action'] ?? '') === 'skip_empty', 'pendientes skip_if_empty');
$rDry = kinesica_digest_run($chPend, [
    'now' => $wedRun,
    'dry_run' => true,
    'items' => [['title' => 'Demo', 'badge' => '1']],
]);
check(($rDry['action'] ?? '') === 'dry_run', 'pendientes dry_run');
check(($rDry['to'] ?? '') === 'norberto@example.test', 'to Norberto desde env de test');
check(($rDry['count'] ?? 0) === 1, 'count dry');

$chNoMail = kinesica_digest_channel_errores();
$chNoMail['email_env'] = [];
$chNoMail['email_cfg_paths'] = [];
$chNoMail['email_fallback'] = '';
$rCfg = kinesica_digest_run($chNoMail, [
    'now' => $wedRun,
    'dry_run' => true,
    'items' => [['title' => 'Bug']],
]);
check(($rCfg['action'] ?? '') === 'config_error', 'fail-closed sin email en canal');

$rPrev = kinesica_digest_run($chErr, [
    'now' => $wedRun,
    'preview' => true,
    'items' => [
        ['title' => 'Bug Clara', 'subtitle' => 'Clara (IA)', 'badge' => '1'],
    ],
]);
check(($rPrev['action'] ?? '') === 'preview', 'preview errores');
check(($rPrev['to'] ?? '') === 'martin@example.test', 'to Martín test');
check(str_contains((string) ($rPrev['subject'] ?? ''), '1 bug'), 'subject singular bug');
check(str_contains((string) $rPrev['html'], 'Abrir Reporte de Errores'), 'CTA errores');
check(str_contains((string) $rPrev['html'], 'Bug Clara'), 'título bug');
check(str_contains((string) $rPrev['html'], 'Clara (IA)'), 'sección subtitle');
check(str_contains((string) $rPrev['html'], 'www.kinesica.com.ar/admin/errores'), 'link errores');

putenv('MARTIN_EMAIL');
putenv('NORBERTO_EMAIL');
unset($_ENV['MARTIN_EMAIL'], $_ENV['NORBERTO_EMAIL']);

// --- markers ---
$tmpId = 'test_digest_' . getmypid();
$marker = kinesica_digest_marker_file($tmpId);
@unlink($marker);
check(!kinesica_digest_already_sent($tmpId, '2026-W48'), 'marker ausente');
kinesica_digest_mark_sent($tmpId, '2026-W48', 'martin@example.test');
check(kinesica_digest_already_sent($tmpId, '2026-W48'), 'marker presente');
check(!kinesica_digest_already_sent($tmpId, '2026-W49'), 'otra semana');
check(is_file($marker) && str_contains((string) file_get_contents($marker), '2026-W48'), 'marker atómico legible');
@unlink($marker);
check(kinesica_digest_mark_sent_best_effort($tmpId, '2026-W48', 'martin@example.test'), 'best_effort mark');
check(kinesica_digest_already_sent($tmpId, '2026-W48'), 'best_effort readable');
@unlink($marker);
@unlink(kinesica_digest_lock_file($tmpId));

// Canales de producción sin emails hardcodeados
$prodPend = kinesica_digest_channel_pendientes();
$prodErr = kinesica_digest_channel_errores();
check(($prodPend['email_fallback'] ?? 'x') === '', 'pendientes sin fallback hardcodeado');
check(($prodErr['email_fallback'] ?? 'x') === '', 'errores sin fallback hardcodeado');

// --- line budget admin digest modules ---
foreach ([
    'lib_digest.php',
    'lib_digest_schedule.php',
    'lib_digest_marker.php',
    'lib_digest_mail.php',
    'lib_digest_channels.php',
    'lib_digest_run.php',
    'lib_argentina_holidays.php',
    'cron_weekly_digest.php',
    'cron_pendientes_digest.php',
] as $rel) {
    $path = $root . '/admin/api/' . $rel;
    check(is_file($path), "existe {$rel}");
    $lines = substr_count((string) file_get_contents($path), "\n") + 1;
    check($lines <= 250, "{$rel} ≤250 líneas (tiene {$lines})");
}

check(!is_file($root . '/admin/api/lib_pendientes_digest.php'), 'sin lib_pendientes_digest legacy');
$scheduleSrc = (string) file_get_contents($root . '/admin/api/lib_digest_schedule.php');
check(!str_contains($scheduleSrc, 'file_get_contents'), 'schedule sin parse regex de feriados');
check(str_contains($scheduleSrc, 'lib_argentina_holidays.php'), 'schedule usa lib_argentina_holidays');
$channelsSrc = (string) file_get_contents($root . '/admin/api/lib_digest_channels.php');
check(str_contains($channelsSrc, 'function kinesica_digest_channel('), 'factory común de canales');
check(!defined('KINESICA_BACKUP_HOLIDAYS') || is_array(KINESICA_BACKUP_HOLIDAYS), 'const feriados cargada');
$docs = (string) file_get_contents($root . '/docs/pendientes-digest.md');
check(!str_contains($docs, 'norberto1712@'), 'docs sin gmail Norberto');
check(!str_contains($docs, 'martin.brude@'), 'docs sin gmail Martín');
check(!str_contains($docs, 'u696348908'), 'docs sin path Hostinger real');
check(!str_contains((string) file_get_contents($root . '/admin/api/lib_calendar_backup.php'), 'BEGIN_ARGENTINA_HOLIDAYS'), 'backup ya no duplica feriados');

echo "verify-weekly-digest OK ({$n} checks)\n";
