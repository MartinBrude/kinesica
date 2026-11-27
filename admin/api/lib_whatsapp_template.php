<?php
declare(strict_types=1);

/**
 * Plantillas aprobadas Meta WhatsApp Cloud API (fachada ≤250 líneas).
 * Helpers Meta: lib_whatsapp_meta.php · Confirmación: lib_whatsapp_template_confirmation.php.
 */

require_once __DIR__ . '/lib_whatsapp_meta.php';
require_once __DIR__ . '/lib_whatsapp_template_confirmation.php';

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
    if ($phoneId === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta WHATSAPP_PHONE_NUMBER_ID'];
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

    $res = whatsapp_graph_post_template($phoneId, $token, $graphBody, $to, 'v22.0');
    if (!empty($res['ok'])) {
        return ['ok' => true, 'http_code' => (int) $res['http_code'], 'response' => (string) ($res['response'] ?? '')];
    }
    if (($res['error_code'] ?? '') === 'META_NETWORK_ERROR') {
        return ['ok' => false, 'http_code' => (int) $res['http_code'], 'error' => (string) $res['error']];
    }
    $snippet = substr((string) ($res['response'] ?? ''), 0, 300);
    return [
        'ok' => false,
        'http_code' => (int) $res['http_code'],
        'error' => 'Meta HTTP ' . (int) $res['http_code'] . ($snippet !== '' ? (': ' . $snippet) : ''),
        'response' => (string) ($res['response'] ?? ''),
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
    $pre = whatsapp_validate_send_prereqs($to);
    if (empty($pre['ok'])) {
        return $pre;
    }
    $to = (string) $pre['to'];
    $token = (string) $pre['token'];
    $phoneId = (string) $pre['phone_number_id'];

    $patient = whatsapp_clean_template_param(trim((string) ($data['patient_name'] ?? 'Estimado/a paciente')));
    $tipo = whatsapp_clean_template_param(trim((string) ($data['tipo_cita'] ?? 'sesión en el consultorio')));
    $time = whatsapp_clean_template_param(trim((string) ($data['formatted_time'] ?? '')));
    $indicaciones = whatsapp_clean_template_param(trim((string) ($data['indicaciones'] ?? '📍 Te esperamos en Charcas 3889, 5º, B (Palermo).')));
    $eventId = trim((string) ($data['event_id'] ?? ''));

    // Payload de botón: alfanumérico seguro (Meta ≤128; evita fallos con ids raros).
    $safeEventId = substr(preg_replace('/[^A-Za-z0-9_.@-]+/', '_', $eventId) ?? '', 0, 100);
    $confirmPayload = 'confirmar_turno' . ($safeEventId !== '' ? (':' . $safeEventId) : '');
    $cancelPayload = 'cancelar_turno' . ($safeEventId !== '' ? (':' . $safeEventId) : '');

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

    return whatsapp_graph_post_template($phoneId, $token, $graphBody, $to, 'v21.0');
}
