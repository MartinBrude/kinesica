<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_whatsapp_template.php';

/**
 * Credenciales Meta WhatsApp Cloud API (env primero, luego config.php).
 *
 * @return array{token: string, phone_number_id: string}
 */
function whatsapp_credentials(): array
{
    $token = (string) (
        getenv('WHATSAPP_TOKEN')
        ?: ($_SERVER['WHATSAPP_TOKEN'] ?? $_ENV['WHATSAPP_TOKEN'] ?? cfg()['whatsapp_token'] ?? '')
    );
    $phoneId = (string) (
        getenv('WHATSAPP_PHONE_NUMBER_ID')
        ?: ($_SERVER['WHATSAPP_PHONE_NUMBER_ID'] ?? $_ENV['WHATSAPP_PHONE_NUMBER_ID'] ?? cfg()['whatsapp_phone_number_id'] ?? '1340013275870491')
    );
    return [
        'token' => trim($token),
        'phone_number_id' => trim($phoneId) !== '' ? trim($phoneId) : '1340013275870491',
    ];
}

/**
 * Envía un texto por WhatsApp Cloud API.
 *
 * @return array{ok: bool, http_code: int, error?: string, response?: array}
 */
function send_whatsapp_text(string $to, string $body): array
{
    $to = preg_replace('/\D+/', '', $to) ?? '';
    $body = trim($body);
    if ($to === '' || $body === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Destino o mensaje vacío'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible en el servidor'];
    }

    $creds = whatsapp_credentials();
    if ($creds['token'] === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'Falta WHATSAPP_TOKEN (config.php o variable de entorno)',
        ];
    }

    $url = 'https://graph.facebook.com/v21.0/' . rawurlencode($creds['phone_number_id']) . '/messages';
    $payload = json_encode([
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $to,
        'type' => 'text',
        'text' => [
            'preview_url' => false,
            'body' => $body,
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $creds['token'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red: ' . $curlError];
    }

    $decoded = is_string($response) ? json_decode($response, true) : null;
    if ($httpCode >= 200 && $httpCode < 300) {
        return [
            'ok' => true,
            'http_code' => $httpCode,
            'response' => is_array($decoded) ? $decoded : [],
        ];
    }

    $metaMsg = '';
    if (is_array($decoded)) {
        $metaMsg = (string) ($decoded['error']['message'] ?? $decoded['error']['error_user_msg'] ?? '');
    }
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => $metaMsg !== '' ? $metaMsg : ('Meta HTTP ' . $httpCode),
        'response' => is_array($decoded) ? $decoded : [],
    ];
}

/**
 * Fallback: despacha la alerta vía webhook n8n (usa la credencial WhatsApp de n8n).
 *
 * @return array{ok: bool, http_code: int, error?: string}
 */
function send_whatsapp_via_n8n_demo(string $to, string $body, array $extra = []): array
{
    $to = preg_replace('/\D+/', '', $to) ?? '';
    $body = trim($body);
    if ($to === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Destino vacío'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible en el servidor'];
    }

    $url = trim((string) (
        getenv('N8N_DEMO_ALERT_URL')
        ?: ($_SERVER['N8N_DEMO_ALERT_URL'] ?? $_ENV['N8N_DEMO_ALERT_URL'] ?? cfg()['n8n_demo_alert_url'] ?? '')
    ));
    if ($url === '') {
        $url = 'https://n8n.kinesica.com.ar/webhook/clara-demo-alert';
    }
    $secret = trim((string) (cfg()['webhook_secret'] ?? ''));
    if ($secret === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta webhook_secret en config.php'];
    }

    $payloadArr = array_merge([
        'to' => $to,
        'body' => $body,
        'source' => 'admin-simulator',
    ], $extra);
    $payload = json_encode($payloadArr, JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Webhook-Secret: ' . $secret,
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red n8n: ' . $curlError];
    }
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true, 'http_code' => $httpCode];
    }
    $snippet = is_string($response) ? substr($response, 0, 200) : '';
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => 'n8n HTTP ' . $httpCode . ($snippet !== '' ? (': ' . $snippet) : ''),
    ];
}

function send_whatsapp_alert(string $to, string $body): array
{
    return send_whatsapp_alert_payload(['to' => $to, 'body' => $body]);
}

/**
 * Alerta con campos de plantilla (tpl_*) para el webhook n8n / Graph template.
 *
 * @param array{to:string,body?:string,tpl_patient?:string,tpl_whatsapp?:string,tpl_motivo?:string,tpl_detalle?:string,tpl_btn_phone?:string} $payload
 * @return array{ok: bool, http_code: int, error?: string, via?: string}
 */
function send_whatsapp_alert_payload(array $payload): array
{
    $to = preg_replace('/\D+/', '', (string) ($payload['to'] ?? '')) ?? '';
    $body = trim((string) ($payload['body'] ?? ''));
    $extra = [];
    foreach (['tpl_patient', 'tpl_whatsapp', 'tpl_motivo', 'tpl_detalle', 'tpl_btn_phone'] as $k) {
        if (isset($payload[$k]) && trim((string) $payload[$k]) !== '') {
            $extra[$k] = trim((string) $payload[$k]);
        }
    }

    $creds = whatsapp_credentials();
    if ($creds['token'] !== '') {
        if ($extra !== []) {
            $direct = send_whatsapp_template_alert($to, $extra);
            $direct['via'] = 'graph-template';
            return $direct;
        }
        $direct = send_whatsapp_text($to, $body);
        $direct['via'] = 'graph';
        return $direct;
    }
    $viaN8n = send_whatsapp_via_n8n_demo($to, $body !== '' ? $body : 'alerta', $extra);
    $viaN8n['via'] = 'n8n';
    return $viaN8n;
}
