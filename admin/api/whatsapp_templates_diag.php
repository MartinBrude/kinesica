<?php
declare(strict_types=1);

/**
 * Diagnóstico: lista plantillas Meta (nombre/idioma/status) para confirmar confirmacion_turno_kinesica.
 * Auth: sesión admin/profesional (igual que pacientes.php).
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/pacientes_authenticate.php';

$bodyData = null;
$auth = authenticate_request($bodyData);
if (($auth['type'] ?? '') !== 'session' && ($auth['type'] ?? '') !== 'api_token') {
    json_out(401, ['status' => 'error', 'message' => 'Auth requerida']);
}
if (($auth['type'] ?? '') === 'session' && !can_use_admin_booking($auth) && !is_admin($auth)) {
    json_out(403, ['status' => 'error', 'message' => 'Sin permiso']);
}

$creds = whatsapp_credentials();
$token = (string) ($creds['token'] ?? '');
$phoneId = (string) ($creds['phone_number_id'] ?? '');
if ($token === '' || $phoneId === '') {
    json_out(500, ['status' => 'error', 'message' => 'Faltan credenciales WhatsApp']);
}

$ch = curl_init('https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '?fields=whatsapp_business_account{id,name}');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    CURLOPT_TIMEOUT => 20,
]);
$phoneMetaRaw = curl_exec($ch);
$phoneHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$phoneMeta = is_string($phoneMetaRaw) ? json_decode($phoneMetaRaw, true) : null;
$wabaId = (string) ($phoneMeta['whatsapp_business_account']['id'] ?? '');
if ($wabaId === '') {
    json_out(502, [
        'status' => 'error',
        'message' => 'No se pudo resolver WABA ID',
        'http' => $phoneHttp,
        'raw' => is_string($phoneMetaRaw) ? substr($phoneMetaRaw, 0, 500) : '',
    ]);
}

$name = trim((string) ($_GET['name'] ?? 'confirmacion_turno_kinesica'));
$url = 'https://graph.facebook.com/v21.0/' . rawurlencode($wabaId)
    . '/message_templates?limit=50'
    . ($name !== '' ? ('&name=' . rawurlencode($name)) : '');
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    CURLOPT_TIMEOUT => 25,
]);
$tplRaw = curl_exec($ch);
$tplHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$tpl = is_string($tplRaw) ? json_decode($tplRaw, true) : null;

$items = [];
foreach (($tpl['data'] ?? []) as $row) {
    if (!is_array($row)) {
        continue;
    }
    $body = null;
    foreach (($row['components'] ?? []) as $comp) {
        if (!is_array($comp)) {
            continue;
        }
        if (strtoupper((string) ($comp['type'] ?? '')) === 'BODY') {
            $body = [
                'text' => $comp['text'] ?? null,
                'example' => $comp['example'] ?? null,
            ];
        }
    }
    $items[] = [
        'name' => $row['name'] ?? null,
        'language' => $row['language'] ?? null,
        'status' => $row['status'] ?? null,
        'category' => $row['category'] ?? null,
        'parameter_format' => $row['parameter_format'] ?? null,
        'body' => $body,
    ];
}

json_out(200, [
    'status' => 'success',
    'waba_id' => $wabaId,
    'waba_name' => $phoneMeta['whatsapp_business_account']['name'] ?? null,
    'phone_number_id' => $phoneId,
    'query_name' => $name,
    'http' => $tplHttp,
    'count' => count($items),
    'templates' => $items,
    'raw_error' => ($tplHttp >= 300) ? (is_string($tplRaw) ? substr($tplRaw, 0, 800) : '') : null,
]);
