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
 * Traduce códigos y respuestas de Meta Cloud API a explicaciones claras en español con categoría y sugerencia.
 *
 * @return array{category: string, user_message: string, hint: string}
 */
function whatsapp_explain_meta_error(int $httpCode, ?int $metaCode, string $rawMsg, string $to): array
{
    switch ($metaCode) {
        case 190:
            return [
                'category' => 'external_service',
                'user_message' => 'El token de acceso de WhatsApp (Meta) expiró o es inválido.',
                'hint' => 'Un administrador debe renovar el token de Meta Cloud API en la configuración del servidor.',
            ];
        case 131030:
            return [
                'category' => 'user_input',
                'user_message' => 'El número (' . $to . ') no pertenece a una cuenta activa de WhatsApp o el destinatario rechazó recibir mensajes de empresas.',
                'hint' => 'Verificá el número con el paciente o enviale el recordatorio por correo electrónico.',
            ];
        case 131047:
            return [
                'category' => 'external_service',
                'user_message' => 'La ventana de conversación de 24 horas está cerrada y se requiere una plantilla de mensajes aprobada.',
                'hint' => 'Asegurate de que la plantilla oficial esté aprobada por Meta.',
            ];
        case 131051:
            return [
                'category' => 'software_logic',
                'user_message' => 'Tipo de mensaje o parámetros no compatibles con la API de WhatsApp.',
                'hint' => 'Hay un desajuste en el formato de llamada a la plantilla de Meta.',
            ];
        case 132000:
            return [
                'category' => 'software_logic',
                'user_message' => 'La plantilla de recordatorio no existe o no fue aprobada en Meta para el idioma configurado.',
                'hint' => 'Verificá el nombre y el idioma de la plantilla en Meta Business Manager.',
            ];
        case 132001:
            return [
                'category' => 'software_logic',
                'user_message' => 'La cantidad o tipo de variables enviadas no coincide con la plantilla aprobada en Meta.',
                'hint' => 'Revisá la cantidad de parámetros configurados en el código respecto de la plantilla de Meta.',
            ];
        case 130429:
        case 80007:
            return [
                'category' => 'external_service',
                'user_message' => 'Límite de mensajes por segundo o diario alcanzado en Meta Cloud API.',
                'hint' => 'Aguardá unos minutos antes de reintentar el envío.',
            ];
        case 100:
            return [
                'category' => 'user_input',
                'user_message' => 'El formato del número de teléfono no es válido para WhatsApp (' . $to . ').',
                'hint' => 'Verificá que el número incluya código de país y de área sin símbolos (ej: 5491144556677).',
            ];
        default:
            if ($httpCode === 401 || $httpCode === 403) {
                return [
                    'category' => 'external_service',
                    'user_message' => 'Acceso denegado o no autorizado en Meta Cloud API (HTTP ' . $httpCode . ').',
                    'hint' => 'Revisá las credenciales y permisos de la aplicación en Meta Developers.',
                ];
            }
            if ($httpCode >= 500) {
                return [
                    'category' => 'external_service',
                    'user_message' => 'Los servidores de WhatsApp (Meta) están experimentando problemas técnicos (HTTP ' . $httpCode . ').',
                    'hint' => 'Reintentá el envío en unos minutos o utilizá el envío por correo electrónico.',
                ];
            }
            $cleanMsg = $rawMsg !== '' ? $rawMsg : ('Error HTTP ' . $httpCode . ' de Meta');
            return [
                'category' => 'external_service',
                'user_message' => 'Meta rechazó el mensaje: ' . $cleanMsg,
                'hint' => 'Revisá el estado del servicio en Ajustes o intentá el envío por correo electrónico.',
            ];
    }
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
    if ($to === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'El número de teléfono de destino está vacío',
            'error_category' => 'user_input',
            'error_code' => 'PHONE_REQUIRED',
            'hint' => 'Ingresá un número de WhatsApp para el paciente.',
            'to' => '',
        ];
    }
    if ($token === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'Falta configurar el token de acceso de WhatsApp en el servidor',
            'error_category' => 'external_service',
            'error_code' => 'META_TOKEN_MISSING',
            'hint' => 'Configurá WHATSAPP_TOKEN en los ajustes del servidor.',
            'to' => $to,
        ];
    }
    if ($phoneId === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'Falta configurar el Phone Number ID de WhatsApp (WHATSAPP_PHONE_NUMBER_ID)',
            'error_category' => 'external_service',
            'error_code' => 'META_PHONE_ID_MISSING',
            'hint' => 'Configurá WHATSAPP_PHONE_NUMBER_ID en los ajustes del servidor.',
            'to' => $to,
        ];
    }
    if (!function_exists('curl_init')) {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'La extensión cURL de PHP no está disponible en el servidor',
            'error_category' => 'infrastructure',
            'error_code' => 'PHP_CURL_MISSING',
            'hint' => 'El servidor web debe tener habilitada la extensión php-curl.',
            'to' => $to,
        ];
    }

    $patient = trim((string) ($data['patient_name'] ?? 'Estimado/a paciente'));
    $tipo = trim((string) ($data['tipo_cita'] ?? 'sesión en el consultorio'));
    $time = trim((string) ($data['formatted_time'] ?? ''));
    $indicaciones = trim((string) ($data['indicaciones'] ?? '📍 Te esperamos en Charcas 3889, 5º, B (Palermo).'));
    $eventId = trim((string) ($data['event_id'] ?? ''));

    // Meta rechaza \n/\r/\t y >4 espacios en params. "|" y U+2028 se ven mal en WhatsApp (�).
    // Aplanar a una sola línea: los saltos del mensaje vienen del texto FIJO de la plantilla Meta.
    $cleanParam = static function (string $text): string {
        $out = str_replace(['\\r\\n', '\\n', '\\r', "\u{2028}", "\u{2029}"], "\n", $text);
        $out = str_replace(["\r\n", "\r"], "\n", $out);
        $out = preg_replace('/\s*\|\s*/u', "\n", $out) ?? $out;
        $parts = preg_split('/\n+/u', $out) ?: [];
        $lines = [];
        foreach ($parts as $part) {
            $line = trim(preg_replace('/[ \t]+/u', ' ', (string) $part) ?? '');
            if ($line !== '') {
                $lines[] = $line;
            }
        }
        return trim(implode(' ', $lines));
    };
    $patient = $cleanParam($patient);
    $tipo = $cleanParam($tipo);
    $time = $cleanParam($time);
    $indicaciones = $cleanParam($indicaciones);

    // Payload de botón: alfanumérico seguro (Meta ≤128; evita fallos con ids raros).
    $safeEventId = preg_replace('/[^A-Za-z0-9_.@-]+/', '_', $eventId) ?? '';
    $safeEventId = substr($safeEventId, 0, 100);
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

    if ($curlError) {
        return [
            'ok' => false,
            'http_code' => $httpCode,
            'error' => 'Fallo de conexión con Meta: ' . $curlError,
            'error_category' => 'infrastructure',
            'error_code' => 'META_NETWORK_ERROR',
            'hint' => 'El servidor no pudo conectar con graph.facebook.com. Revisá la conexión de red.',
            'to' => $to,
        ];
    }
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true, 'http_code' => $httpCode, 'response' => is_string($response) ? $response : '', 'to' => $to];
    }
    $metaMsg = '';
    $metaCode = null;
    if (is_string($response) && $response !== '') {
        $decoded = json_decode($response, true);
        if (is_array($decoded)) {
            $metaMsg = (string) ($decoded['error']['message'] ?? $decoded['error']['error_user_msg'] ?? '');
            $metaCode = isset($decoded['error']['code']) ? (int) $decoded['error']['code'] : null;
            if ($metaCode !== null && $metaMsg !== '') {
                $metaMsg = '#' . $metaCode . ' ' . $metaMsg;
            }
        }
    }
    $explanation = whatsapp_explain_meta_error($httpCode, $metaCode, $metaMsg, $to);
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => $explanation['user_message'],
        'error_category' => $explanation['category'],
        'error_code' => $metaCode !== null ? ('META_' . $metaCode) : ('HTTP_' . $httpCode),
        'hint' => $explanation['hint'],
        'meta_code' => $metaCode,
        'raw_error' => $metaMsg,
        'response' => is_string($response) ? $response : '',
        'to' => $to,
    ];
}
