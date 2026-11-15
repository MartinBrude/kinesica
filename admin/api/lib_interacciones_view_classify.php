<?php
declare(strict_types=1);

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
    // Título Meta ("Confirmo", "Confirmo, asistiré") y variantes cortas.
    return (bool) preg_match('/^confirm[oa](?:r)?(?: el turno)?(?:(?:\s+que)?\s+asistire)?$/u', $plain);
}

/**
 * Hilos de diagnóstico / opciones PRUEBA que no deben quedar pendientes en el panel.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_diagnostic_noise(array $messages, string $patientName = ''): bool
{
    if (preg_match('/^test$/iu', trim($patientName))) {
        return true;
    }
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
 * Hilo de confirmación de recordatorio: el último mensaje del paciente es "Confirmo…".
 * Así no queda Pendiente aunque haya escrito algo antes el mismo día.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_turn_confirmation(array $messages): bool
{
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

/** @return array{0:string,1:string} [category, label] */
function interacciones_classify(string $firstPatientBody, string $waId): array
{
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
    if (interacciones_known_name($waId) !== '') {
        return ['prueba_admin', '🧪 Prueba Técnica'];
    }
    return ['consulta_general', 'Consulta WhatsApp'];
}

function interacciones_iso(?string $utc): ?string
{
    return ($utc === null || $utc === '') ? null : str_replace(' ', 'T', $utc) . 'Z';
}

