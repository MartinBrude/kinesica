<?php
declare(strict_types=1);


/**
 * API recordatorios — envío manual.
 */
function recordatorios_dispatch_manual(int $id, array $input, array $auth): array
{
    $item = recordatorios_find_item_by_id($id);
    if (!$item) {
        return [
            'ok' => false,
            'error' => 'Registro de recordatorio no encontrado',
            'error_category' => 'user_input',
            'error_code' => 'RECORDATORIO_NOT_FOUND',
            'hint' => 'El turno puede haber sido eliminado o refrescado. Actualizá la vista de recordatorios.',
        ];
    }

    $rawPhone = trim((string) ($input['wa_id'] ?? $input['phone'] ?? $item['wa_id'] ?? ''));
    $phone = recordatorios_normalize_phone_input($rawPhone);

    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email === '') {
        $email = recordatorios_extract_contact_email((string) ($item['error_message'] ?? ''));
    }
    if ($email === '' && $item['status'] === 'sent_email') {
        $email = strtolower(trim((string) $item['error_message']));
    }
    if ($email === '' && $phone !== '') {
        try {
            $pdo = recordatorios_pdo();
            require_once __DIR__ . '/pacientes_helpers_email_by_phone.php';
            $look = kinesica_pacientes_email_by_phone($pdo, $phone);
            if (($look['status'] ?? '') === 'success' && !empty($look['email'])) {
                $email = strtolower(trim((string) $look['email']));
            }
        } catch (Throwable $e) {
            error_log('kinesica recordatorios dispatch: email_by_phone: ' . $e->getMessage());
        }
    }
    // Fallback por nombre exacto (nunca LIKE %nombre% — evita email de otro paciente).
    if ($email === '' && !empty($item['patient_name'])) {
        try {
            $pdo = recordatorios_pdo();
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            $alive = kinesica_pacientes_alive_sql($pdo);
            $full = trim((string) $item['patient_name']);
            $stmt = $pdo->prepare(
                "SELECT email FROM pacientes
                 WHERE ({$alive}) AND email IS NOT NULL AND email != ''
                   AND LOWER(nombre_completo) = LOWER(:full)
                 LIMIT 1"
            );
            $stmt->execute(['full' => $full]);
            $foundEmail = $stmt->fetchColumn();
            if ($foundEmail) {
                $email = strtolower(trim((string) $foundEmail));
            }
        } catch (Throwable $e) {
            error_log('kinesica recordatorios dispatch: email_by_name: ' . $e->getMessage());
        }
    }

    // Persistir contacto cargado en el modal para próximas corridas / directorio.
    // Los casos de prueba (test:…) no escriben en el directorio de pacientes.
    $saveContact = !isset($input['save_contact']) || !empty($input['save_contact']);
    if ($saveContact && !recordatorios_is_test_case($item) && ($phone !== '' || $email !== '')) {
        $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: ''));
        recordatorios_persist_directory_contact($patientName, $phone, $email);
    }

    $channel = strtolower(trim((string) ($input['channel'] ?? 'auto')));
    if (!in_array($channel, ['auto', 'whatsapp', 'email'], true)) {
        $channel = 'auto';
    }

    $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: 'Estimado/a paciente'));
    $apptTime = trim((string) ($item['appointment_time'] ?? ''));
    $apptDate = trim((string) ($item['appointment_date'] ?? ''));
    $summary = trim((string) ($item['event_summary'] ?? ''));
    $user = (string) ($auth['username'] ?? $auth['name'] ?? 'admin');

    $isCall = stripos($summary, 'llamada') !== false;
    $tipoCita = $isCall ? 'llamada de orientación de 10 minutos' : 'sesión en el consultorio';

    // Mismas indicaciones que n8n/admin (clara_texts.reminder_notes).
    $indicaciones = '';
    try {
        require_once __DIR__ . '/kinesica_settings_storage.php';
        $settings = kinesica_settings_load();
        $texts = is_array($settings['clara_texts'] ?? null) ? $settings['clara_texts'] : $settings;
        $notes = is_array($texts) ? ($texts['reminder_notes'] ?? '') : '';
        if (is_string($notes) && trim($notes) !== '') {
            $indicaciones = trim($notes);
        }
    } catch (Throwable $e) {
        error_log('kinesica recordatorios dispatch: reminder_notes: ' . $e->getMessage());
    }
    if ($indicaciones === '') {
        $indicaciones = $isCall
            ? '📞 Norberto se comunicará con vos puntualmente a este número de WhatsApp.'
            : "📍 Te esperamos en Charcas 3889, 5º, B (Palermo).\n\n⚠️ Te recordamos que el espacio no cuenta con secretaria, por lo que te pedimos puntualidad estricta para evitar esperas en la entrada y no concurrir con acompañantes (salvo menores de edad o personas que requieran asistencia directa).\n\nSi tenés estudios médicos previos, no olvides traerlos.";
    }
    // Por si llega desde settings/DB con "\n" escapado como texto.
    $indicaciones = str_replace(['\\r\\n', '\\n', '\\r'], ["\n", "\n", "\n"], $indicaciones);

    $firstName = $patientName;
    $clean = preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/i', '', $patientName);
    $parts = preg_split('/\s+/', trim((string) $clean));
    if (!empty($parts[0]) && mb_strlen($parts[0]) >= 2) {
        $firstName = $parts[0];
    }

    $isTestCase = recordatorios_is_test_case($item);
    // Pruebas manuales: WhatsApp es el canal; no enmascarar fallos con email.
    if ($isTestCase && $channel === 'auto') {
        $channel = 'whatsapp';
    }

    $formattedTime = $apptTime !== '' ? $apptTime : 'horario convenido';
    if ($apptTime !== '' && !preg_match('/\bhs\b/i', $apptTime)) {
        $formattedTime = $apptTime . ' hs';
    }
    $whenPhrase = function_exists('recordatorios_format_when_phrase')
        ? recordatorios_format_when_phrase($apptDate, $formattedTime)
        : ('mañana a las ' . $formattedTime);

    // Regla: No tiene sentido enviar recordatorio si el turno ya pasó
    // (los casos de prueba usan turno de mañana; se permiten reintentos).
    if (
        !$isTestCase
        && function_exists('recordatorios_is_appointment_past')
        && recordatorios_is_appointment_past($apptDate, $apptTime)
    ) {
        return [
            'ok' => false,
            'error' => 'El horario del turno ya pasó. No se puede enviar un recordatorio.',
            'error_category' => 'user_input',
            'error_code' => 'APPOINTMENT_ALREADY_PAST',
            'hint' => 'Solo se pueden enviar recordatorios para turnos futuros.',
        ];
    }

    // Deduplicación diaria: no aplica a casos de prueba (test:…) para poder reintentar a mano.
    if (!$isTestCase) {
        try {
            $pdo = recordatorios_pdo();
            $cleanPhoneEnd = $phone !== '' ? substr(recordatorios_clean_wa_id($phone), -10) : '';
            $pName = trim((string) ($item['patient_name'] ?? ''));
            // La regla de un envío diario usa el día local de la clínica (Buenos Aires),
            // aunque received_at se persista en UTC.
            $localTz = recordatorios_tz();
            $localDayStart = new DateTimeImmutable('now', $localTz)
                ->setTime(0, 0, 0)
                ->setTimezone(new DateTimeZone('UTC'));
            $localDayEnd = $localDayStart->modify('+1 day');

            $conds = [];
            $chkParams = [
                'id' => $id,
                'day_start' => $localDayStart->format('Y-m-d H:i:s'),
                'day_end' => $localDayEnd->format('Y-m-d H:i:s'),
            ];
            if ($cleanPhoneEnd !== '') {
                $conds[] = 'RIGHT(wa_id, 10) = :phone_end';
                $chkParams['phone_end'] = $cleanPhoneEnd;
            }
            if ($email !== '') {
                $conds[] = 'LOWER(error_message) LIKE :email_match';
                $chkParams['email_match'] = '%' . $email . '%';
            }
            if ($pName !== '' && $pName !== 'Estimado/a paciente') {
                $conds[] = 'LOWER(patient_name) = LOWER(:pname)';
                $chkParams['pname'] = $pName;
            }

            if (!empty($conds)) {
                $chkSql = 'SELECT id, status, appointment_time, received_at FROM recordatorio_eventos
                    WHERE id != :id
                      AND status IN ("sent", "sent_email")
                      AND received_at >= :day_start
                      AND received_at < :day_end
                      AND calendar_event_id NOT LIKE \'test:%\'
                      AND (' . implode(' OR ', $conds) . ')
                    LIMIT 1';
                $stmt = $pdo->prepare($chkSql);
                $stmt->execute($chkParams);
                $alreadySent = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($alreadySent) {
                    return [
                        'ok' => false,
                        'error' => 'Ya se envió un recordatorio hoy a este paciente (' . ($alreadySent['status'] === 'sent' ? 'WhatsApp' : 'Email') . '). Máximo 1 envío por día.',
                        'error_category' => 'user_input',
                        'error_code' => 'ALREADY_SENT_TODAY',
                        'hint' => 'Para evitar molestias al paciente, el sistema limita los recordatorios a 1 por día.',
                    ];
                }
            }
        } catch (Throwable $e) {
            error_log('kinesica recordatorios dispatch: daily dedup failed: ' . $e->getMessage());
            // Fail closed: sin dedup confiable no enviar (evita doble aviso).
            return [
                'ok' => false,
                'error' => 'No se pudo verificar envíos previos en la base de datos.',
                'error_category' => 'infrastructure',
                'error_code' => 'DEDUP_DB_CHECK_FAILED',
                'hint' => 'Por seguridad y para evitar duplicados, el envío se pausó. Reintentá en unos segundos.',
            ];
        }
    }

    // TC-50: no disparar si el turno ya no está vivo en Calendar (salvo casos de prueba).
    if (!$isTestCase) {
        $calId = trim((string) ($item['calendar_event_id'] ?? ''));
        $alive = recordatorios_calendar_event_is_sendable($calId);
        if (empty($alive['ok'])) {
            $reason = (string) ($alive['reason'] ?? 'calendar_unverified');
            $msg = match ($reason) {
                'event_gone' => 'El turno ya no está en Google Calendar (fue eliminado). No se envía el recordatorio.',
                'cancelled' => 'El turno figura cancelado/anulado en Google Calendar. No se envía el recordatorio.',
                'missing_event_id' => 'Este registro no tiene calendar_event_id. No se puede verificar el turno.',
                default => 'No se pudo verificar el turno en Google Calendar. Reintentá en unos minutos.',
            };
            return [
                'ok' => false,
                'error' => $msg,
                'error_category' => 'external_service',
                'error_code' => 'CALENDAR_CHECK_FAILED',
                'skip_reason' => $reason,
                'hint' => 'Verificá el estado del turno en Google Calendar o actualizá la lista.',
            ];
        }
    }

    // Claim atómico: evita doble WhatsApp/email por doble clic o dos pestañas.
    $claimed = recordatorios_claim_manual_send($id);
    if (empty($claimed['ok'])) {
        return [
            'ok' => false,
            'error' => (string) ($claimed['error'] ?? 'No se pudo reservar el envío'),
            'error_category' => 'infrastructure',
            'error_code' => 'DISPATCH_CLAIM_LOCKED',
            'hint' => 'Hay otro envío en curso para este turno o se detectó doble clic. Aguardá unos segundos.',
        ];
    }
    $item = $claimed['item'] ?? $item;
    $claimToken = (string) ($claimed['claim'] ?? '');

    $result = recordatorios_dispatch_manual_deliver(
        $id, $input, $auth, $item, $phone, $email, $channel, $patientName, $apptTime, $apptDate, $summary, $user,
        $isCall, $tipoCita, $indicaciones, $firstName, $isTestCase, $whenPhrase
    );

    if (empty($result['ok']) && $claimToken !== '') {
        $prevStatus = (string) ($item['status'] ?? 'pending');
        if (!in_array($prevStatus, ['pending', 'missing_phone', 'failed', 'skipped', 'run_skipped'], true)) {
            $prevStatus = 'pending';
        }
        recordatorios_release_manual_claim($id, $claimToken, $prevStatus);
    }

    return $result;
}

/**
 * Entrega manual: email y/o WhatsApp.
 */
