<?php
/**
 * Kinésica - Confirmación de turno: mail (Resend/mail) + WhatsApp vía Clara.
 * URL: /api/send-confirmation.php
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/confirmation-mail-lib.php';
require_once __DIR__ . '/send-confirmation-patient.php';
require_once __DIR__ . '/send-confirmation-transport.php';
require_once __DIR__ . '/send-confirmation-whatsapp.php';

// Configuración CORS
$allowedOrigins = [
    'https://www.kinesica.com.ar',
    'https://kinesica.com.ar',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];
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

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
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
$direccion = trim((string) ($data['direccion'] ?? 'Charcas 3889, Piso 5º B, Palermo'));
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

$emailOk = $isValidEmail($email);
$phoneOk = kinesica_confirmation_phone_usable($telefono);

if (!$emailOk && !$phoneOk) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Se requiere un email válido o un WhatsApp válido para enviar la confirmación.',
        'email' => ['ok' => false, 'skipped' => true],
        'whatsapp' => ['ok' => false, 'skipped' => true],
    ]);
    exit;
}
if ($paciente === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nombre del paciente es requerido.']);
    exit;
}

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateBlocked = !kinesica_confirmation_rate_ok('ip:' . $clientIp, 20, 3600);
if (!$rateBlocked && $emailOk) {
    $rateBlocked = !kinesica_confirmation_rate_ok('email:' . strtolower($email), 4, 3600);
}
if (!$rateBlocked && $phoneOk) {
    $digits = kinesica_confirmation_wa_normalize_phone($telefono);
    $rateBlocked = !kinesica_confirmation_rate_ok('phone:' . $digits, 4, 3600);
}
if ($rateBlocked) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
    exit;
}

// Auto-registro/actualización en el Directorio de Pacientes (MySQL)
kinesica_confirmation_upsert_patient($data, $paciente, $emailOk ? $email : '', $profesional, $servicio);

$runtimeSettings = kinesica_read_settings(kinesica_admin_settings_file(__DIR__));
$practitionerIdRaw = trim((string) ($data['practitionerId'] ?? $data['practitioner_id'] ?? ''));

$manageCode = '';
$manageUrl = 'https://www.kinesica.com.ar/mi-turno';
$eventId = trim((string) ($data['eventId'] ?? $data['event_id'] ?? $data['calendar_event_id'] ?? ''));
if (!$esCancelacion && $emailOk && $eventId !== '') {
    try {
        require_once __DIR__ . '/../admin/api/lib.php';
        require_once __DIR__ . '/../admin/api/lib_relational_turnos.php';
        $startsAt = null;
        $endsAt = null;
        if (preg_match('/^(\d{4}-\d{2}-\d{2})$/', $fechaRaw) && preg_match('/^(\d{1,2}):(\d{2})/', $horaRaw, $hm)) {
            $startsAt = sprintf('%s %02d:%02d:00', $fechaRaw, (int) $hm[1], (int) $hm[2]);
            $endTs = strtotime($startsAt . ' +60 minutes');
            if ($endTs !== false) {
                $endsAt = date('Y-m-d H:i:s', $endTs);
            }
        }
        $rotateManage = !empty($data['retry'])
            || !empty($data['rotate_manage_code'])
            || !empty($data['force_new_manage_code']);
        $attachExtra = [
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'practitionerId' => $practitionerIdRaw,
            'rotate_manage_code' => $rotateManage,
        ];
        if ($practitionerIdRaw !== '') {
            $attachExtra['summary'] = '🩺 [' . strtoupper($practitionerIdRaw) . '] ' . $paciente;
        }
        $attach = kinesica_rel_attach_manage_code(db(), $eventId, $email, $paciente, null, $attachExtra);
        if (!empty($attach['ok']) && !empty($attach['code'])) {
            $manageCode = (string) $attach['code'];
            $apellidoLink = kinesica_apellido_from_full_name($paciente);
            $manageUrl = 'https://www.kinesica.com.ar/mi-turno?' . http_build_query([
                'apellido' => $apellidoLink,
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
        'paciente' => $paciente,
        'fecha' => $fechaRaw,
        'hora' => $horaRaw,
        'profesional' => $profesional,
        'servicio' => $servicio,
        'direccion' => $direccion,
        'esMenor' => $esMenor,
        'esCancelacion' => $esCancelacion,
        'manageCode' => $manageCode,
        'manageUrl' => $manageUrl,
        'settings' => $runtimeSettings,
    ]);

    $localCfg = kinesica_confirmation_load_local_cfg(__DIR__);
    $replyToEmail = kinesica_reply_to_email($practitionerIdRaw, $profesional, $runtimeSettings, $localCfg);
    $delivery = kinesica_confirmation_deliver_mail(
        $email,
        $builtMail['subject'],
        $builtMail['html'],
        $replyToEmail,
        $manageCode,
        $manageUrl,
        $localCfg
    );
    $emailChannel = [
        'ok' => !empty($delivery['ok']),
        'skipped' => false,
    ];
    if (!empty($delivery['body']['provider'])) {
        $emailChannel['provider'] = $delivery['body']['provider'];
    }
    if (empty($delivery['ok']) && !empty($delivery['body']['error'])) {
        $emailChannel['error'] = $delivery['body']['error'];
    }
}

// WhatsApp solo en confirmación de reserva (no en anulación).
if (!$esCancelacion && $phoneOk) {
    $waRes = kinesica_confirmation_deliver_whatsapp(
        $telefono,
        $paciente,
        $fechaRaw,
        $horaRaw,
        $profesional,
        $servicio,
        $direccion
    );
    $waChannel = [
        'ok' => !empty($waRes['ok']),
        'skipped' => !empty($waRes['skipped']),
    ];
    if (!empty($waRes['error'])) {
        $waChannel['error'] = $waRes['error'];
    }
    if (!empty($waRes['to'])) {
        $waChannel['to'] = $waRes['to'];
    }
}

$mailSent = !empty($emailChannel['ok']);
$waSent = !empty($waChannel['ok']);
$success = $mailSent || $waSent;

$body = [
    'success' => $success,
    'email' => $emailChannel,
    'whatsapp' => $waChannel,
];
if ($manageCode !== '') {
    $body['manageCode'] = $manageCode;
    $body['manageUrl'] = $manageUrl;
}
if (!$success) {
    $body['error'] = 'No se pudo enviar la confirmación por mail ni por WhatsApp.';
}

http_response_code($success ? 200 : 502);
echo json_encode($body);
