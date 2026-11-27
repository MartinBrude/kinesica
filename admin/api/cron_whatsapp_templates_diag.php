<?php
declare(strict_types=1);

/**
 * CLI: escribe admin/api/data/whatsapp_templates_diag.json (sin secrets).
 * Uso: php admin/api/cron_whatsapp_templates_diag.php
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';

$creds = whatsapp_credentials();
$token = (string) ($creds['token'] ?? '');
$phoneId = (string) ($creds['phone_number_id'] ?? '');
$out = [
    'at' => gmdate('c'),
    'phone_number_id_suffix' => $phoneId !== '' ? substr($phoneId, -6) : '',
    'has_token' => $token !== '',
];

if ($token === '' || $phoneId === '') {
    $out['error'] = 'missing_credentials';
    $path = __DIR__ . '/data/whatsapp_templates_diag.json';
    @mkdir(dirname($path), 0755, true);
    file_put_contents($path, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fwrite(STDOUT, $path . "\n");
    exit(1);
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
$out['waba_id'] = $wabaId;
$out['waba_name'] = $phone['whatsapp_business_account']['name'] ?? null;

$names = ['confirmacion_turno_kinesica', 'recordatorio_turno_kinesica'];
$out['templates'] = [];
if ($wabaId !== '') {
    foreach ($names as $name) {
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
                'body_text' => $bodyText,
            ];
        }
        $out['templates'][$name] = [
            'http' => $http,
            'count' => count($rows),
            'rows' => $rows,
            'error' => $http >= 300 ? (is_string($raw) ? substr($raw, 0, 400) : '') : null,
        ];
    }
} else {
    $out['error'] = 'no_waba';
    $out['phone_raw'] = is_string($phoneRaw) ? substr($phoneRaw, 0, 400) : '';
}

// Probe send of confirmation to a fake number? Skip — only list.

$path = __DIR__ . '/data/whatsapp_templates_diag.json';
@mkdir(dirname($path), 0755, true);
file_put_contents($path, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
fwrite(STDOUT, $path . "\n");
