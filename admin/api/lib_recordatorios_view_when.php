<?php
declare(strict_types=1);

/**
 * Formateo amigable de fechas y frases de horario para recordatorios.
 */

function recordatorios_format_friendly_date(string $dateStr): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr, $m)) {
        return $dateStr;
    }
    $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $ts = strtotime($dateStr . ' 12:00:00 UTC');
    if ($ts === false) {
        return $dateStr;
    }
    $w = (int) gmdate('w', $ts);
    return trim(($dias[$w] ?? '') . ' ' . ((int) $m[3]) . ' de ' . ($meses[(int) $m[2]] ?? ''));
}

/**
 * Genera la frase completa para el recordatorio (parámetro {{3}} de WhatsApp y cuándo de Email).
 */
function recordatorios_format_when_phrase(?string $dateStr, ?string $timeStr): string
{
    $time = trim((string) $timeStr);
    $isConvenir = false;
    if ($time === '' || stripos($time, 'convenir') !== false || stripos($time, 'convenido') !== false) {
        $time = 'horario a convenir';
        $isConvenir = true;
    } elseif (!preg_match('/\bhs\b/i', $time)) {
        $time .= ' hs';
    }

    $date = trim((string) $dateStr);
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $isConvenir ? 'mañana en horario a convenir' : 'mañana a las ' . $time;
    }

    $now = new DateTimeImmutable('now', recordatorios_tz());
    $todayKey = $now->format('Y-m-d');
    $tomorrowKey = $now->modify('+1 day')->format('Y-m-d');

    $friendly = recordatorios_format_friendly_date($date);
    $timePart = $isConvenir ? ' (' . $time . ')' : ' a las ' . $time;

    if ($date === $todayKey) {
        return 'hoy ' . $friendly . $timePart;
    }
    if ($date === $tomorrowKey) {
        return 'mañana ' . $friendly . $timePart;
    }
    return 'el ' . $friendly . $timePart;
}
