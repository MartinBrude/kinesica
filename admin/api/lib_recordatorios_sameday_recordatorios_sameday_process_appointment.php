<?php
declare(strict_types=1);


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
