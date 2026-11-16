<?php
declare(strict_types=1);

/**
 * API pública: consultar / anular turno con apellido + email + código.
 * POST JSON: { action: "lookup"|"cancel", apellido, email, codigo }
 */

require_once __DIR__ . '/mi-turno-lib.php';
require_once __DIR__ . '/../admin/api/lib.php';
require_once __DIR__ . '/../admin/api/lib_relational_turnos.php';

kinesica_mi_turno_cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    kinesica_mi_turno_json(405, ['success' => false, 'error' => 'Método no permitido']);
}

$raw = file_get_contents('php://input');
$json = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
$data = is_array($json) ? $json : $_POST;

$action = strtolower(trim((string) ($data['action'] ?? 'lookup')));
$email = trim((string) ($data['email'] ?? ''));
$apellido = trim((string) ($data['apellido'] ?? $data['lastname'] ?? ''));
$codigo = strtoupper(trim((string) ($data['codigo'] ?? $data['code'] ?? '')));

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!kinesica_mi_turno_rate_ok('ip:' . $clientIp, 30, 3600)
    || !kinesica_mi_turno_rate_ok('email:' . strtolower($email), 12, 3600)) {
    kinesica_mi_turno_json(429, [
        'success' => false,
        'error' => 'Demasiados intentos. Probá de nuevo más tarde.',
    ]);
}

if ($email === '' || $apellido === '' || $codigo === '') {
    kinesica_mi_turno_json(400, [
        'success' => false,
        'error' => 'Completá apellido, email y código.',
    ]);
}

try {
    $pdo = db();
} catch (Throwable) {
    kinesica_mi_turno_json(503, ['success' => false, 'error' => 'Servicio no disponible']);
}

if (!kinesica_rel_turnos_manage_ready($pdo)) {
    kinesica_mi_turno_json(503, [
        'success' => false,
        'error' => 'Gestión de turnos no disponible todavía.',
        'code' => 'migrate_pending',
    ]);
}

$found = kinesica_rel_lookup_turno_by_manage($pdo, $email, $apellido, $codigo);
if (empty($found['ok']) || empty($found['turno'])) {
    kinesica_mi_turno_json(404, [
        'success' => false,
        'error' => 'No encontramos un turno con esos datos.',
    ]);
}

/** @var array<string,mixed> $turno */
$turno = $found['turno'];
$practitioner = kinesica_mi_turno_practitioner_contact($pdo, $turno);
$view = kinesica_mi_turno_public_view($turno, $practitioner);

if ($action === 'lookup') {
    kinesica_mi_turno_json(200, [
        'success' => true,
        'action' => 'lookup',
        'turno' => $view,
    ]);
}

if ($action !== 'cancel') {
    kinesica_mi_turno_json(400, ['success' => false, 'error' => 'Acción desconocida (lookup|cancel)']);
}

$policy = kinesica_rel_manage_cancel_allowed($turno);
if (empty($policy['allowed'])) {
    kinesica_mi_turno_json(403, [
        'success' => false,
        'error' => 'Para anular con menos de 24 hs de anticipación, escribinos por WhatsApp.',
        'code' => 'policy_blocked',
        'turno' => $view,
        // Política 24 hs: Clara (recepción), no el profesional.
        'whatsapp' => 'https://wa.me/5491131781733',
    ]);
}

$calId = kinesica_rel_normalize_calendar_event_id((string) ($turno['calendar_event_id'] ?? ''));
$calRes = kinesica_mi_turno_cancel_calendar($calId, [
    'paciente' => $view['paciente'],
    'fecha' => $view['fecha'],
    'hora' => $view['hora'],
]);

if (empty($calRes['ok'])) {
    error_log('mi-turno cancel calendar: ' . ($calRes['error'] ?? 'unknown'));
    kinesica_mi_turno_json(502, [
        'success' => false,
        'error' => 'No pudimos anular el turno ahora. Probá de nuevo o escribinos por WhatsApp.',
        'whatsapp' => $practitioner['waMe'],
        'profesional' => [
            'id' => $practitioner['id'],
            'name' => $practitioner['name'],
            'whatsappDigits' => $practitioner['whatsappDigits'],
        ],
        'turno' => $view,
    ]);
}

try {
    kinesica_rel_cancel_turno($pdo, [
        'turno_id' => (int) ($turno['id'] ?? 0),
        'calendar_event_id' => $calId,
    ]);
} catch (Throwable $e) {
    error_log('mi-turno shadow cancel: ' . $e->getMessage());
}

// Mail de anulación (best-effort; no bloquea la respuesta).
try {
    if ($email !== '') {
        require_once __DIR__ . '/confirmation-mail-lib.php';
        $mailBuilt = kinesica_build_confirmation_mail([
            'paciente' => $view['paciente'],
            'fecha' => $view['fecha'],
            'hora' => $view['hora'],
            'esCancelacion' => true,
        ]);
        // Reutiliza send-confirmation vía include interno sería pesado; mail() simple.
        $cfg = function_exists('cfg') ? cfg() : [];
        $mailFrom = trim((string) ($cfg['mail_from'] ?? 'no-reply@kinesica.com.ar'));
        if ($mailFrom === '') {
            $mailFrom = 'no-reply@kinesica.com.ar';
        }
        $subject = '=?UTF-8?B?' . base64_encode($mailBuilt['subject']) . '?=';
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: =?UTF-8?B?' . base64_encode('Kinésica') . '?= <' . $mailFrom . '>',
        ]) . "\r\n";
        @mail($email, $subject, $mailBuilt['html'], $headers, '-f ' . $mailFrom);
    }
} catch (Throwable $e) {
    error_log('mi-turno cancel mail: ' . $e->getMessage());
}

kinesica_mi_turno_json(200, [
    'success' => true,
    'action' => 'cancel',
    'message' => 'Tu turno fue anulado.',
    'turno' => array_merge($view, ['status' => 'cancelled', 'can_cancel' => false]),
]);
