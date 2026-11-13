<?php
declare(strict_types=1);


/**
 * Infiere el profesional asignado ('norberto' o 'maria') según el día y horario del turno,
 * el correo del creador del evento o metadatos del calendario.
 * Retorna 'indistinto' si no puede ser determinado con certeza.
 *
 * Restricciones físicas del consultorio:
 * - 1 sola camilla física (jamás hay turnos solapados de ambos profesionales).
 * - Miércoles: Norberto exclusivo (09:00 a 16:30). María no atiende.
 * - Jueves: Norberto exclusivo (15:00 a 19:00). María no atiende.
 * - Lunes: María de 09:00 a 17:00 | Norberto de 17:30 a 19:30.
 * - Martes: María de 09:00 a 16:00 | Norberto de 16:30 a 19:30.
 * - Viernes: María de 09:00 a 13:00 | Norberto de 13:30 a 19:30.
 */
function infer_practitioner_from_schedule(?string $dateOrDow, ?string $time = null, ?string $creatorOrSummary = null): string
{
    // 1. Detección por creador del evento o mención explícita
    if ($creatorOrSummary !== null && $creatorOrSummary !== '') {
        $meta = mb_strtolower($creatorOrSummary, 'UTF-8');
        if (str_contains($meta, 'norberto1712@gmail.com') || preg_match('/\b(?:norberto|lic\.?\s*brude)\b/u', $meta)) {
            return 'norberto';
        }
        if (str_contains($meta, 'manosmagicas7116@gmail.com') || preg_match('/\b(?:maria|gulin|lic\.?\s*gulin)\b/u', $meta)) {
            return 'maria';
        }
    }

    if ($dateOrDow === null || trim($dateOrDow) === '') {
        return 'indistinto';
    }

    $dow = null;
    $trimmed = trim($dateOrDow);

    // Si $trimmed es un dígito de día de semana (1=Lun .. 7=Dom)
    if (ctype_digit($trimmed) && (int) $trimmed >= 1 && (int) $trimmed <= 7) {
        $dow = (int) $trimmed;
    } elseif (preg_match('/\b(?:miercoles|miércoles|mie|mié)\b/ui', $trimmed)) {
        $dow = 3;
    } elseif (preg_match('/\b(?:jueves|jue)\b/ui', $trimmed)) {
        $dow = 4;
    } elseif (preg_match('/\b(?:lunes|lun)\b/ui', $trimmed)) {
        $dow = 1;
    } elseif (preg_match('/\b(?:martes|mar)\b/ui', $trimmed)) {
        $dow = 2;
    } elseif (preg_match('/\b(?:viernes|vie)\b/ui', $trimmed)) {
        $dow = 5;
    } else {
        // Tratar como fecha (ISO 8601 o YYYY-MM-DD o con hora)
        try {
            $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
            $dt = new DateTimeImmutable($trimmed, $tz);
            $dow = (int) $dt->format('N'); // 1 = Monday .. 7 = Sunday
            if (($time === null || trim($time) === '') && preg_match('/[T\s](\d{1,2}:\d{2})/', $trimmed, $m)) {
                $time = $m[1];
            }
        } catch (Throwable) {
            $dow = null;
        }
    }

    if ($dow === null) {
        return 'indistinto';
    }

    // Miércoles y Jueves son 100% exclusivos de Norberto (María no atiende ningún turno)
    if ($dow === 3 || $dow === 4) {
        return 'norberto';
    }

    // Parsear la hora (formato HH:MM)
    $minutes = null;
    if ($time !== null && trim($time) !== '') {
        if (preg_match('/(\d{1,2}):(\d{2})/', trim($time), $tm)) {
            $h = (int) $tm[1];
            $m = (int) $tm[2];
            $minutes = $h * 60 + $m;
        }
    }

    // Si no hay hora especificada en Lunes, Martes o Viernes, no se puede deducir solo con el día
    if ($minutes === null) {
        return 'indistinto';
    }

    // Lunes (1): María 09:00 a 17:00 (540-1020 min) | Norberto 17:30 a 19:30 (1050-1170 min)
    if ($dow === 1) {
        if ($minutes >= 17 * 60 + 15) { // 17:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    // Martes (2): María 09:00 a 16:00 (540-960 min) | Norberto 16:30 a 19:30 (990-1170 min)
    if ($dow === 2) {
        if ($minutes >= 16 * 60 + 15) { // 16:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    // Viernes (5): María 09:00 a 13:00 (540-780 min) | Norberto 13:30 a 19:30 (810-1170 min)
    if ($dow === 5) {
        if ($minutes >= 13 * 60 + 15) { // 13:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    return 'indistinto';
}

/**
 * Resuelve y actualiza pacientes que tengan 'indistinto' comparando contra
 * los turnos registrados en Google Calendar y la tabla recordatorio_eventos.
 */
