<?php
declare(strict_types=1);

/**
 * Resolución de nombre de paciente para interacciones (confirmación de recordatorio).
 * Cascada: calendar_event_id → recordatorio por teléfono → directorio.
 */

require_once __DIR__ . '/lib_interacciones_view_names.php';

/** @return bool */
function interacciones_recordatorio_table_exists(PDO $pdo): bool
{
    try {
        $exists = $pdo->query("SHOW TABLES LIKE 'recordatorio_eventos'");
        return $exists !== false && (bool) $exists->fetchColumn();
    } catch (Throwable) {
        return false;
    }
}

/**
 * Sanitiza un calendar_event_id / reminder_event_id (hint o payload).
 */
function interacciones_sanitize_calendar_event_id(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '' || !preg_match('/^[A-Za-z0-9_@.\-]{1,200}$/', $raw)) {
        return '';
    }
    return substr($raw, 0, 128);
}

/**
 * Extrae calendar_event_id desde hint explícito o payload confirmar/cancelar_turno:ID.
 */
function interacciones_extract_calendar_event_id(string $body, string $hint = ''): string
{
    $fromHint = interacciones_sanitize_calendar_event_id($hint);
    if ($fromHint !== '') {
        return $fromHint;
    }
    $raw = trim($body);
    if ($raw !== '' && preg_match('/^(?:confirmar|cancelar)_turno:([A-Za-z0-9_@.\-]{1,200})$/i', $raw, $m)) {
        return interacciones_sanitize_calendar_event_id((string) $m[1]);
    }
    return '';
}

/**
 * Nombre desde recordatorio_eventos por calendar_event_id (botón del recordatorio).
 */
function interacciones_lookup_recordatorio_name_by_event_id(PDO $pdo, string $calendarEventId): string
{
    $calId = interacciones_sanitize_calendar_event_id($calendarEventId);
    if ($calId === '' || !interacciones_recordatorio_table_exists($pdo)) {
        return '';
    }
    try {
        $stmt = $pdo->prepare(
            "SELECT patient_name FROM recordatorio_eventos
             WHERE calendar_event_id = :cal
               AND patient_name IS NOT NULL AND TRIM(patient_name) != ''
             ORDER BY id DESC
             LIMIT 1"
        );
        $stmt->execute(['cal' => $calId]);
        $name = trim((string) ($stmt->fetchColumn() ?: ''));
        return $name !== '' ? mb_substr($name, 0, 120, 'UTF-8') : '';
    } catch (Throwable) {
        return '';
    }
}

/**
 * Cascada: event_id del botón → recordatorio por teléfono → directorio pacientes.
 * No inventa nombre desde el perfil de WhatsApp.
 */
function interacciones_resolve_patient_name(
    PDO $pdo,
    string $waId,
    string $body = '',
    string $eventIdHint = ''
): string {
    $calId = interacciones_extract_calendar_event_id($body, $eventIdHint);
    if ($calId !== '') {
        $byEvent = interacciones_lookup_recordatorio_name_by_event_id($pdo, $calId);
        if ($byEvent !== '') {
            return $byEvent;
        }
    }
    $matchKey = interacciones_phone_match_key($waId);
    if ($matchKey === '') {
        return '';
    }
    $reminderNames = interacciones_lookup_recordatorio_names($pdo, [$waId]);
    if (isset($reminderNames[$matchKey]) && is_string($reminderNames[$matchKey]) && $reminderNames[$matchKey] !== '') {
        return $reminderNames[$matchKey];
    }
    $dirNames = interacciones_lookup_directory_names($pdo, [$waId]);
    $dir = $dirNames[$matchKey] ?? '';
    return is_string($dir) ? $dir : '';
}
