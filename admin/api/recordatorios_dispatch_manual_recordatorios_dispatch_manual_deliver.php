<?php
declare(strict_types=1);


/**
 * Entrega manual: email y/o WhatsApp.
 */
function recordatorios_dispatch_manual_deliver(
    int $id, array $input, array $auth, array $item, string $phone, string $email, string $channel,
    string $patientName, string $apptTime, string $apptDate, string $summary, string $user,
    bool $isCall, string $tipoCita, string $indicaciones, string $firstName, bool $isTestCase, string $formattedTime
): array {
    if ($channel === 'email' || ($channel === 'auto' && $phone === '' && $email !== '')) {
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Email no válido para el envío'];
        }

        $subject = 'Recordatorio de turno — Kinésica';
        $when = trim($apptDate . ' ' . $apptTime);
        $html = '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">'
            . '<h2 style="color:#0b2545;">Recordatorio de turno — Kinésica</h2>'
            . '<p>¡Hola <strong>' . htmlspecialchars($firstName) . '</strong>! Te escribimos para recordarte tu turno:</p>'
            . '<ul>'
            . '<li><strong>Tipo:</strong> ' . htmlspecialchars($tipoCita) . '</li>'
            . '<li><strong>Horario:</strong> ' . htmlspecialchars($when !== '' ? $when : $apptTime) . '</li>'
            . ($isCall ? '<li><strong>Modalidad:</strong> Llamada por WhatsApp</li>' : '<li><strong>Ubicación:</strong> Charcas 3889, 5º, B (Palermo)</li>')
            . '</ul>'
            . '<p>' . nl2br(htmlspecialchars($indicaciones)) . '</p>'
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.</p>'
            . '</div>';
        $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} - {$when}.\n{$indicaciones}\nKinésica";

        $mailSent = send_html_mail($email, $subject, $html, $text);
        if ($mailSent) {
            $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent_email:' . time();
            recordatorios_update_outcome($id, [
                'status' => 'sent_email',
                'error_code' => '',
                'error_message' => $email . ' (Manual por ' . $user . ')',
                'run_at' => gmdate('Y-m-d H:i:s'),
                'received_at' => gmdate('Y-m-d H:i:s'),
                'event_key' => $newKey,
            ]);
            $updated = recordatorios_find_item_by_id($id);
            return [
                'ok' => true,
                'status' => 'success',
                'message' => 'Recordatorio enviado por correo a ' . $email,
                'channel' => 'email',
                'item' => recordatorios_format_item($updated ?: $item, $email),
            ];
        }
        return ['ok' => false, 'error' => 'No se pudo enviar el correo a ' . $email];
    }

    // 2. Enviar por WhatsApp
    if ($phone === '') {
        return ['ok' => false, 'error' => 'Se requiere un número de WhatsApp válido para el envío'];
    }

    $waRes = send_whatsapp_reminder_template($phone, [
        'patient_name' => $firstName,
        'tipo_cita' => $tipoCita,
        'formatted_time' => $formattedTime,
        'indicaciones' => $indicaciones,
        'event_id' => (string) ($item['calendar_event_id'] ?? ''),
    ]);

    if (!empty($waRes['ok'])) {
        $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent:' . time();
        recordatorios_update_outcome($id, [
            'status' => 'sent',
            'wa_id' => $phone,
            'error_code' => '',
            'error_message' => 'Disparado manual por ' . $user,
            'run_at' => gmdate('Y-m-d H:i:s'),
            'received_at' => gmdate('Y-m-d H:i:s'),
            'event_key' => $newKey,
        ]);
        $updated = recordatorios_find_item_by_id($id);
        return [
            'ok' => true,
            'status' => 'success',
            'message' => 'Recordatorio enviado por WhatsApp a ' . $phone,
            'channel' => 'whatsapp',
            'item' => recordatorios_format_item($updated ?: $item, $email !== '' ? $email : null),
        ];
    }

    $errMsg = (string) ($waRes['error'] ?? 'No se pudo entregar el mensaje por WhatsApp');
    $errTo = (string) ($waRes['to'] ?? $phone);

    // Fallback email solo en canal auto (nunca en pruebas ni si eligieron Solo WhatsApp).
    if ($channel === 'auto' && !$isTestCase && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $subject = 'Recordatorio de turno — Kinésica';
        $when = trim($apptDate . ' ' . $formattedTime);
        $html = '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">'
            . '<h2 style="color:#0b2545;">Recordatorio de turno — Kinésica</h2>'
            . '<p>¡Hola <strong>' . htmlspecialchars($firstName) . '</strong>! Te escribimos para recordarte tu turno:</p>'
            . '<ul>'
            . '<li><strong>Tipo:</strong> ' . htmlspecialchars($tipoCita) . '</li>'
            . '<li><strong>Horario:</strong> ' . htmlspecialchars($when !== '' ? $when : $formattedTime) . '</li>'
            . ($isCall ? '<li><strong>Modalidad:</strong> Llamada por WhatsApp</li>' : '<li><strong>Ubicación:</strong> Charcas 3889, 5º, B (Palermo)</li>')
            . '</ul>'
            . '<p>' . nl2br(htmlspecialchars($indicaciones)) . '</p>'
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.</p>'
            . '</div>';
        $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} - {$when}.\n{$indicaciones}\nKinésica";
        if (send_html_mail($email, $subject, $html, $text)) {
            $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent_email:' . time();
            recordatorios_update_outcome($id, [
                'status' => 'sent_email',
                'wa_id' => $phone,
                'error_code' => 'wa_failed_email_ok',
                'error_message' => substr($email . ' | WA: ' . $errMsg, 0, 500),
                'run_at' => gmdate('Y-m-d H:i:s'),
                'received_at' => gmdate('Y-m-d H:i:s'),
                'event_key' => $newKey,
            ]);
            $updated = recordatorios_find_item_by_id($id);
            return [
                'ok' => true,
                'status' => 'success',
                'message' => 'WhatsApp falló (' . $errMsg . ') hacia ' . $errTo . '. Se envió por correo a ' . $email,
                'channel' => 'email',
                'whatsapp_error' => $errMsg,
                'item' => recordatorios_format_item($updated ?: $item, $email),
            ];
        }
    }

    recordatorios_update_outcome($id, [
        'wa_id' => $phone,
        'error_code' => 'manual_failed',
        'error_message' => substr($errMsg, 0, 500),
    ]);
    return [
        'ok' => false,
        'error' => 'WhatsApp no entregó a ' . $errTo . ': ' . $errMsg,
        'whatsapp_error' => $errMsg,
        'to' => $errTo,
    ];
}

