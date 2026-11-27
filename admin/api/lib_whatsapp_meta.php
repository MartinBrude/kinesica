<?php
declare(strict_types=1);

/**
 * Utilidades compartidas de Meta WhatsApp Cloud API (errores, saneamiento, cURL).
 */

/**
 * Traduce códigos y respuestas de Meta Cloud API a explicaciones claras en español.
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
                'user_message' => 'La cantidad o tipo de variables enviadas no coincide con la plantilla aprobada en Meta.',
                'hint' => 'Revisá la cantidad de parámetros configurados en el código respecto de la plantilla de Meta.',
            ];
        case 132001:
            return [
                'category' => 'software_logic',
                'user_message' => 'La plantilla no existe o no está aprobada en Meta para el idioma configurado (nombre + language.code).',
                'hint' => 'En WhatsApp Manager verificá que el nombre exacto esté APPROVED en ese idioma (p. ej. es_AR).',
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
 * Aplana parámetros de plantilla Meta (rechaza \n/\r/\t y >4 espacios; "|" y U+2028 se ven mal).
 */
function whatsapp_clean_template_param(string $text): string
{
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
}

/**
 * Valida teléfono, credenciales y cURL antes de invocar Meta Graph API.
 *
 * @return array<string,mixed>
 */
function whatsapp_validate_send_prereqs(string $to): array
{
    $creds = whatsapp_credentials();
    $token = $creds['token'];
    $phoneId = $creds['phone_number_id'];
    $to = preg_replace('/\D+/', '', $to) ?? '';
    if ($to === '') {
        return [
            'ok' => false, 'http_code' => 0,
            'error' => 'El número de teléfono de destino está vacío',
            'error_category' => 'user_input', 'error_code' => 'PHONE_REQUIRED',
            'hint' => 'Ingresá un número de WhatsApp para el paciente.', 'to' => '',
        ];
    }
    if ($token === '') {
        return [
            'ok' => false, 'http_code' => 0,
            'error' => 'Falta configurar el token de acceso de WhatsApp en el servidor',
            'error_category' => 'external_service', 'error_code' => 'META_TOKEN_MISSING',
            'hint' => 'Configurá WHATSAPP_TOKEN en los ajustes del servidor.', 'to' => $to,
        ];
    }
    if ($phoneId === '') {
        return [
            'ok' => false, 'http_code' => 0,
            'error' => 'Falta configurar el Phone Number ID de WhatsApp (WHATSAPP_PHONE_NUMBER_ID)',
            'error_category' => 'external_service', 'error_code' => 'META_PHONE_ID_MISSING',
            'hint' => 'Configurá WHATSAPP_PHONE_NUMBER_ID en los ajustes del servidor.', 'to' => $to,
        ];
    }
    if (!function_exists('curl_init')) {
        return [
            'ok' => false, 'http_code' => 0,
            'error' => 'La extensión cURL de PHP no está disponible en el servidor',
            'error_category' => 'infrastructure', 'error_code' => 'PHP_CURL_MISSING',
            'hint' => 'El servidor web debe tener habilitada la extensión php-curl.', 'to' => $to,
        ];
    }
    return ['ok' => true, 'to' => $to, 'token' => $token, 'phone_number_id' => $phoneId];
}

/**
 * Ejecuta POST /messages en Graph API y devuelve resultado estructurado con taxonomía Meta.
 *
 * @param array<string,mixed> $graphBody
 * @return array<string,mixed>
 */
function whatsapp_graph_post_template(
    string $phoneId,
    string $token,
    array $graphBody,
    string $to,
    string $version = 'v21.0',
    ?string $langCode = null
): array {
    $url = 'https://graph.facebook.com/' . $version . '/' . rawurlencode($phoneId) . '/messages';
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
            'ok' => false, 'http_code' => $httpCode,
            'error' => 'Fallo de conexión con Meta: ' . $curlError,
            'error_category' => 'infrastructure', 'error_code' => 'META_NETWORK_ERROR',
            'hint' => 'El servidor no pudo conectar con graph.facebook.com. Revisá la conexión de red.',
            'to' => $to,
        ];
    }
    if ($httpCode >= 200 && $httpCode < 300) {
        $okOut = ['ok' => true, 'http_code' => $httpCode, 'response' => is_string($response) ? $response : '', 'to' => $to];
        if ($langCode !== null) {
            $okOut['language'] = $langCode;
        }
        return $okOut;
    }

    $metaMsg = '';
    $metaCode = null;
    $metaDetails = '';
    if (is_string($response) && $response !== '') {
        $decoded = json_decode($response, true);
        if (is_array($decoded)) {
            $metaMsg = (string) ($decoded['error']['message'] ?? $decoded['error']['error_user_msg'] ?? '');
            $metaCode = isset($decoded['error']['code']) ? (int) $decoded['error']['code'] : null;
            $metaDetails = (string) ($decoded['error']['error_data']['details'] ?? '');
            if ($metaCode !== null && $metaMsg !== '') {
                $metaMsg = '#' . $metaCode . ' ' . $metaMsg;
            }
        }
    }
    $explanation = whatsapp_explain_meta_error($httpCode, $metaCode, $metaMsg, $to);
    $fail = [
        'ok' => false, 'http_code' => $httpCode,
        'error' => $explanation['user_message'],
        'error_category' => $explanation['category'],
        'error_code' => $metaCode !== null ? ('META_' . $metaCode) : ('HTTP_' . $httpCode),
        'hint' => $explanation['hint'],
        'meta_code' => $metaCode,
        'raw_error' => $metaMsg,
        'raw_details' => $metaDetails,
        'response' => is_string($response) ? $response : '',
        'to' => $to,
    ];
    if ($langCode !== null) {
        $fail['language'] = $langCode;
    }
    return $fail;
}
