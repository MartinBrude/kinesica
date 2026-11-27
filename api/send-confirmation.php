<?php
/**
 * Kinésica - Confirmación de turno: mail (Resend/mail) + WhatsApp vía Clara.
 * URL: /api/send-confirmation.php
 *
 * WhatsApp exige confirmToken firmado (HMAC-SHA256 desde GAS / respaldo / admin proxy),
 * toma sus datos del token verificado y aplica anti-replay por eventId.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/confirmation-mail-lib.php';
require_once __DIR__ . '/send-confirmation-auth.php';
require_once __DIR__ . '/send-confirmation-patient.php';
require_once __DIR__ . '/send-confirmation-transport.php';
require_once __DIR__ . '/send-confirmation-whatsapp.php';

$allowedOrigins = ['https://www.kinesica.com.ar', 'https://kinesica.com.ar', 'http://localhost:3000', 'http://127.0.0.1:3000'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Utilizar POST.']);
    exit;
}

$data = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = $_POST;
}

$email = trim((string) ($data['email'] ?? ''));
$telefono = trim((string) ($data['telefono'] ?? $data['phone'] ?? ''));
$paciente = trim((string) ($data['paciente'] ?? $data['nombre'] ?? ''));
$fechaRaw = trim((string) ($data['fecha'] ?? $data['date'] ?? ''));
$horaRaw = trim((string) ($data['hora'] ?? $data['time'] ?? ''));
$profesional = trim((string) ($data['profesional'] ?? 'Lic. Norberto Brude'));
$servicio = trim((string) ($data['servicio'] ?? $data['especialidad'] ?? ''));
if ($servicio === '' || preg_match('/osteopat[ií]a\s*(?:&|\/|y)?\s*(?:terapia[s]?\s*manual(?:es)?)?/i', $servicio) || $servicio === 'No especifica') {
    $servicio = 'Terapias Manuales';
}
$esMenor = !empty($data['esMenor']) || !empty($data['isMenor']);
$tipo = strtolower(trim((string) ($data['tipo'] ?? 'confirmacion')));
$esCancelacion = in_array($tipo, ['cancelacion', 'cancelación', 'anulacion', 'anulación'], true);

$isValidEmail = static function (string $raw): bool {
    $s = trim($raw);
    if ($s === '' || strlen($s) > 120 || preg_match('/\s/', $s) || !filter_var($s, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $parts = explode('@', $s);
    if (count($parts) !== 2) {
        return false;
    }
    $labels = explode('.', $parts[1]);
    $tld = end($labels);
    return count($labels) >= 2 && is_string($tld) && (bool) preg_match('/^[A-Za-z]{2,24}$/', $tld);
};

$localCfg = kinesica_confirmation_load_local_cfg(__DIR__);
$confirmTokenRaw = trim((string) ($data['confirmToken'] ?? $data['confirm_token'] ?? ''));
$tokenCheck = kinesica_confirmation_verify_token($confirmTokenRaw, $localCfg);
$confirmClaims = !empty($tokenCheck['ok']) && is_array($tokenCheck['claims'] ?? null) ? $tokenCheck['claims'] : null;
$tokenReason = (string) ($tokenCheck['reason'] ?? 'CONFIRM_TOKEN_REQUIRED');

$trustedPhone = $confirmClaims !== null ? trim((string) ($confirmClaims['tel'] ?? '')) : '';
$emailOk = $isValidEmail($email);
$phoneOk = $confirmClaims !== null && kinesica_confirmation_phone_usable($trustedPhone);
$clientPhoneProvided = kinesica_confirmation_phone_usable($telefono);

if (!$emailOk && !$phoneOk) {
    $code = ($clientPhoneProvided && $confirmClaims === null) ? 403 : 400;
    $waErr = $code === 403 ? ['ok' => false, 'skipped' => true, 'error_code' => $tokenReason] : ['ok' => false, 'skipped' => true];
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $code === 403 ? 'Confirmación no autorizada.' : 'Se requiere un email válido o un WhatsApp válido para enviar la confirmación.',
        'email' => ['ok' => false, 'skipped' => true],
        'whatsapp' => $waErr,
    ]);
    exit;
}

if ($confirmClaims !== null && $paciente === '') {
    $paciente = trim((string) ($confirmClaims['nom'] ?? ''));
}
if ($paciente === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nombre del paciente es requerido.']);
    exit;
}

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateBlocked = !kinesica_confirmation_rate_ok('ip:' . $clientIp, 20, 3600)
    || ($emailOk && !kinesica_confirmation_rate_ok('email:' . strtolower($email), 4, 3600))
    || ($phoneOk && !kinesica_confirmation_rate_ok('phone:' . kinesica_confirmation_wa_normalize_phone($trustedPhone), 4, 3600));
if ($rateBlocked) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
    exit;
}

$eventId = $confirmClaims !== null
    ? trim((string) ($confirmClaims['eid'] ?? ''))
    : trim((string) ($data['eventId'] ?? $data['event_id'] ?? $data['calendar_event_id'] ?? ''));
$practitionerIdRaw = $confirmClaims !== null && trim((string) ($confirmClaims['pid'] ?? '')) !== ''
    ? trim((string) $confirmClaims['pid'])
    : trim((string) ($data['practitionerId'] ?? $data['practitioner_id'] ?? ''));

if ($emailOk || $confirmClaims !== null) {
    $upsertData = $confirmClaims !== null && $trustedPhone !== ''
        ? array_merge($data, ['telefono' => $trustedPhone])
        : $data;
    kinesica_confirmation_upsert_patient($upsertData, $paciente, $emailOk ? $email : '', $profesional, $servicio);
}

$runtimeSettings = kinesica_read_settings(kinesica_admin_settings_file(__DIR__));
$manageCode = '';
$manageUrl = 'https://www.kinesica.com.ar/mi-turno';
$canAttachManage = !$esCancelacion && $emailOk && $eventId !== ''
    && ($confirmClaims !== null || kinesica_confirmation_signing_secrets($localCfg) === []);
if ($canAttachManage) {
    try {
        require_once __DIR__ . '/../admin/api/lib.php';
        require_once __DIR__ . '/../admin/api/lib_relational_turnos.php';
        $mFecha = $confirmClaims !== null && trim((string) ($confirmClaims['date'] ?? '')) !== '' ? (string) $confirmClaims['date'] : $fechaRaw;
        $mHora = $confirmClaims !== null && trim((string) ($confirmClaims['time'] ?? '')) !== '' ? (string) $confirmClaims['time'] : $horaRaw;
        $startsAt = null;
        $endsAt = null;
        if (preg_match('/^(\d{4}-\d{2}-\d{2})$/', $mFecha) && preg_match('/^(\d{1,2}):(\d{2})/', $mHora, $hm)) {
            $startsAt = sprintf('%s %02d:%02d:00', $mFecha, (int) $hm[1], (int) $hm[2]);
            $endTs = strtotime($startsAt . ' +60 minutes');
            $endsAt = $endTs !== false ? date('Y-m-d H:i:s', $endTs) : null;
        }
        $rotateManage = !empty($data['retry']) || !empty($data['rotate_manage_code']) || !empty($data['force_new_manage_code']);
        $attachExtra = ['starts_at' => $startsAt, 'ends_at' => $endsAt, 'practitionerId' => $practitionerIdRaw, 'rotate_manage_code' => $rotateManage];
        if ($practitionerIdRaw !== '') {
            $attachExtra['summary'] = '🩺 [' . strtoupper($practitionerIdRaw) . '] ' . $paciente;
        }
        $attach = kinesica_rel_attach_manage_code(db(), $eventId, $email, $paciente, null, $attachExtra);
        if (!empty($attach['ok']) && !empty($attach['code'])) {
            $manageCode = (string) $attach['code'];
            $manageUrl = 'https://www.kinesica.com.ar/mi-turno?' . http_build_query([
                'apellido' => kinesica_apellido_from_full_name($paciente),
                'email' => $email,
                'codigo' => $manageCode,
            ], '', '&', PHP_QUERY_RFC3986);
        } elseif (!empty($attach['reason'])) {
            error_log('kinesica send-confirmation manage code reason: ' . (string) $attach['reason']);
        }
    } catch (Throwable $e) {
        error_log('kinesica send-confirmation manage code: ' . $e->getMessage());
    }
}

$emailChannel = ['ok' => false, 'skipped' => true];
$waChannel = ['ok' => false, 'skipped' => true];

if ($emailOk) {
    $builtMail = kinesica_build_confirmation_mail([
        'paciente' => $paciente, 'fecha' => $fechaRaw, 'hora' => $horaRaw,
        'profesional' => $profesional, 'servicio' => $servicio,
        'direccion' => KINESICA_CLINIC_ADDRESS_MAIL,
        'esMenor' => $esMenor, 'esCancelacion' => $esCancelacion,
        'manageCode' => $manageCode, 'manageUrl' => $manageUrl, 'settings' => $runtimeSettings,
    ]);
    $replyToEmail = kinesica_reply_to_email($practitionerIdRaw, $profesional, $runtimeSettings, $localCfg);
    $delivery = kinesica_confirmation_deliver_mail($email, $builtMail['subject'], $builtMail['html'], $replyToEmail, $manageCode, $manageUrl, $localCfg);
    $emailChannel = ['ok' => !empty($delivery['ok']), 'skipped' => false];
    if (!empty($delivery['body']['provider'])) {
        $emailChannel['provider'] = $delivery['body']['provider'];
    }
    if (empty($delivery['ok']) && !empty($delivery['body']['error'])) {
        $emailChannel['error'] = $delivery['body']['error'];
    }
}

// WhatsApp solo en confirmación (no anulación) y SOLO con confirmToken firmado y vigente.
if (!$esCancelacion) {
    if ($confirmClaims === null) {
        if ($clientPhoneProvided) {
            $waChannel['error_code'] = $tokenReason;
        }
    } elseif ($phoneOk) {
        $claim = kinesica_confirmation_wa_claim($eventId);
        if (!empty($claim['already_sent'])) {
            $waChannel = ['ok' => true, 'skipped' => true, 'already_sent' => true];
        } elseif (empty($claim['allowed'])) {
            $waChannel = ['ok' => false, 'skipped' => true, 'error_code' => (string) ($claim['reason'] ?? 'WA_BLOCKED')];
        } else {
            $waRes = kinesica_confirmation_deliver_whatsapp(
                $trustedPhone,
                (string) ($confirmClaims['nom'] ?? $paciente),
                (string) ($confirmClaims['date'] ?? $fechaRaw),
                (string) ($confirmClaims['time'] ?? $horaRaw),
                kinesica_confirmation_practitioner_label((string) ($confirmClaims['pid'] ?? '')),
                (string) ($confirmClaims['srv'] ?? ''),
                KINESICA_CLINIC_ADDRESS_WA
            );
            if (!empty($waRes['ok'])) {
                kinesica_confirmation_wa_mark_sent($eventId);
            }
            $waChannel = ['ok' => !empty($waRes['ok']), 'skipped' => !empty($waRes['skipped'])];
            foreach (['error', 'to', 'language', 'error_code'] as $k) {
                if (!empty($waRes[$k])) {
                    $waChannel[$k] = $waRes[$k];
                }
            }
        }
    }
}

$success = !empty($emailChannel['ok']) || !empty($waChannel['ok']);
$body = ['success' => $success, 'email' => $emailChannel, 'whatsapp' => $waChannel];
if ($manageCode !== '') {
    $body['manageCode'] = $manageCode;
    $body['manageUrl'] = $manageUrl;
}
if (!$success) {
    $body['error'] = 'No se pudo enviar la confirmación por mail ni por WhatsApp.';
}
http_response_code($success ? 200 : 502);
echo json_encode($body);
