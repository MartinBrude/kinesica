<?php
declare(strict_types=1);


/**
 * Envía alerta de auditoría EXCLUSIVAMENTE a Norberto (WhatsApp + Email de resguardo).
 * Nunca se notifica a María ni al paciente que se usó el modo respaldo.
 */
function kinesica_backup_notify_norberto_audit(array $bookingEntry, array $backupState, array $syncOutcome): array
{
    $norbertoPhone = (string) (
        getenv('NORBERTO_PHONE')
        ?: ($_SERVER['NORBERTO_PHONE'] ?? $_ENV['NORBERTO_PHONE'] ?? cfg()['norberto_phone'] ?? '541161564311')
    );
    $norbertoEmail = (string) (
        getenv('NORBERTO_EMAIL')
        ?: ($_SERVER['NORBERTO_EMAIL'] ?? $_ENV['NORBERTO_EMAIL'] ?? cfg()['norberto_email'] ?? 'norberto1712@gmail.com')
    );

    $payload = is_array($bookingEntry['payload'] ?? null) ? $bookingEntry['payload'] : [];
    $practitionerId = strtolower(trim((string) ($payload['practitionerId'] ?? '')));
    $practitionerLabel = match ($practitionerId) {
        'maria' => 'Lic. María Gulin',
        'norberto' => 'Lic. Norberto Brude',
        default => 'Indistinto (según horario)',
    };

    $nombre = trim((string) ($payload['nombre'] ?? 'Paciente'));
    $telefono = trim((string) ($payload['telefono'] ?? ''));
    $cleanPhone = preg_replace('/\D+/', '', $telefono) ?? '';
    $waLink = $cleanPhone !== '' ? ("wa.me/{$cleanPhone}") : 'No provisto';
    $dni = trim((string) ($payload['dni'] ?? 'No provisto')) ?: 'No provisto';
    $email = trim((string) ($payload['email'] ?? 'No provisto')) ?: 'No provisto';
    $dateStr = (string) ($bookingEntry['date'] ?? '');
    $timeStr = (string) ($bookingEntry['time'] ?? '');
    $fechaAmigable = kinesica_backup_friendly_date($dateStr);
    $especialidad = trim((string) ($payload['especialidad'] ?? $payload['motivo'] ?? $payload['techniqueId'] ?? 'No especifica')) ?: 'No especifica';

    $updatedTs = (int) ($backupState['updated_ts'] ?? 0);
    $ageMin = $updatedTs > 0 ? max(0, (int) round((time() - $updatedTs) / 60)) : null;
    $ageLabel = $ageMin !== null ? "hace {$ageMin} min" : 'sin marca previa';

    $syncedOk = !empty($syncOutcome['synced']);
    $syncStatusLine = $syncedOk
        ? '✅ Se reintentó desde el servidor y ya quedó agendado en Google Calendar (ID: ' . ($syncOutcome['google_event_id'] ?? 'OK') . ').'
        : '⏳ Google Calendar sigue sin responder. Quedó bloqueado en el respaldo y se agendará automáticamente al reconectar (o verificalo manualmente en tu Google Calendar).';

    $message = "⚠️ *[AUDITORÍA · TURNO EN MODO RESPALDO]*\n"
        . "El paciente agendó normalmente sin notar ninguna falla, pero *Google Calendar no respondió* y se utilizó la copia de respaldo.\n\n"
        . "• *Profesional del turno:* {$practitionerLabel}\n"
        . "• *Paciente:* {$nombre}\n"
        . "• *Fecha y Hora:* {$fechaAmigable} ({$dateStr}) a las {$timeStr} hs\n"
        . "• *WhatsApp:* {$waLink}\n"
        . "• *Email:* {$email}\n"
        . "• *DNI:* {$dni}\n"
        . "• *Especialidad:* {$especialidad}\n"
        . "• *Copia de respaldo actualizada:* {$ageLabel}\n"
        . "• *Estado Google Calendar:* {$syncStatusLine}\n\n"
        . "🔍 *Acción sugerida:* Auditar en Google Calendar que el horario del {$fechaAmigable} a las {$timeStr} hs esté correctamente reflejado.";

    $waResult = ['ok' => false];
    $mailSent = false;
    $skipNetwork = getenv('KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS') === '1';

    if (!$skipNetwork) {
        try {
            $waResult = send_whatsapp_alert_payload([
                'to' => $norbertoPhone,
                'body' => $message,
            ]);
        } catch (Throwable $e) {
            $waResult = ['ok' => false, 'error' => $e->getMessage()];
        }

        try {
            $subject = "⚠️ [AUDITORÍA RESPALDO] Turno {$nombre} - {$fechaAmigable} {$timeStr} hs ({$practitionerLabel})";
            $plainBody = str_replace('*', '', $message);
            $htmlBody = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px">'
                . '<h2 style="color:#b45309;margin-top:0">⚠️ Auditoría: Turno agendado en Modo Respaldo</h2>'
                . '<p>El paciente completó su reserva de forma transparente, pero <strong>Google Calendar no respondió a tiempo</strong> y se utilizó la copia de respaldo del servidor.</p>'
                . '<ul style="line-height:1.7">'
                . '<li><strong>Profesional del turno:</strong> ' . htmlspecialchars($practitionerLabel, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Paciente:</strong> ' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Fecha y Hora:</strong> ' . htmlspecialchars("{$fechaAmigable} ({$dateStr}) a las {$timeStr} hs", ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>WhatsApp:</strong> ' . htmlspecialchars($waLink, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Email:</strong> ' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>DNI:</strong> ' . htmlspecialchars($dni, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Especialidad:</strong> ' . htmlspecialchars($especialidad, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Antigüedad de la copia:</strong> ' . htmlspecialchars($ageLabel, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Estado en Google Calendar:</strong> ' . htmlspecialchars($syncStatusLine, ENT_QUOTES, 'UTF-8') . '</li>'
                . '</ul>'
                . '<p style="background:#fffbeb;padding:12px;border-left:4px solid #f59e0b;margin-bottom:0">'
                . '<strong>Acción requerida:</strong> Por favor, auditá en Google Calendar que el turno esté libre y correctamente cargado.'
                . '</p></div>';
            $mailSent = send_html_mail($norbertoEmail, $subject, $htmlBody, $plainBody);
        } catch (Throwable $e) {
            $mailSent = false;
        }
    }

    return [
        'notified_to' => 'norberto_only',
        'recipient_phone' => $norbertoPhone,
        'recipient_email' => $norbertoEmail,
        'whatsapp_ok' => (bool) ($waResult['ok'] ?? false),
        'email_ok' => $mailSent,
        'message' => $message,
    ];
}

/**
 * Registra que una lectura de horarios se sirvió desde el respaldo.
 * Por defecto NO avisa por mail/WhatsApp: timeouts intermitentes de GAS (cold start)
 * activan el respaldo sin que el calendario esté caído. La alerta útil es la de
 * auditoría al agendar (`kinesica_backup_notify_norberto_audit`).
 *
 * Diagnóstico opcional: KINESICA_BACKUP_READ_ALERTS=1 (máx. 1 mail/WA cada 24 h).
 */

/**
 * Registra que una lectura de horarios se sirvió desde el respaldo.
 * Por defecto NO avisa por mail/WhatsApp: timeouts intermitentes de GAS (cold start)
 * activan el respaldo sin que el calendario esté caído. La alerta útil es la de
 * auditoría al agendar (`kinesica_backup_notify_norberto_audit`).
 *
 * Diagnóstico opcional: KINESICA_BACKUP_READ_ALERTS=1 (máx. 1 mail/WA cada 24 h).
 */
function kinesica_backup_notify_norberto_read_fallback(string $contextInfo = ''): void
{
    $ageMin = null;
    $updatedTs = 0;
    try {
        $state = kinesica_backup_read();
        $updatedTs = (int) ($state['updated_ts'] ?? 0);
        $ageMin = $updatedTs > 0 ? max(0, (int) round((time() - $updatedTs) / 60)) : null;
    } catch (Throwable $e) {
        // seguir con log
    }

    $ageText = $ageMin !== null ? "actualizada hace {$ageMin} min" : 'activa';
    error_log(
        'kinesica calendar backup read-fallback'
        . ($contextInfo !== '' ? " ({$contextInfo})" : '')
        . "; copia {$ageText}"
    );

    if (getenv('KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS') === '1') {
        return;
    }
    // Opt-in explícito: no molestar en producción salvo diagnóstico.
    $allowExternal = getenv('KINESICA_BACKUP_READ_ALERTS');
    if ($allowExternal !== '1' && $allowExternal !== 'true') {
        return;
    }

    $shouldAlert = false;
    try {
        kinesica_backup_mutate(function (array $state) use (&$shouldAlert, &$ageMin): array {
            $now = time();
            $last = (int) ($state['last_read_alert_ts'] ?? 0);
            if ($now - $last >= KINESICA_BACKUP_READ_ALERT_COOLDOWN) {
                $state['last_read_alert_ts'] = $now;
                $shouldAlert = true;
                $updatedTs = (int) ($state['updated_ts'] ?? 0);
                $ageMin = $updatedTs > 0 ? max(0, (int) round(($now - $updatedTs) / 60)) : null;
            }
            return $state;
        });
    } catch (Throwable $e) {
        return;
    }

    if (!$shouldAlert) {
        return;
    }

    $norbertoPhone = (string) (
        getenv('NORBERTO_PHONE')
        ?: ($_SERVER['NORBERTO_PHONE'] ?? $_ENV['NORBERTO_PHONE'] ?? cfg()['norberto_phone'] ?? '541161564311')
    );
    $norbertoEmail = (string) (
        getenv('NORBERTO_EMAIL')
        ?: ($_SERVER['NORBERTO_EMAIL'] ?? $_ENV['NORBERTO_EMAIL'] ?? cfg()['norberto_email'] ?? 'norberto1712@gmail.com')
    );
    $ageLabel = $ageMin !== null ? "actualizada hace {$ageMin} min" : 'activa';

    $msg = "⚠️ *[AVISO · MODO RESPALDO DE CALENDARIO ACTIVO]*\n"
        . "Una consulta de horarios en la web no obtuvo respuesta de Google Calendar a tiempo y fue respondida automáticamente con la copia de respaldo ({$ageLabel}).\n"
        . ($contextInfo !== '' ? "• *Detalle:* {$contextInfo}\n" : '')
        . "El paciente vio los horarios normalmente. Si concreta la reserva en modo respaldo, recibirás la alerta de auditoría con todos sus datos.";

    try {
        send_whatsapp_alert_payload(['to' => $norbertoPhone, 'body' => $msg]);
    } catch (Throwable $e) {
    }
    try {
        send_mail($norbertoEmail, '⚠️ [KINÉSICA] Lectura de turnos servida desde Modo Respaldo', str_replace('*', '', $msg));
    } catch (Throwable $e) {
    }
}

/**
 * Intenta sincronizar inmediatamente desde el servidor una reserva tomada en modo respaldo hacia Google Apps Script.
 *
 * @return array{synced: bool, google_event_id?: string, error?: string}
 */
