<?php
declare(strict_types=1);

/**
 * Kinésica — Cron: catch-up de recordatorios el mismo día del turno.
 *
 * Solo envía a turnos de HOY (AR) que aún no tienen sent/sent_email para su
 * calendar_event_id, con ≥60 min de margen. Preferí WhatsApp si
 * reminder_template_when_mode=when_phrase (plantilla Meta sin "mañana" fijo);
 * si no, email con copy "hoy".
 *
 * Hostinger Cron (Lun–Vie 08:00 AR = 11:00 UTC):
 *   0 11 * * 1-5  /usr/bin/php /home/u696348908/domains/kinesica.com.ar/public_html/admin/api/cron_recordatorios_sameday.php
 *
 * Flags: --dry-run
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_sameday.php';

$dry = in_array('--dry-run', $argv, true);
$res = recordatorios_sameday_run($dry);

$line = sprintf(
    "[recordatorios-sameday] ok=%s dry=%s mode=%s processed=%d sent=%d email=%d skipped=%d failed=%d missing=%d%s\n",
    !empty($res['ok']) ? '1' : '0',
    $dry ? '1' : '0',
    recordatorios_template_when_mode(),
    (int) ($res['processed'] ?? 0),
    (int) ($res['sent'] ?? 0),
    (int) ($res['sent_email'] ?? 0),
    (int) ($res['skipped'] ?? 0),
    (int) ($res['failed'] ?? 0),
    (int) ($res['missing_phone'] ?? 0),
    isset($res['error']) ? (' error=' . $res['error']) : ''
);
echo $line;

if ($dry && !empty($res['details']) && is_array($res['details'])) {
    foreach ($res['details'] as $d) {
        if (!is_array($d)) {
            continue;
        }
        echo json_encode($d, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

exit(!empty($res['ok']) ? 0 : 1);
