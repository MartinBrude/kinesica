<?php
declare(strict_types=1);

/**
 * Calendario del digesto semanal (días hábiles AR + feriados del motor de turnos).
 */

require_once __DIR__ . '/lib_argentina_holidays.php';

/**
 * @return list<string> YYYY-MM-DD
 */
function kinesica_digest_holidays(): array
{
    return kinesica_argentina_holidays();
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

/**
 * Fecha YYYY-MM-DD desde la cual puede enviar (inclusive).
 * cfg digest_not_before; "none" desactiva. Default Kinésica: 2026-11-25 (primer envío).
 */
function kinesica_digest_not_before(): ?string
{
    if (function_exists('cfg')) {
        $raw = trim((string) (cfg()['digest_not_before'] ?? ''));
        if ($raw === 'none' || $raw === '0') {
            return null;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return $raw;
        }
    }
    return '2026-11-25';
}

/**
 * true si hoy puede enviar: primer hábil, o cualquier hábil ≥ not_before
 * dentro de la semana ISO inaugural (reintento si falló el día 1).
 */
function kinesica_digest_may_send_today(DateTimeImmutable $today, DateTimeImmutable $first, ?string $notBefore): bool
{
    $todayIso = $today->format('Y-m-d');
    if ($notBefore !== null && $todayIso < $notBefore) {
        return false;
    }
    if ($todayIso === $first->format('Y-m-d')) {
        return true;
    }
    if ($notBefore === null || !kinesica_digest_is_business_day($today)) {
        return false;
    }
    $nb = new DateTimeImmutable($notBefore, $today->getTimezone());
    return kinesica_digest_week_key($today) === kinesica_digest_week_key($nb);
}
