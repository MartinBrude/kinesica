<?php
declare(strict_types=1);

/**
 * Catch-up de recordatorios el mismo día del turno.
 * Solo envía si aún no hubo sent/sent_email para ese calendar_event_id.
 */

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/campana_turnos.php';
require_once __DIR__ . '/lib_whatsapp_template.php';
require_once __DIR__ . '/lib_mail.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

/** Margen mínimo (minutos) entre ahora y el inicio del turno para enviar catch-up. */
const RECORDATORIOS_SAMEDAY_MIN_LEAD_MINUTES = 60;

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
function recordatorios_sameday_process_appointment(array $appt, string $today, string $execId): array
{
    $title = trim((string) ($appt['title'] ?? ''));
    $patientName = trim((string) ($appt['patientName'] ?? ''));
    if ($patientName === '') {
        $patientName = $title;
    }
    $calId = trim((string) ($appt['eventId'] ?? $appt['calendar_event_id'] ?? ''));

    if ($patientName === '' || is_tk3_or_blocked_name($patientName) || is_tk3_or_blocked_name($title)) {
        return ['status' => 'skipped', 'skip_reason' => 'blocked', 'patient' => $patientName];
    }
    $lower = mb_strtolower($title . ' ' . $patientName);
    if (str_contains($lower, 'cancelado') || str_contains($lower, 'anulado')) {
        return ['status' => 'skipped', 'skip_reason' => 'cancelled', 'patient' => $patientName];
    }
    if ($calId === '') {
        return ['status' => 'skipped', 'skip_reason' => 'non_appointment', 'patient' => $patientName];
    }
    if (recordatorios_was_sent_for_event($calId)) {
        return ['status' => 'skipped', 'skip_reason' => 'already_sent', 'patient' => $patientName];
    }

    $apptDate = trim((string) ($appt['date'] ?? $today));
    if ($apptDate !== $today) {
        return ['status' => 'skipped', 'skip_reason' => 'not_tomorrow', 'patient' => $patientName];
    }

    $hhmm = recordatorios_sameday_extract_hhmm($appt);
    $lead = recordatorios_sameday_lead_ok($apptDate, $hhmm);
    if (!$lead['ok']) {
        return [
            'status' => 'skipped',
            'skip_reason' => (string) ($lead['reason'] ?? 'other'),
            'patient' => $patientName,
        ];
    }

    $phone = recordatorios_sameday_resolve_phone($appt);
    $email = recordatorios_sameday_resolve_email($phone, $patientName, $appt);
    $timeLabel = $hhmm !== '' ? ($hhmm . ' hs') : 'horario convenido';
    $whenPhrase = 'hoy a las ' . $timeLabel;
    $firstName = recordatorios_sameday_first_name($patientName);
    $indicaciones = recordatorios_sameday_indicaciones();
    $tipoCita = 'sesión en el consultorio';
    if (preg_match('/llamad/i', $title . ' ' . $patientName)) {
        $tipoCita = 'llamada';
    }

    $runAt = time();
    $baseEv = [
        'calendar_event_id' => $calId,
        'patient_name' => $patientName,
        'wa_id' => $phone,
        'appointment_date' => $apptDate,
        'appointment_time' => $hhmm !== '' ? $hhmm : $timeLabel,
        'event_summary' => $title !== '' ? $title : $patientName,
        'event_description' => (string) ($appt['description'] ?? ''),
        'skip_reason' => 'same_day_catchup',
        'error_code' => '',
        'error_message' => '',
        'dni' => '',
    ];

    if ($phone === '' && $email === '') {
        $norm = recordatorios_normalize_item(array_merge($baseEv, [
            'status' => 'missing_phone',
            'skip_reason' => 'same_day_catchup',
        ]), $execId, $runAt);
        if ($norm) {
            recordatorios_store_items([$norm]);
        }
        return ['status' => 'missing_phone', 'skip_reason' => 'same_day_catchup', 'patient' => $patientName];
    }

    $whenMode = recordatorios_template_when_mode();
    $waParam = $whenMode === 'when_phrase' ? $whenPhrase : $timeLabel;
    $canWhatsapp = $phone !== '' && $whenMode === 'when_phrase';

    // En modo legacy la plantilla Meta dice "mañana a las {{3}}": no enviar WA same-day.
    if ($canWhatsapp) {
        $waRes = send_whatsapp_reminder_template($phone, [
            'patient_name' => $firstName,
            'tipo_cita' => $tipoCita,
            'formatted_time' => $waParam,
            'indicaciones' => $indicaciones,
            'event_id' => $calId,
        ]);
        if (!empty($waRes['ok'])) {
            $norm = recordatorios_normalize_item(array_merge($baseEv, [
                'status' => 'sent',
                'skip_reason' => 'same_day_catchup',
                'error_message' => 'Catch-up same-day (WhatsApp)',
            ]), $execId, $runAt);
            if ($norm) {
                recordatorios_store_items([$norm]);
            }
            return ['status' => 'sent', 'skip_reason' => 'same_day_catchup', 'channel' => 'whatsapp', 'patient' => $patientName];
        }
        $waErr = (string) ($waRes['error'] ?? 'WA failed');
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if (recordatorios_sameday_send_email($email, $firstName, $tipoCita, $whenPhrase, $indicaciones)) {
                $norm = recordatorios_normalize_item(array_merge($baseEv, [
                    'status' => 'sent_email',
                    'skip_reason' => 'same_day_catchup',
                    'error_code' => 'wa_failed_email_ok',
                    'error_message' => substr($email . ' | WA: ' . $waErr, 0, 500),
                ]), $execId, $runAt);
                if ($norm) {
                    recordatorios_store_items([$norm]);
                }
                return ['status' => 'sent_email', 'skip_reason' => 'same_day_catchup', 'channel' => 'email', 'patient' => $patientName];
            }
        }
        $norm = recordatorios_normalize_item(array_merge($baseEv, [
            'status' => 'failed',
            'skip_reason' => 'same_day_catchup',
            'error_message' => substr($waErr, 0, 500),
        ]), $execId, $runAt);
        if ($norm) {
            recordatorios_store_items([$norm]);
        }
        return ['status' => 'failed', 'skip_reason' => 'same_day_catchup', 'error' => $waErr, 'patient' => $patientName];
    }

    // Legacy Meta o sin teléfono: email (copy correcto "hoy").
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        if (recordatorios_sameday_send_email($email, $firstName, $tipoCita, $whenPhrase, $indicaciones)) {
            $norm = recordatorios_normalize_item(array_merge($baseEv, [
                'status' => 'sent_email',
                'skip_reason' => 'same_day_catchup',
                'error_message' => $email . ' (Catch-up same-day email'
                    . ($whenMode === 'legacy' ? '; WA diferido hasta when_phrase Meta' : '')
                    . ')',
            ]), $execId, $runAt);
            if ($norm) {
                recordatorios_store_items([$norm]);
            }
            return ['status' => 'sent_email', 'skip_reason' => 'same_day_catchup', 'channel' => 'email', 'patient' => $patientName];
        }
        $norm = recordatorios_normalize_item(array_merge($baseEv, [
            'status' => 'failed',
            'skip_reason' => 'same_day_catchup',
            'error_message' => 'Email falló a ' . $email,
        ]), $execId, $runAt);
        if ($norm) {
            recordatorios_store_items([$norm]);
        }
        return ['status' => 'failed', 'skip_reason' => 'same_day_catchup', 'error' => 'email_failed', 'patient' => $patientName];
    }

    $norm = recordatorios_normalize_item(array_merge($baseEv, [
        'status' => 'missing_phone',
        'skip_reason' => 'same_day_catchup',
        'error_message' => 'Sin email y WA same-day deshabilitado (reminder_template_when_mode=legacy)',
    ]), $execId, $runAt);
    if ($norm) {
        recordatorios_store_items([$norm]);
    }
    return ['status' => 'missing_phone', 'skip_reason' => 'same_day_catchup', 'patient' => $patientName];
}

function recordatorios_sameday_send_email(
    string $email,
    string $firstName,
    string $tipoCita,
    string $whenPhrase,
    string $indicaciones
): bool {
    $subject = 'Recordatorio de turno — Kinésica';
    $html = '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">'
        . '<h2 style="color:#0b2545;">Recordatorio de turno — Kinésica</h2>'
        . '<p>¡Hola <strong>' . htmlspecialchars($firstName) . '</strong>! Te escribimos para recordarte tu turno:</p>'
        . '<ul>'
        . '<li><strong>Tipo:</strong> ' . htmlspecialchars($tipoCita) . '</li>'
        . '<li><strong>Cuándo:</strong> ' . htmlspecialchars($whenPhrase) . '</li>'
        . '<li><strong>Ubicación:</strong> Charcas 3889, 5º, B (Palermo)</li>'
        . '</ul>'
        . '<p>' . nl2br(htmlspecialchars($indicaciones)) . '</p>'
        . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.</p>'
        . '</div>';
    $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} — {$whenPhrase}.\n{$indicaciones}\nKinésica";
    return send_html_mail($email, $subject, $html, $text);
}

/**
 * @return array{ok:bool,dry?:bool,processed:int,sent:int,sent_email:int,skipped:int,failed:int,missing_phone:int,error?:string,details?:list}
 */
function recordatorios_sameday_run(bool $dry = false): array
{
    $out = [
        'ok' => true,
        'dry' => $dry,
        'processed' => 0,
        'sent' => 0,
        'sent_email' => 0,
        'skipped' => 0,
        'failed' => 0,
        'missing_phone' => 0,
        'details' => [],
    ];

    if (!recordatorios_clara_is_active()) {
        $out['ok'] = true;
        $out['error'] = 'clara_inactive';
        return $out;
    }

    $tz = recordatorios_tz();
    $today = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
    $gas = campana_fetch_appointments_from_gas($today, $today);
    if (empty($gas['ok'])) {
        return [
            'ok' => false,
            'processed' => 0,
            'sent' => 0,
            'sent_email' => 0,
            'skipped' => 0,
            'failed' => 0,
            'missing_phone' => 0,
            'error' => (string) ($gas['error'] ?? 'GAS list_appointments falló'),
        ];
    }

    $execId = 'sameday-' . (new DateTimeImmutable('now', $tz))->format('Ymd-Hi');
    $appointments = $gas['appointments'] ?? [];
    if (!is_array($appointments)) {
        $appointments = [];
    }

    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $out['processed']++;
        if ($dry) {
            $name = trim((string) ($appt['patientName'] ?? $appt['title'] ?? ''));
            $cal = trim((string) ($appt['eventId'] ?? ''));
            $hhmm = recordatorios_sameday_extract_hhmm($appt);
            $already = $cal !== '' && recordatorios_was_sent_for_event($cal);
            $lead = recordatorios_sameday_lead_ok($today, $hhmm);
            $out['details'][] = [
                'patient' => $name,
                'cal' => $cal,
                'time' => $hhmm,
                'already_sent' => $already,
                'lead_ok' => $lead['ok'],
                'lead_reason' => $lead['reason'] ?? null,
            ];
            if ($already || empty($lead['ok'])) {
                $out['skipped']++;
            }
            continue;
        }
        $res = recordatorios_sameday_process_appointment($appt, $today, $execId);
        $st = (string) ($res['status'] ?? 'skipped');
        if (isset($out[$st])) {
            $out[$st]++;
        } elseif ($st === 'skipped') {
            $out['skipped']++;
        } else {
            $out['skipped']++;
        }
        $out['details'][] = $res;
    }

    return $out;
}
