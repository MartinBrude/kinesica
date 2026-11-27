<?php
declare(strict_types=1);

/**
 * One-shot diagnóstico (sin secretos en la respuesta). Borrar tras usarlo.
 * GET /api/wa-tpl-diag.php?k=KIN_WA_TPL_20261127
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_GET['k'] ?? '') !== 'KIN_WA_TPL_20261127') {
    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

require_once dirname(__DIR__) . '/admin/api/lib.php';

$creds = whatsapp_credentials();
$token = (string) ($creds['token'] ?? '');
$phoneId = (string) ($creds['phone_number_id'] ?? '');
$out = [
    'ok' => true,
    'at' => gmdate('c'),
    'phone_number_id_suffix' => $phoneId !== '' ? substr($phoneId, -6) : '',
    'has_token' => $token !== '',
];

if ($token === '' || $phoneId === '') {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'missing_credentials'] + $out);
    exit;
}

$ch = curl_init('https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '?fields=display_phone_number,verified_name,whatsapp_business_account{id,name}');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    CURLOPT_TIMEOUT => 20,
]);
$phoneRaw = curl_exec($ch);
$phoneHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$phone = is_string($phoneRaw) ? json_decode($phoneRaw, true) : null;
$wabaId = (string) ($phone['whatsapp_business_account']['id'] ?? '');
$out['phone_http'] = $phoneHttp;
$out['display_phone_number'] = $phone['display_phone_number'] ?? null;
$out['verified_name'] = $phone['verified_name'] ?? null;
$out['waba_id'] = $wabaId !== '' ? $wabaId : null;
$out['waba_name'] = $phone['whatsapp_business_account']['name'] ?? null;

$out['templates'] = [];
if ($wabaId !== '') {
    foreach (['confirmacion_turno_kinesica', 'recordatorio_turno_kinesica'] as $name) {
        $url = 'https://graph.facebook.com/v21.0/' . rawurlencode($wabaId)
            . '/message_templates?name=' . rawurlencode($name) . '&limit=20';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
            CURLOPT_TIMEOUT => 25,
        ]);
        $raw = curl_exec($ch);
        $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        $rows = [];
        foreach (($decoded['data'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $bodyText = null;
            foreach (($row['components'] ?? []) as $comp) {
                if (is_array($comp) && strtoupper((string) ($comp['type'] ?? '')) === 'BODY') {
                    $bodyText = $comp['text'] ?? null;
                }
            }
            $rows[] = [
                'name' => $row['name'] ?? null,
                'language' => $row['language'] ?? null,
                'status' => $row['status'] ?? null,
                'category' => $row['category'] ?? null,
                'parameter_format' => $row['parameter_format'] ?? null,
                'body_preview' => is_string($bodyText) ? mb_substr($bodyText, 0, 120) : null,
            ];
        }
        $out['templates'][$name] = [
            'http' => $http,
            'count' => count($rows),
            'rows' => $rows,
            'error' => $http >= 300 ? (is_string($raw) ? substr($raw, 0, 300) : null) : null,
        ];
    }
} else {
    $out['error'] = 'no_waba';
    $out['phone_error'] = is_string($phoneRaw) ? substr($phoneRaw, 0, 300) : null;
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
