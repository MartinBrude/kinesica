<?php
declare(strict_types=1);

/**
 * Envía plantilla confirmacion_turno_kinesica (solo texto, sin botones) vía Graph API.
 *
 * Params Meta: {{1}} nombre · {{2}} fecha · {{3}} hora · {{4}} profesional · {{5}} dirección.
 *
 * @param string $to
 * @param array{patient_name?: string, fecha?: string, hora?: string, profesional?: string, direccion?: string, language?: string} $data
 * @return array{ok: bool, http_code: int, error?: string, response?: string, to?: string}
 */
function send_whatsapp_booking_confirmation_template(string $to, array $data): array
{
    $pre = whatsapp_validate_send_prereqs($to);
    if (empty($pre['ok'])) {
        return $pre;
    }
    $to = (string) $pre['to'];
    $token = (string) $pre['token'];
    $phoneId = (string) $pre['phone_number_id'];

    $patient = whatsapp_clean_template_param(trim((string) ($data['patient_name'] ?? 'Estimado/a paciente')));
    $fecha = whatsapp_clean_template_param(trim((string) ($data['fecha'] ?? '')));
    $hora = whatsapp_clean_template_param(trim((string) ($data['hora'] ?? '')));
    $profesional = whatsapp_clean_template_param(trim((string) ($data['profesional'] ?? '')));
    $direccion = whatsapp_clean_template_param(trim((string) ($data['direccion'] ?? '')));

    $preferredLang = trim((string) ($data['language'] ?? 'es_AR')) ?: 'es_AR';
    // Preferir es_AR; si Meta responde 132001 (idioma/nombre inexistente), probar fallbacks.
    $langCandidates = [$preferredLang];
    foreach (['es_AR', 'es', 'en_US', 'en'] as $alt) {
        if (!in_array($alt, $langCandidates, true)) {
            $langCandidates[] = $alt;
        }
    }

    $lastFail = null;
    foreach ($langCandidates as $langCode) {
        $graphBody = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => 'confirmacion_turno_kinesica',
                'language' => ['code' => $langCode],
                'components' => [
                    [
                        'type' => 'body',
                        'parameters' => [
                            ['type' => 'text', 'text' => $patient !== '' ? $patient : 'Estimado/a paciente'],
                            ['type' => 'text', 'text' => $fecha !== '' ? $fecha : '-'],
                            ['type' => 'text', 'text' => $hora !== '' ? $hora : '-'],
                            ['type' => 'text', 'text' => $profesional !== '' ? $profesional : 'Kinésica'],
                            ['type' => 'text', 'text' => $direccion !== '' ? $direccion : 'Charcas 3889, 5º B, Palermo'],
                        ],
                    ],
                ],
            ],
        ];
        $res = whatsapp_graph_post_template($phoneId, $token, $graphBody, $to, 'v21.0', $langCode);
        if (!empty($res['ok'])) {
            return $res;
        }
        $lastFail = $res;
        if (($res['meta_code'] ?? null) !== 132001) {
            break;
        }
    }

    return is_array($lastFail) ? $lastFail : [
        'ok' => false,
        'http_code' => 0,
        'error' => 'No se pudo enviar la plantilla de confirmación',
        'to' => $to,
    ];
}
