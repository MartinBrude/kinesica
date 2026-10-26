<?php
declare(strict_types=1);

/**
 * Alerta WhatsApp desde el simulador de Clara (opción E → 1/2/3).
 * POST { "target": "norberto"|"maria"|"azar", "option_label"?: string, "patient_message"?: string }
 */

require __DIR__ . '/lib.php';

require_header();
$user = require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$targetRaw = strtolower(trim((string) ($input['target'] ?? '')));
$allowed = ['norberto', 'maria', 'azar'];
if (!in_array($targetRaw, $allowed, true)) {
    json_out(400, ['error' => 'target inválido (norberto|maria|azar)']);
}

$phones = [
    'norberto' => '541161564311',
    'maria' => '541128531224',
];
$names = [
    'norberto' => 'Lic. Norberto Brude',
    'maria' => 'Lic. María Gulin',
];

$chosen = $targetRaw;
if ($chosen === 'azar') {
    $chosen = (random_int(0, 1) === 0) ? 'norberto' : 'maria';
}

$to = $phones[$chosen];
$professionalName = $names[$chosen];
$optionLabel = trim((string) ($input['option_label'] ?? $targetRaw));
$patientMessage = trim((string) ($input['patient_message'] ?? ''));
$byName = (string) ($user['name'] ?: $user['username']);

$body = "🧪 *DEMO · Simulador Clara*\n"
    . "• *Disparado por:* {$byName}\n"
    . "• *Opción:* {$optionLabel}\n"
    . "• *Asignado a:* {$professionalName}\n";
if ($patientMessage !== '') {
    $body .= "• *Mensaje en el simulador:* \"" . $patientMessage . "\"\n";
}
$body .= "\n_(Prueba desde /admin — no es un paciente real. Podés ignorarlo.)_";

$tplDetalle = $patientMessage !== ''
    ? ('Mensaje simulador: "' . $patientMessage . '" | Disparado por ' . $byName)
    : ('Disparado por ' . $byName . ' desde /admin (DEMO)');
$alertPayload = [
    'to' => $to,
    'body' => $body,
    'tpl_patient' => 'Demo simulador',
    'tpl_whatsapp' => $to,
    'tpl_motivo' => 'DEMO · ' . ($optionLabel !== '' ? $optionLabel : $targetRaw),
    'tpl_detalle' => mb_substr($tplDetalle, 0, 300),
    'tpl_btn_phone' => $to,
];

$result = send_whatsapp_alert_payload($alertPayload);
if (!$result['ok']) {
    json_out(502, [
        'error' => $result['error'] ?? 'No se pudo enviar el WhatsApp',
        'http_code' => $result['http_code'] ?? 0,
        'via' => $result['via'] ?? null,
    ]);
}

json_out(200, [
    'ok' => true,
    'to' => $to,
    'professional' => $chosen,
    'professional_name' => $professionalName,
    'target_requested' => $targetRaw,
    'via' => $result['via'] ?? null,
]);
