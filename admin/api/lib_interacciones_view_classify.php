<?php
declare(strict_types=1);

/**
 * True si el texto es una cancelación o pedido de baja/anulación del turno.
 * Estas interacciones TIENEN INMUNIDAD: NUNCA van a respondidas automáticamente.
 */
function interacciones_is_turn_cancellation(string $body): bool
{
    $raw = trim($body);
    if ($raw === '') {
        return false;
    }
    // Payloads explícitos de botones o callbacks
    if (preg_match('/^(?:cancelar_turno|anular_|cancel_keep:)/i', $raw)) {
        return true;
    }
    $plain = mb_strtolower($raw, 'UTF-8');
    $plain = strtr($plain, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    $plain = preg_replace('/[^a-z0-9\s]/u', ' ', $plain) ?? $plain;
    $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? $plain);

    // Cancelar, anular, dar de baja, no puedo asistir/ir, reprogramar
    if (preg_match('/\b(?:cancel(?:o|ar|ame|an|aron|acion|ado|ada|ando)?|anul(?:o|ar|ame|an|aron|acion|ado|ada|ando)?|reprogram(?:ar|o|ame|acion))\b/u', $plain)) {
        return true;
    }
    if (preg_match('/\bno\s+(?:voy\s+a\s+poder|puedo|podre|llego|asisto)\b/u', $plain)) {
        return true;
    }
    if (preg_match('/\bdar\s+de\s+baja\b/u', $plain)) {
        return true;
    }
    return false;
}

/**
 * True si el texto es la confirmación del recordatorio 24h (botón Confirmo / payload).
 * Esas hilos no requieren acción en el panel → van como respondidas.
 */
function interacciones_is_turn_confirmation(string $body): bool
{
    $raw = trim($body);
    if ($raw === '') {
        return false;
    }
    if (preg_match('/^confirmar_turno(?::|$)/i', $raw)) {
        return true;
    }
    $plain = mb_strtolower($raw, 'UTF-8');
    $plain = strtr($plain, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    $plain = preg_replace('/[^a-z0-9\s]/u', ' ', $plain) ?? $plain;
    $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? $plain);
    // Título Meta ("Confirmo", "Confirmo, asistiré") y variantes manuales ("Confirmado", "Sí confirmo", "Confirmo asistencia").
    return (bool) preg_match(
        '/^(?:(?:si|sip|sisi)\s+)?(?:turno\s+)?confirm(?:[oa](?:r)?|ad[oa])(?:(?: el| mi)? turno)?(?:(?:\s+que)?\s+asistire|\s+asistencia)?(?:\s+(?:muchas\s+)?gracias)?$/u',
        $plain
    );
}

/**
 * True si en el hilo de mensajes el paciente solicitó una cancelación o anulación.
 * Si hubo cancelación, tiene prioridad para que nunca quede sepultada en Respondidas.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_turn_cancellation(array $messages): bool
{
    foreach ($messages as $m) {
        if (($m['from'] ?? '') !== 'patient') {
            continue;
        }
        $text = trim((string) ($m['text'] ?? ''));
        if ($text !== '' && interacciones_is_turn_cancellation($text)) {
            return true;
        }
    }
    return false;
}

/**
 * Hilos de diagnóstico / opciones PRUEBA que no deben quedar pendientes en el panel.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_diagnostic_noise(array $messages, string $patientName = ''): bool
{
    $patientTexts = [];
    $claraTexts = [];
    foreach ($messages as $m) {
        $text = trim((string) ($m['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        if (($m['from'] ?? '') === 'patient') {
            $patientTexts[] = $text;
        } elseif (($m['from'] ?? '') === 'clara') {
            $claraTexts[] = $text;
        }
    }
    if (!$patientTexts) {
        return false;
    }
    $allPatientDiagnostic = true;
    foreach ($patientTexts as $text) {
        if (!preg_match('/^test(?:\s+de\s+diagn[oó]stico)?$/iu', $text)
            && !preg_match('/^PRUEBA[-\s]?\d+/iu', $text)) {
            $allPatientDiagnostic = false;
            break;
        }
    }
    if ($allPatientDiagnostic) {
        return true;
    }
    foreach ($claraTexts as $text) {
        if (preg_match('/^respuesta\s+de\s+prueba\b/iu', $text) || preg_match('/\bPRUEBA-\d+/u', $text)) {
            return true;
        }
    }
    return false;
}

/**
 * Hilo de confirmación de recordatorio: el último mensaje del paciente es "Confirmo…",
 * y NO hubo ninguna cancelación en el hilo.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_turn_confirmation(array $messages): bool
{
    if (interacciones_thread_is_turn_cancellation($messages)) {
        return false;
    }
    $lastPatient = '';
    foreach ($messages as $m) {
        if (($m['from'] ?? '') !== 'patient') {
            continue;
        }
        $text = trim((string) ($m['text'] ?? ''));
        if ($text !== '') {
            $lastPatient = $text;
        }
    }
    return $lastPatient !== '' && interacciones_is_turn_confirmation($lastPatient);
}

/**
 * Persiste answered=1 cuando el mensaje entrante es confirmación de turno.
 * La vista también lo deriva; esto alinea badge/counts_only sin re-clasificar.
 */
function interacciones_mark_answered_if_confirmation(PDO $pdo, array $ev): void
{
    if (($ev['direction'] ?? '') !== 'patient') {
        return;
    }
    if (!interacciones_is_turn_confirmation((string) ($ev['body'] ?? ''))) {
        return;
    }
    try {
        require_once __DIR__ . '/lib_relational_interacciones.php';
        require_once __DIR__ . '/lib_interacciones_state.php';
        $key = kinesica_rel_interaccion_conversation_key(
            (string) ($ev['wa_id'] ?? ''),
            (int) ($ev['ts'] ?? time())
        );
        if ($key === '') {
            return;
        }
        interacciones_set_state($pdo, $key, 'toggle_answered', 'auto-confirm', true);
    } catch (Throwable) {
        // No bloquear ingest si falla el flag.
    }
}

/**
 * Reabre la conversación (answered=0) cuando el mensaje entrante del paciente
 * NO es una confirmación de turno (p. ej. cancelación, nueva consulta o audio).
 */
function interacciones_mark_reopened_on_patient_message(PDO $pdo, array $ev): void
{
    if (($ev['direction'] ?? '') !== 'patient') {
        return;
    }
    $body = (string) ($ev['body'] ?? '');
    if (interacciones_is_turn_confirmation($body)) {
        return;
    }
    try {
        require_once __DIR__ . '/lib_relational_interacciones.php';
        require_once __DIR__ . '/lib_interacciones_state.php';
        $key = kinesica_rel_interaccion_conversation_key(
            (string) ($ev['wa_id'] ?? ''),
            (int) ($ev['ts'] ?? time())
        );
        if ($key === '') {
            return;
        }
        interacciones_set_state($pdo, $key, 'toggle_answered', 'inbound-reopen', false);
    } catch (Throwable) {
    }
}

/** @return array{0:string,1:string} [category, label] */
function interacciones_classify(string $firstPatientBody, string $waId, ?array $messages = null): array
{
    if ($messages !== null && interacciones_thread_is_turn_cancellation($messages)) {
        return ['cancelacion_turno', '❌ Cancelación de turno'];
    }
    if (interacciones_is_turn_cancellation($firstPatientBody)) {
        return ['cancelacion_turno', '❌ Cancelación de turno'];
    }
    if ($messages !== null && interacciones_thread_is_turn_confirmation($messages)) {
        return ['confirmacion_turno', '✅ Confirmación de turno'];
    }
    if (interacciones_is_turn_confirmation($firstPatientBody)) {
        return ['confirmacion_turno', '✅ Confirmación de turno'];
    }
    $lower = mb_strtolower($firstPatientBody, 'UTF-8');
    if (strpos($lower, 'osde') !== false || strpos($lower, 'obra social') !== false) {
        return ['cobertura', '💳 Cobertura OSDE / Prepaga'];
    }
    if (strpos($lower, 'precio') !== false || strpos($lower, 'honorario') !== false || $lower === 'c') {
        return ['honorarios', '💰 Honorarios y Aranceles'];
    }
    return ['consulta_general', 'Consulta WhatsApp'];
}

function interacciones_iso(?string $utc): ?string
{
    return ($utc === null || $utc === '') ? null : str_replace(' ', 'T', $utc) . 'Z';
}


