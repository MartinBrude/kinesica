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

$graphGet = static function (string $url) use ($token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 25,
    ]);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return [$http, is_array($decoded) ? $decoded : null, is_string($raw) ? $raw : ''];
};

[$phoneHttp, $phone, $phoneRaw] = $graphGet(
    'https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '?fields=display_phone_number,verified_name,quality_rating'
);
$out['phone_http'] = $phoneHttp;
$out['display_phone_number'] = $phone['display_phone_number'] ?? null;
$out['verified_name'] = $phone['verified_name'] ?? null;
$out['quality_rating'] = $phone['quality_rating'] ?? null;
if ($phoneHttp >= 300) {
    $out['phone_error'] = substr($phoneRaw, 0, 300);
}

// Edge alternativa + debug_token para descubrir WABA / scopes.
[$edgeHttp, $edge, $edgeRaw] = $graphGet(
    'https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '/whatsapp_business_account'
);
$out['waba_edge_http'] = $edgeHttp;
$wabaId = (string) ($edge['id'] ?? ($edge['data'][0]['id'] ?? ''));
if ($wabaId === '' && is_array($edge) && isset($edge['error'])) {
    $out['waba_edge_error'] = substr($edgeRaw, 0, 300);
}

[$dbgHttp, $dbg] = array_slice($graphGet(
    'https://graph.facebook.com/v21.0/debug_token?input_token=' . rawurlencode($token)
), 0, 2);
$out['token_debug_http'] = $dbgHttp;
$out['token_app_id'] = $dbg['data']['app_id'] ?? null;
$out['token_type'] = $dbg['data']['type'] ?? null;
$out['token_scopes'] = $dbg['data']['scopes'] ?? null;
$out['token_granular'] = $dbg['data']['granular_scopes'] ?? null;

// Buscar WABA en granular scopes / target_ids.
if ($wabaId === '' && is_array($out['token_granular'])) {
    foreach ($out['token_granular'] as $g) {
        if (!is_array($g)) {
            continue;
        }
        if (($g['scope'] ?? '') === 'whatsapp_business_management' && !empty($g['target_ids'][0])) {
            $wabaId = (string) $g['target_ids'][0];
            break;
        }
    }
}

$out['waba_id'] = $wabaId !== '' ? $wabaId : null;

$out['templates'] = [];
if ($wabaId !== '') {
    foreach (['confirmacion_turno_kinesica', 'recordatorio_turno_kinesica', 'hello_world'] as $name) {
        [$http, $decoded, $raw] = $graphGet(
            'https://graph.facebook.com/v21.0/' . rawurlencode($wabaId)
            . '/message_templates?name=' . rawurlencode($name) . '&limit=20'
        );
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
            'error' => $http >= 300 ? substr($raw, 0, 300) : null,
        ];
    }
} else {
    $out['error'] = 'no_waba';
}

// Probe Graph send: hello_world (0 vars) vs confirmacion (solo para ver código).
$probeTo = '34658444942';
$sendProbe = static function (string $name, string $lang, array $params) use ($token, $phoneId, $probeTo): array {
    $body = [
        'messaging_product' => 'whatsapp',
        'to' => $probeTo,
        'type' => 'template',
        'template' => [
            'name' => $name,
            'language' => ['code' => $lang],
        ],
    ];
    if ($params !== []) {
        $body['template']['components'] = [['type' => 'body', 'parameters' => $params]];
    }
    $ch = curl_init('https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return [
        'http' => $http,
        'ok' => $http >= 200 && $http < 300,
        'meta_code' => $decoded['error']['code'] ?? null,
        'details' => $decoded['error']['error_data']['details'] ?? ($decoded['error']['message'] ?? null),
    ];
};
$out['send_probes'] = [
    'hello_world_en_US' => $sendProbe('hello_world', 'en_US', []),
    'confirmacion_es_AR' => $sendProbe('confirmacion_turno_kinesica', 'es_AR', [
        ['type' => 'text', 'text' => 'Martin'],
        ['type' => 'text', 'text' => 'Lunes 01/12'],
        ['type' => 'text', 'text' => '10:00'],
        ['type' => 'text', 'text' => 'Lic. Norberto Brude'],
        ['type' => 'text', 'text' => 'Charcas 3889'],
    ]),
];

// Recordatorio: body + botones (misma forma que producción).
$ch = curl_init('https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '/messages');
$recBody = [
    'messaging_product' => 'whatsapp',
    'to' => $probeTo,
    'type' => 'template',
    'template' => [
        'name' => 'recordatorio_turno_kinesica',
        'language' => ['code' => 'es_AR'],
        'components' => [
            [
                'type' => 'body',
                'parameters' => [
                    ['type' => 'text', 'text' => 'Martin'],
                    ['type' => 'text', 'text' => 'sesion en el consultorio'],
                    ['type' => 'text', 'text' => '10:00'],
                    ['type' => 'text', 'text' => 'Charcas 3889'],
                ],
            ],
            [
                'type' => 'button',
                'sub_type' => 'quick_reply',
                'index' => '0',
                'parameters' => [['type' => 'payload', 'payload' => 'confirmar_turno:diag']],
            ],
            [
                'type' => 'button',
                'sub_type' => 'quick_reply',
                'index' => '1',
                'parameters' => [['type' => 'payload', 'payload' => 'cancelar_turno:diag']],
            ],
        ],
    ],
];
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($recBody, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 20,
]);
$recRaw = curl_exec($ch);
$recHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$recDecoded = is_string($recRaw) ? json_decode($recRaw, true) : null;
$out['send_probes']['recordatorio_es_AR'] = [
    'http' => $recHttp,
    'ok' => $recHttp >= 200 && $recHttp < 300,
    'meta_code' => $recDecoded['error']['code'] ?? null,
    'details' => $recDecoded['error']['error_data']['details'] ?? ($recDecoded['error']['message'] ?? null),
];

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
