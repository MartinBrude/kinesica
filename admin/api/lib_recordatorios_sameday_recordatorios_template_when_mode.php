<?php
declare(strict_types=1);


/**
 * Modo del parámetro {{3}} de la plantilla Meta recordatorio_turno_kinesica.
 * - legacy: plantilla dice "mañana a las {{3}}" → {{3}} = "16:00 hs" (catch-up WA no apto)
 * - when_phrase: plantilla dice "programada para {{3}}" → {{3}} = "hoy|mañana a las 16:00 hs"
 */
function recordatorios_template_when_mode(): string
{
    $c = function_exists('cfg') ? cfg() : [];
    // Default when_phrase: plantilla Meta ya usa {{3}} = frase completa (hoy|mañana a las …).
    $mode = strtolower(trim((string) ($c['reminder_template_when_mode'] ?? 'when_phrase')));
    return $mode === 'legacy' ? 'legacy' : 'when_phrase';
}


function recordatorios_clara_is_active(): bool
{
    try {
        $settings = kinesica_settings_load();
        if (array_key_exists('clara_active', $settings)) {
            return (bool) $settings['clara_active'];
        }
    } catch (Throwable) {
    }
    return true;
}


function recordatorios_sameday_indicaciones(): string
{
    $indicaciones = '';
    try {
        $settings = kinesica_settings_load();
        $texts = is_array($settings['clara_texts'] ?? null) ? $settings['clara_texts'] : $settings;
        $notes = is_array($texts) ? ($texts['reminder_notes'] ?? '') : '';
        if (is_string($notes) && trim($notes) !== '') {
            $indicaciones = trim($notes);
        }
    } catch (Throwable) {
    }
    if ($indicaciones === '') {
        $indicaciones = "📍 Te esperamos en Charcas 3889, 5º, B (Palermo).\n\n"
            . "⚠️ Te recordamos que el espacio no cuenta con secretaria, por lo que te pedimos puntualidad estricta "
            . "para evitar esperas en la entrada y no concurrir con acompañantes "
            . "(salvo menores de edad o personas que requieran asistencia directa).\n\n"
            . 'Si tenés estudios médicos previos, no olvides traerlos.';
    }
    return str_replace(['\\r\\n', '\\n', '\\r'], ["\n", "\n", "\n"], $indicaciones);
}


function recordatorios_sameday_first_name(string $patientName): string
{
    $clean = preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/i', '', trim($patientName)) ?? '';
    $parts = preg_split('/\s+/', $clean) ?: [];
    if (!empty($parts[0]) && mb_strlen($parts[0]) >= 2) {
        return $parts[0];
    }
    return $patientName !== '' ? $patientName : 'Estimado/a paciente';
}

/**
 * Extrae HH:MM desde appointment GAS (startIso o campos time).
 */

/**
 * Extrae HH:MM desde appointment GAS (startIso o campos time).
 */
function recordatorios_sameday_extract_hhmm(array $appt): string
{
    foreach (['time', 'startTime', 'hora'] as $k) {
        $raw = trim((string) ($appt[$k] ?? ''));
        if (preg_match('/(\d{1,2}):(\d{2})/', $raw, $m)) {
            return sprintf('%02d:%02d', (int) $m[1], (int) $m[2]);
        }
    }
    $iso = trim((string) ($appt['startIso'] ?? $appt['start'] ?? ''));
    if ($iso === '') {
        return '';
    }
    try {
        $dt = new DateTimeImmutable($iso);
        $dt = $dt->setTimezone(recordatorios_tz());
        // All-day / midnight-only: sin hora útil
        if ($dt->format('H:i') === '00:00') {
            return '';
        }
        return $dt->format('H:i');
    } catch (Throwable) {
        return '';
    }
}

/**
 * @return array{ok:bool,minutes?:int,reason?:string}
 */

/**
 * @return array{ok:bool,minutes?:int,reason?:string}
 */
function recordatorios_sameday_lead_ok(string $apptDate, string $hhmm, int $minLead = RECORDATORIOS_SAMEDAY_MIN_LEAD_MINUTES): array
{
    if ($apptDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $apptDate)) {
        return ['ok' => false, 'reason' => 'past_appointment'];
    }
    $timeStr = $hhmm !== '' ? ($hhmm . ':00') : '23:59:59';
    try {
        $tz = recordatorios_tz();
        $apptDt = new DateTimeImmutable($apptDate . ' ' . $timeStr, $tz);
        $now = new DateTimeImmutable('now', $tz);
        $diffMin = (int) floor(($apptDt->getTimestamp() - $now->getTimestamp()) / 60);
        if ($diffMin < 0) {
            return ['ok' => false, 'reason' => 'past_appointment', 'minutes' => $diffMin];
        }
        if ($diffMin < $minLead) {
            return ['ok' => false, 'reason' => 'too_soon', 'minutes' => $diffMin];
        }
        return ['ok' => true, 'minutes' => $diffMin];
    } catch (Throwable) {
        return ['ok' => false, 'reason' => 'other'];
    }
}

/**
 * Resuelve WhatsApp desde el appointment GAS + directorio.
 */

/**
 * Resuelve WhatsApp desde el appointment GAS + directorio.
 */
function recordatorios_sameday_resolve_phone(array $appt): string
{
    $phone = clean_phone_number((string) ($appt['phone'] ?? ''));
    if ($phone !== '' && !is_placeholder_phone($phone)) {
        return $phone;
    }
    $title = trim((string) ($appt['title'] ?? ''));
    $name = trim((string) ($appt['patientName'] ?? $title));
    $description = (string) ($appt['description'] ?? '');
    $parsed = kinesica_extract_calendar_contacts($title . ' ' . $name, $description);
    if ($parsed['phone'] !== '') {
        return $parsed['phone'];
    }
    try {
        $pdo = recordatorios_pdo();
        $map = recordatorios_lookup_directory_contacts($pdo, [
            ['wa_id' => '', 'patient_name' => $name],
        ]);
        $nameKey = mb_strtolower(trim($name));
        if ($nameKey !== '' && isset($map['by_name'][$nameKey])) {
            // by_name maps to email in lookup; try pacientes by name for phone
        }
        $stmt = $pdo->prepare(
            'SELECT telefono FROM pacientes
             WHERE LOWER(nombre_completo) = LOWER(:n)
                OR LOWER(CONCAT(TRIM(nombre), \' \', TRIM(apellido))) = LOWER(:n2)
             LIMIT 1'
        );
        $stmt->execute(['n' => $name, 'n2' => $name]);
        $tel = clean_phone_number((string) ($stmt->fetchColumn() ?: ''));
        if ($tel !== '') {
            return $tel;
        }
    } catch (Throwable) {
    }
    return '';
}


function recordatorios_sameday_resolve_email(string $phone, string $patientName, array $appt): string
{
    $email = trim((string) ($appt['email'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return strtolower($email);
    }
    $fromDir = recordatorios_resolve_contact_email($phone, $patientName);
    if ($fromDir !== '') {
        return $fromDir;
    }
    try {
        $pdo = recordatorios_pdo();
        $stmt = $pdo->prepare(
            'SELECT email FROM pacientes
             WHERE (telefono != \'\' AND RIGHT(REPLACE(telefono, \'+\', \'\'), 10) = :p)
                OR LOWER(nombre_completo) = LOWER(:n)
             LIMIT 1'
        );
        $phoneEnd = substr(recordatorios_clean_wa_id($phone), -10);
        $stmt->execute(['p' => $phoneEnd, 'n' => $patientName]);
        $em = strtolower(trim((string) ($stmt->fetchColumn() ?: '')));
        if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL)) {
            return $em;
        }
    } catch (Throwable) {
    }
    return '';
}

/**
 * @return array{status:string,skip_reason:string,channel?:string,error?:string,patient?:string}
 */
