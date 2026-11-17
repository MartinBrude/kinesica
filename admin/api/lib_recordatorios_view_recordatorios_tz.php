<?php
declare(strict_types=1);


function recordatorios_tz(): DateTimeZone
{
    try {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    } catch (Throwable $e) {
        return new DateTimeZone('UTC');
    }
}


function recordatorios_status_label(string $status): string
{
    return match ($status) {
        'pending' => 'A enviar',
        'sent' => 'Enviado (WhatsApp)',
        'sent_email' => 'Enviado (email)',
        'failed' => 'Fallido',
        'missing_phone' => 'Sin teléfono ni mail',
        'skipped' => 'Omitido',
        'run_skipped' => 'Ejecución omitida',
        default => $status,
    };
}


function recordatorios_skip_label(string $reason): string
{
    return match ($reason) {
        'clara_inactive' => 'Clara pausada',
        'cancelled' => 'Cancelado / anulado',
        'blocked' => 'Bloqueo / no disponible',
        'waitlist' => 'Lista de espera',
        'non_appointment' => 'No es un turno',
        'duplicate' => 'Duplicado en la ejecución',
        'not_tomorrow' => 'Fuera de mañana',
        'already_sent' => 'Ya enviado para este turno',
        'too_soon' => 'Menos de 60 min al turno',
        'past_appointment' => 'Turno ya pasado',
        'same_day_catchup' => 'Catch-up mismo día',
        'other' => 'Otro',
        '' => '',
        default => $reason,
    };
}


function recordatorios_is_blocked_event(array $r): bool
{
    $reason = strtolower(trim((string) ($r['skip_reason'] ?? '')));
    if ($reason === 'blocked') {
        return true;
    }
    $name = (string) ($r['patient_name'] ?? '');
    $summary = (string) ($r['event_summary'] ?? '');
    if (function_exists('is_tk3_or_blocked_name')) {
        if (is_tk3_or_blocked_name($name) || is_tk3_or_blocked_name($summary)) {
            return true;
        }
    }
    $nameLower = mb_strtolower(trim($name));
    $summaryLower = mb_strtolower(trim($summary));
    foreach (['no dar', 'bloqueado', 'bloqueo', 'tk3', 'tk 3'] as $kw) {
        if (str_contains($nameLower, $kw) || str_contains($summaryLower, $kw)) {
            return true;
        }
    }
    return false;
}


function recordatorios_extract_phone_candidate(string $text): string
{
    $t = trim($text);
    if ($t === '') {
        return '';
    }

    // Preferir clave:valor (telefono/teléfono/whatsapp/…) sin llamar extract_contacts (evita recursión).
    if (function_exists('kinesica_parse_calendar_kv_map')) {
        $map = kinesica_parse_calendar_kv_map($t);
        foreach (['telefono', 'whatsapp', 'wa', 'tel', 'celular', 'movil', 'phone'] as $k) {
            if (!empty($map[$k])) {
                $fromKv = clean_phone_number((string) $map[$k]);
                if ($fromKv !== '' && (!function_exists('is_placeholder_phone') || !is_placeholder_phone($fromKv))) {
                    // Rechazar si el valor de telefono: es en realidad el DNI del mismo texto.
                    $dniFromMap = '';
                    foreach (['dni', 'documento', 'doc', 'pasaporte', 'document', 'passport', 'ci', 'du'] as $dk) {
                        if ($dniFromMap === '' && !empty($map[$dk]) && function_exists('clean_patient_dni')) {
                            $dniFromMap = clean_patient_dni((string) $map[$dk]);
                        }
                    }
                    if ($dniFromMap !== '' && function_exists('kinesica_phone_looks_like_dni')
                        && kinesica_phone_looks_like_dni($fromKv, $dniFromMap)) {
                        // Seguir buscando otro candidato.
                    } else {
                        return $fromKv;
                    }
                }
            }
        }
    }

    if (preg_match('/(?:(?:whatsapp|wa\.me|tel|cel|telefono|tel[eé]fono|celular|movil)[:\s\/]*)+([+]?[-0-9\s()]{8,22})/iu', $t, $m)) {
        $digits = preg_replace('/\D+/', '', $m[1]);
        if (strlen($digits) >= 8 && strlen($digits) <= 15) {
            return clean_phone_number($m[1]);
        }
    }

    // Descartar menciones de documento para que sus dígitos no se confundan con un teléfono
    // (alineado con extractPhoneCandidate en phone-format.js).
    $withoutDni = preg_replace(
        '/(?:dni|doc(?:umento)?|c\.?i\.?|d\.?u\.?|pasaporte|passport)[:\s.#]*[\d.\-]+/iu',
        ' ',
        $t
    ) ?? $t;

    if (preg_match('/\+\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/', $withoutDni, $m)) {
        return clean_phone_number($m[0]);
    }

    if (preg_match('/(?:\+?54\s*9?\s*)?(?:\b0?11\b|\b15\b)?[-.\s]?\d{4}[-.\s]?\d{4}\b/', $withoutDni, $m)) {
        $cleaned = clean_phone_number($m[0]);
        if (strlen($cleaned) >= 8) {
            return $cleaned;
        }
    }

    // Bloque continuo con prefijo móvil verosímil (no 7–8 dígitos sueltos típicos de DNI).
    if (preg_match('/\b(?:11|15|549)\d{8,10}\b/', $withoutDni, $m)) {
        return clean_phone_number($m[0]);
    }

    if (preg_match('/\b\d{10,13}\b/', $withoutDni, $m)) {
        return clean_phone_number($m[0]);
    }

    return '';
}

/**
 * Formatea una fila de recordatorio_eventos para la SPA.
 *
 * @param array<string,mixed> $r
 * @return array<string,mixed>
 */

/**
 * Formatea una fila de recordatorio_eventos para la SPA.
 *
 * @param array<string,mixed> $r
 * @return array<string,mixed>
 */
function recordatorios_format_item(array $r, ?string $email = null): array
{
    $status = (string) ($r['status'] ?? '');
    $runUtc = (string) ($r['run_at'] ?? '');
    $runDay = '';
    $runLocal = $runUtc;
    try {
        $dt = new DateTimeImmutable($runUtc . ' UTC');
        $local = $dt->setTimezone(recordatorios_tz());
        $runDay = $local->format('Y-m-d');
        $runLocal = $local->format('Y-m-d H:i');
    } catch (Throwable $e) {
        $runDay = substr($runUtc, 0, 10);
    }

    $resolvedEmail = $email;
    if ($resolvedEmail === null || $resolvedEmail === '') {
        $resolvedEmail = recordatorios_extract_contact_email((string) ($r['error_message'] ?? ''));
    }

    $waId = (string) ($r['wa_id'] ?? '');
    if ($waId === '') {
        $contact = kinesica_extract_calendar_contacts(
            trim((string) ($r['patient_name'] ?? '') . ' ' . (string) ($r['event_summary'] ?? '')),
            (string) ($r['event_description'] ?? $r['description'] ?? '')
        );
        if ($contact['phone'] !== '') {
            $waId = $contact['phone'];
        } else {
            $candidate = recordatorios_extract_phone_candidate((string) ($r['event_summary'] ?? ''));
            if ($candidate === '') {
                $candidate = recordatorios_extract_phone_candidate((string) ($r['patient_name'] ?? ''));
            }
            if ($candidate !== '') {
                $waId = $candidate;
            }
        }
    }

    return [
        'id' => (string) ($r['id'] ?? ''),
        'event_key' => (string) ($r['event_key'] ?? ''),
        'exec_id' => (string) ($r['exec_id'] ?? ''),
        'run_at' => $runUtc,
        'run_at_local' => $runLocal,
        'run_day' => $runDay,
        'appointment_date' => isset($r['appointment_date']) && $r['appointment_date'] !== null ? (string) $r['appointment_date'] : '',
        'appointment_time' => (string) ($r['appointment_time'] ?? ''),
        'calendar_event_id' => (string) ($r['calendar_event_id'] ?? ''),
        'patient_name' => (string) ($r['patient_name'] ?? ''),
        'wa_id' => $waId,
        'email' => (string) ($resolvedEmail ?? ''),
        'status' => $status,
        'status_label' => recordatorios_status_label($status),
        'skip_reason' => (string) ($r['skip_reason'] ?? ''),
        'skip_reason_label' => recordatorios_skip_label((string) ($r['skip_reason'] ?? '')),
        'error_code' => (string) ($r['error_code'] ?? ''),
        'error_message' => (string) ($r['error_message'] ?? ''),
        'event_summary' => (string) ($r['event_summary'] ?? ''),
        'event_description' => (string) ($r['event_description'] ?? $r['description'] ?? ''),
        'dni' => (string) ($r['dni'] ?? ''),
        'is_past' => recordatorios_is_appointment_past(isset($r['appointment_date']) ? (string) $r['appointment_date'] : null, (string) ($r['appointment_time'] ?? '')),
    ];
}

/**
 * Formatea fecha en español de forma amigable (ej: "miércoles 18 de noviembre").
 */
function recordatorios_format_friendly_date(string $dateStr): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr, $m)) {
        return $dateStr;
    }
    $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $ts = strtotime($dateStr . ' 12:00:00 UTC');
    if ($ts === false) return $dateStr;
    $w = (int) gmdate('w', $ts);
    $d = (int) $m[3];
    $mo = (int) $m[2];
    return trim(($dias[$w] ?? '') . ' ' . $d . ' de ' . ($meses[$mo] ?? ''));
}

/**
 * Genera la frase completa para el recordatorio (parámetro {{3}} de WhatsApp y cuándo de Email).
 * Ejemplos:
 *   - "mañana miércoles 18 de noviembre a las 16:00 hs"
 *   - "hoy martes 17 de noviembre a las 16:00 hs"
 *   - "el jueves 19 de noviembre a las 10:30 hs"
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

    $tz = recordatorios_tz();
    $now = new DateTimeImmutable('now', $tz);
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

