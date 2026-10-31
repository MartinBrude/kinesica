<?php
declare(strict_types=1);

/**
 * API de Recordatorios WhatsApp 24h.
 *  POST action=ingest     outcomes desde n8n (secreto del bot); idempotente
 *  POST action=reconcile  fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  GET                    listado (sesión); colaborador puede leer; housekeeping reconcile
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer el historial.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/lib_recordatorios_n8n.php';
require_once __DIR__ . '/lib_whatsapp.php';
require_once __DIR__ . '/lib_mail.php';

function recordatorios_request_secret(): string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $secret = (string) ($headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '');
    if ($secret === '' && preg_match('/^Bearer\s+(.+)$/i', (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
        $secret = trim($m[1]);
    }
    return $secret;
}

function recordatorios_bot_authenticated(): bool
{
    $given = recordatorios_request_secret();
    if ($given === '') {
        return false;
    }
    $valid = [];
    foreach (['webhook_secret', 'bot_token'] as $k) {
        $v = trim((string) (cfg()[$k] ?? ''));
        if ($v !== '' && $v !== 'CAMBIAR') {
            $valid[] = $v;
        }
    }
    if ((cfg()['allow_legacy_bot_secret'] ?? false) === true) {
        $legacy = trim((string) (cfg()['legacy_bot_secret'] ?? ''));
        if ($legacy !== '' && $legacy !== 'CAMBIAR') {
            $valid[] = $legacy;
        }
    }
    foreach ($valid as $secret) {
        if (hash_equals($secret, $given)) {
            return true;
        }
    }
    return false;
}

function recordatorios_handle_ingest(array $input): void
{
    $raw = $input['items'] ?? [];
    if (!is_array($raw) || count($raw) > RECORDATORIOS_MAX_BATCH) {
        json_out(413, ['error' => 'items debe ser un arreglo de hasta ' . RECORDATORIOS_MAX_BATCH]);
    }
    $execId = trim((string) ($input['exec_id'] ?? $input['execution_id'] ?? ''));
    $runAt = recordatorios_parse_run_at($input['run_at'] ?? null, time());
    $items = [];
    $invalid = 0;
    foreach ($raw as $r) {
        if (!is_array($r)) {
            $invalid++;
            continue;
        }
        $n = recordatorios_normalize_item($r, $execId, $runAt);
        if ($n === null) {
            $invalid++;
            continue;
        }
        $items[] = $n;
    }
    if (!$items) {
        json_out(400, ['error' => 'Sin items válidos (status + calendar_event_id o run_skipped)', 'invalid' => $invalid]);
    }
    $res = recordatorios_store_items($items);
    if ($res['failed'] > 0) {
        json_out(500, ['error' => 'No se pudo guardar; reintentar', 'invalid' => $invalid] + $res);
    }
    json_out(200, ['ok' => true, 'invalid' => $invalid] + $res);
}

function recordatorios_run_housekeeping(bool $force): array
{
    $out = ['reconcile' => null];
    try {
        if (recordatorios_reconcile_due($force ? 10 : 60)) {
            $out['reconcile'] = recordatorios_reconcile(null, 6);
        }
    } catch (Throwable $e) {
        error_log('recordatorios housekeeping: ' . $e->getMessage());
    }
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');

if ($method === 'POST' && in_array($action, ['ingest', 'reconcile'], true) && recordatorios_bot_authenticated()) {
    if ($action === 'ingest') {
        recordatorios_handle_ingest($input);
    }
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($method === 'POST' && $action === 'ingest') {
    json_out(401, ['error' => 'No autorizado']);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    $house = recordatorios_run_housekeeping(!empty($_GET['sync']));
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : RECORDATORIOS_DEFAULT_DAYS;
        $view = recordatorios_load_view(null, $days);
    } catch (Throwable $e) {
        error_log('recordatorios GET: ' . $e->getMessage());
        json_out(503, ['error' => 'Base de datos no disponible']);
    }
    $st = recordatorios_reconcile_state();
    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => $view['total'],
        'days' => $view['days'],
        'counts' => $view['counts'],
        'items' => $view['items'],
        'grouped' => $view['grouped'],
        'sync' => $house['reconcile'],
        'reconcile' => [
            'status' => $st['status'] ?? null,
            'last_run' => $st['last_run'] ?? null,
            'last_ok' => $st['last_ok'] ?? null,
            'imported_last_run' => $st['imported_last_run'] ?? null,
            'message' => $st['message'] ?? null,
            'baseline_ts' => $st['baseline_ts'] ?? null,
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

if (is_colaborador($auth)) {
    json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
}

function recordatorios_dispatch_manual(int $id, array $input, array $auth): array
{
    $item = recordatorios_find_item_by_id($id);
    if (!$item) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado'];
    }

    $rawPhone = trim((string) ($input['wa_id'] ?? $input['phone'] ?? $item['wa_id'] ?? ''));
    $phone = preg_replace('/\D+/', '', $rawPhone) ?? '';
    if (strlen($phone) === 10 && str_starts_with($phone, '11')) {
        $phone = '549' . $phone;
    } elseif (strlen($phone) === 11 && str_starts_with($phone, '54') && !str_starts_with($phone, '549')) {
        $phone = '549' . substr($phone, 2);
    }

    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email === '' && $item['status'] === 'sent_email') {
        $email = strtolower(trim((string) $item['error_message']));
    }
    if ($email === '' && !empty($item['patient_name'])) {
        try {
            $pdo = recordatorios_pdo();
            $stmt = $pdo->prepare('SELECT email FROM pacientes WHERE (nombre_completo LIKE :nc OR (telefono != "" AND telefono = :tel)) AND email != "" LIMIT 1');
            $stmt->execute(['nc' => '%' . $item['patient_name'] . '%', 'tel' => $phone]);
            $foundEmail = $stmt->fetchColumn();
            if ($foundEmail) {
                $email = strtolower(trim((string) $foundEmail));
            }
        } catch (Throwable $e) {}
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
    $indicaciones = $isCall
        ? '📞 Norberto se comunicará con vos puntualmente a este número de WhatsApp.'
        : '📍 Te esperamos en Charcas 3889, 5º, B (Palermo).\n⚠️ Te recordamos puntualidad estricta para evitar esperas y no concurrir con acompañantes (salvo menores o asistencia directa).';

    $firstName = $patientName;
    $clean = preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/i', '', $patientName);
    $parts = preg_split('/\s+/', trim((string) $clean));
    if (!empty($parts[0]) && mb_strlen($parts[0]) >= 2) {
        $firstName = $parts[0];
    }

    // 1. Enviar por Email si el canal elegido es 'email' o si 'auto' sin teléfono pero con email
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
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor respondé a este correo o escribinos por WhatsApp.</p>'
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
                'item' => $updated,
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
        'formatted_time' => $apptTime !== '' ? $apptTime : 'horario convenido',
        'indicaciones' => $indicaciones,
    ]);

    if (!$waRes['ok']) {
        $body = "¡Hola {$firstName}! 🌿 Te escribo desde Kinésica para recordarte tu {$tipoCita} programada para mañana a las {$apptTime}.\n{$indicaciones}\n\nPor favor confirmá tu asistencia seleccionando una de las opciones o respondiendo a este mensaje 🙌";
        $waRes = send_whatsapp_alert_payload(['to' => $phone, 'body' => $body]);
    }

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
            'item' => $updated,
        ];
    }

    if ($channel === 'auto' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
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
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor respondé a este correo o escribinos por WhatsApp.</p>'
            . '</div>';
        $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} - {$when}.\n{$indicaciones}\nKinésica";
        if (send_html_mail($email, $subject, $html, $text)) {
            $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent_email:' . time();
            recordatorios_update_outcome($id, [
                'status' => 'sent_email',
                'wa_id' => $phone,
                'error_code' => '',
                'error_message' => $email . ' (Fallback manual por ' . $user . ')',
                'run_at' => gmdate('Y-m-d H:i:s'),
                'received_at' => gmdate('Y-m-d H:i:s'),
                'event_key' => $newKey,
            ]);
            $updated = recordatorios_find_item_by_id($id);
            return [
                'ok' => true,
                'status' => 'success',
                'message' => 'WhatsApp no entregó, pero se envió exitosamente por correo a ' . $email,
                'channel' => 'email',
                'item' => $updated,
            ];
        }
    }

    $errMsg = (string) ($waRes['error'] ?? 'No se pudo entregar el mensaje por WhatsApp');
    recordatorios_update_outcome($id, [
        'wa_id' => $phone,
        'error_code' => 'manual_failed',
        'error_message' => substr($errMsg, 0, 500),
    ]);
    return [
        'ok' => false,
        'error' => 'No se pudo enviar el recordatorio: ' . $errMsg,
    ];
}

if ($action === 'reconcile') {
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($action === 'dispatch' || $action === 'retry' || $action === 'send_manual') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_out(400, ['error' => 'ID de recordatorio inválido']);
    }
    $res = recordatorios_dispatch_manual($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    } else {
        json_out(400, $res);
    }
}

json_out(400, ['error' => 'Acción no soportada']);
