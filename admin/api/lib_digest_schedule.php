<?php
declare(strict_types=1);

/**
 * Calendario del digesto semanal (días hábiles AR + feriados del motor de turnos).
 */

/**
 * @return list<string> YYYY-MM-DD
 */
function kinesica_digest_holidays(): array
{
    static $list = null;
    if (is_array($list)) {
        return $list;
    }
    if (defined('KINESICA_BACKUP_HOLIDAYS') && is_array(KINESICA_BACKUP_HOLIDAYS)) {
        $list = [];
        foreach (KINESICA_BACKUP_HOLIDAYS as $d) {
            $d = (string) $d;
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
                $list[] = $d;
            }
        }
        return $list;
    }
    $file = __DIR__ . '/lib_calendar_backup.php';
    $raw = is_file($file) ? (string) @file_get_contents($file) : '';
    $list = [];
    $chunk = '';
    if ($raw !== '' && preg_match(
        '/\/\/ BEGIN_ARGENTINA_HOLIDAYS\s*(.*?)\s*\/\/ END_ARGENTINA_HOLIDAYS/s',
        $raw,
        $m
    )) {
        $chunk = $m[1];
    } elseif ($raw !== '' && preg_match(
        '/const\s+KINESICA_BACKUP_HOLIDAYS\s*=\s*\[(.*?)\];/s',
        $raw,
        $m
    )) {
        $chunk = $m[1];
    }
    if ($chunk !== '' && preg_match_all("/'(\\d{4}-\\d{2}-\\d{2})'/", $chunk, $dates)) {
        $list = $dates[1];
    }
    return $list;
}

function kinesica_digest_ar_now(?DateTimeImmutable $now = null): DateTimeImmutable
{
    $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    if ($now instanceof DateTimeImmutable) {
        return $now->setTimezone($tz);
    }
    return new DateTimeImmutable('now', $tz);
}

function kinesica_digest_is_business_day(DateTimeImmutable $day): bool
{
    if ((int) $day->format('N') >= 6) {
        return false;
    }
    return !in_array($day->format('Y-m-d'), kinesica_digest_holidays(), true);
}

/** Primer día hábil (lun–vie, no feriado) de la semana ISO de $now. */
function kinesica_digest_first_business_day(DateTimeImmutable $now): DateTimeImmutable
{
    $monday = $now->modify('monday this week')->setTime(0, 0, 0);
    for ($i = 0; $i < 7; $i++) {
        $candidate = $monday->modify("+{$i} day");
        if (kinesica_digest_is_business_day($candidate)) {
            return $candidate;
        }
    }
    return $monday;
}

/** Clave semanal ISO, p.ej. 2026-W48 */
function kinesica_digest_week_key(DateTimeImmutable $now): string
{
    return $now->format('o-\\WW');
}
