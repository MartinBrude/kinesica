<?php
declare(strict_types=1);

/**
 * Envío único de invitación a la encuesta anónima por WhatsApp desde el Directorio de Pacientes.
 */
function kinesica_pacientes_send_encuesta_invite(PDO $pdo, array $data): void
{
    $id = (int) ($data['id'] ?? 0);
    require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
    $paciente = kinesica_pacientes_require_alive($pdo, $id);
    if (!empty($paciente['encuesta_enviada'])) {
        json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
    }

    $phone = clean_phone_number((string) ($paciente['telefono'] ?? ''));
    if ($phone === '' || is_placeholder_phone($phone)) {
        json_out(422, ['status' => 'error', 'message' => 'El paciente no tiene un teléfono de WhatsApp válido']);
    }

    // Claim atómico antes del WhatsApp: evita doble envío por doble clic / tabs.
    $claim = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 1 WHERE id = :id AND encuesta_enviada = 0');
    $claim->execute(['id' => $id]);
    if ($claim->rowCount() < 1) {
        json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
    }

    $firstName = trim((string) ($paciente['nombre_pila'] ?? ''));
    if ($firstName === '') {
        $firstName = trim((string) ($paciente['nombre'] ?? ''));
    }
    if ($firstName === '' && !empty($paciente['nombre_completo'])) {
        $parts = preg_split('/\s+/u', trim((string) $paciente['nombre_completo']), 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $firstName = $parts[0] ?? '';
    }
    $saludo = $firstName !== '' ? ('Hola ' . $firstName . '!') : 'Hola!';
    $body = $saludo . "\n"
        . "Te escribo de Kinésica. Nos ayudaría mucho que respondas esta breve encuesta anónima sobre tu experiencia (menos de un minuto):\n"
        . "https://www.kinesica.com.ar/encuesta.html\n"
        . "¡Muchas gracias!";

    $waResult = send_whatsapp_alert_payload([
        'to' => $phone,
        'body' => $body,
        'preview_url' => true,
    ]);
    if (empty($waResult['ok'])) {
        try {
            $release = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 0 WHERE id = :id AND encuesta_enviada = 1');
            $release->execute(['id' => $id]);
        } catch (Throwable $e) {
            error_log('send_encuesta_invite release flag failed: ' . $e->getMessage());
        }
        $err = (string) ($waResult['error'] ?? 'No se pudo enviar el WhatsApp');
        error_log('send_encuesta_invite wa fail id=' . $id . ' http=' . (string) ($waResult['http_code'] ?? '') . ' err=' . $err);
        $waSafe = function_exists('kinesica_whatsapp_client_safe_result')
            ? kinesica_whatsapp_client_safe_result($waResult)
            : [
                'ok' => false,
                'error' => $err,
                'http_code' => isset($waResult['http_code']) ? (int) $waResult['http_code'] : null,
                'via' => $waResult['via'] ?? null,
            ];
        json_out(502, ['status' => 'error', 'message' => $err, 'wa' => $waSafe]);
    }

    json_out(200, ['status' => 'success', 'id' => $id, 'encuesta_enviada' => 1, 'via' => $waResult['via'] ?? null]);
}
