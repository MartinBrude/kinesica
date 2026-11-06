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

/**
 * Envía plantilla recordatorio_turno_kinesica vía Graph API.
 *
 * @param string $to
 * @param array{patient_name?: string, tipo_cita?: string, formatted_time?: string, indicaciones?: string, event_id?: string} $data
 * @return array{ok: bool, http_code: int, error?: string, response?: string}
 */
function send_whatsapp_reminder_template(string $to, array $data): array
{
    $creds = whatsapp_credentials();
    $token = $creds['token'];
    $phoneId = $creds['phone_number_id'];
    $to = preg_replace('/\D+/', '', $to) ?? '';
    if ($token === '' || $to === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta token de WhatsApp o teléfono de destino'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible en el servidor'];
    }

    $patient = trim((string) ($data['patient_name'] ?? 'Estimado/a paciente'));
    $tipo = trim((string) ($data['tipo_cita'] ?? 'sesión en el consultorio'));
    $time = trim((string) ($data['formatted_time'] ?? ''));
    $indicaciones = trim((string) ($data['indicaciones'] ?? '📍 Te esperamos en Charcas 3889, 5º, B (Palermo).'));
    $eventId = trim((string) ($data['event_id'] ?? ''));

    // Meta Cloud API rechaza saltos de línea (\r, \n), tabs y más de 4 espacios seguidos en parámetros
    $cleanParam = static function (string $text): string {
        $singleLine = str_replace(["\r\n", "\r", "\n"], ' | ', $text);
        return preg_replace('/\s+/', ' ', trim($singleLine)) ?? $text;
    };
    $patient = $cleanParam($patient);
    $tipo = $cleanParam($tipo);
    $time = $cleanParam($time);
    $indicaciones = $cleanParam($indicaciones);

    $confirmPayload = 'confirmar_turno' . ($eventId !== '' ? (':' . $eventId) : '');
    $cancelPayload = 'cancelar_turno' . ($eventId !== '' ? (':' . $eventId) : '');

    $graphBody = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $to,
        'type' => 'template',
        'template' => [
            'name' => 'recordatorio_turno_kinesica',
            'language' => ['code' => 'es_AR'],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $patient !== '' ? $patient : 'Estimado/a paciente'],
                        ['type' => 'text', 'text' => $tipo !== '' ? $tipo : 'sesión en el consultorio'],
                        ['type' => 'text', 'text' => $time !== '' ? $time : '-'],
                        ['type' => 'text', 'text' => $indicaciones !== '' ? $indicaciones : '-'],
                    ],
                ],
                [
                    'type' => 'button',
                    'sub_type' => 'quick_reply',
                    'index' => '0',
                    'parameters' => [['type' => 'payload', 'payload' => $confirmPayload]],
                ],
                [
                    'type' => 'button',
                    'sub_type' => 'quick_reply',
                    'index' => '1',
                    'parameters' => [['type' => 'payload', 'payload' => $cancelPayload]],
                ],
            ],
        ],
    ];

    $url = 'https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '/messages';
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
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red Meta: ' . $curlError];
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
