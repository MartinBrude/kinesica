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
    return (bool) preg_match('/^confirm[oa](?:r)?(?: el turno)?$/u', $plain);
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
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_turn_confirmation(array $messages): bool
{
    $patientTexts = [];
    foreach ($messages as $m) {
        if (($m['from'] ?? '') !== 'patient') {
            continue;
        }
        $text = trim((string) ($m['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $patientTexts[] = $text;
    }
    if (!$patientTexts) {
        return false;
    }
    foreach ($patientTexts as $text) {
        if (!interacciones_is_turn_confirmation($text)) {
            return false;
        }
    }
    return true;
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

