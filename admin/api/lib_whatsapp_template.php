<?php
declare(strict_types=1);

/**
 * Envía plantilla alerta_profesional_kinesica vía Graph API.
 *
 * @param array<string,string> $tpl
 * @return array{ok: bool, http_code: int, error?: string, response?: string}
 */
function send_whatsapp_template_alert(string $to, array $tpl): array
{
    $creds = whatsapp_credentials();
    $token = $creds['token'];
    $phoneId = $creds['phone_number_id'];
    $to = preg_replace('/\D+/', '', $to) ?? '';
    if ($token === '' || $to === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta token o destino'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible'];
    }

    $btn = preg_replace('/\D+/', '', (string) ($tpl['tpl_btn_phone'] ?? $tpl['tpl_whatsapp'] ?? '')) ?? '';
    $graphBody = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $to,
        'type' => 'template',
        'template' => [
            'name' => 'alerta_profesional_kinesica',
            'language' => ['code' => 'es_AR'],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => (string) ($tpl['tpl_patient'] ?? '-')],
                        ['type' => 'text', 'text' => (string) ($tpl['tpl_whatsapp'] ?? '-')],
                        ['type' => 'text', 'text' => (string) ($tpl['tpl_motivo'] ?? '-')],
                        ['type' => 'text', 'text' => (string) ($tpl['tpl_detalle'] ?? '-')],
                    ],
                ],
                [
                    'type' => 'button',
                    'sub_type' => 'url',
                    'index' => '0',
                    'parameters' => [
                        ['type' => 'text', 'text' => $btn !== '' ? $btn : '5491100000000'],
                    ],
                ],
            ],
        ],
    ];

    $url = 'https://graph.facebook.com/v22.0/' . rawurlencode($phoneId) . '/messages';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($graphBody, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red: ' . $curlError];
    }
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true, 'http_code' => $httpCode, 'response' => is_string($response) ? $response : ''];
    }
    $snippet = is_string($response) ? substr($response, 0, 300) : '';
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => 'Meta HTTP ' . $httpCode . ($snippet !== '' ? (': ' . $snippet) : ''),
        'response' => is_string($response) ? $response : '',
    ];
}
