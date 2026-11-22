<?php
declare(strict_types=1);

/**
 * Revalidación de turnos en Google Calendar antes de enviar recordatorios (TC-50).
 * Fuente de verdad: GAS action=check_events sobre el calendario consultorio.
 */

require_once __DIR__ . '/campana_turnos_campana_default_date_range.php';

/**
 * Consulta GAS check_events.
 *
 * @param list<string> $calendarEventIds
 * @return array{
 *   ok:bool,
 *   events?:array<string,array{exists:bool,cancelled:bool,title:string}>,
 *   error?:string,
 *   http_code?:int
 * }
 */
function recordatorios_verify_calendar_events(array $calendarEventIds): array
{
    $ids = [];
    $seen = [];
    foreach ($calendarEventIds as $raw) {
        $id = trim((string) $raw);
        if ($id === '' || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $ids[] = $id;
        if (count($ids) >= 100) {
            break;
        }
    }
    if ($ids === []) {
        return ['ok' => true, 'events' => []];
    }

    $gasUrl = campana_gas_url();
    $secret = campana_gas_secret();
    if ($gasUrl === '' || $gasUrl === 'none') {
        return ['ok' => false, 'error' => 'GAS URL no disponible'];
    }
    if ($secret === '') {
        return ['ok' => false, 'error' => 'Falta gas_api_secret / webhook_secret'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'cURL no disponible'];
    }

    $payload = [
        'action' => 'check_events',
        'calendar_event_ids' => $ids,
        'secret' => $secret,
    ];

    $ch = curl_init($gasUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);

    if ($err || !is_string($raw)) {
        return ['ok' => false, 'error' => $err ?: 'Sin respuesta de GAS', 'http_code' => $httpCode];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Respuesta inválida de GAS', 'http_code' => $httpCode];
    }
    if (($decoded['status'] ?? '') !== 'success') {
        $msg = (string) ($decoded['message'] ?? 'Error GAS check_events');
        if (stripos($msg, 'no reconocida') !== false) {
            $msg = 'El Apps Script en producción todavía no tiene check_events. '
                . 'Redeploy booking/gas (npm run gas:deploy).';
        }
        return ['ok' => false, 'error' => $msg, 'http_code' => $httpCode];
    }

    $rawEvents = $decoded['events'] ?? [];
    if (!is_array($rawEvents)) {
        $rawEvents = [];
    }
    $events = [];
    foreach ($ids as $id) {
        $row = is_array($rawEvents[$id] ?? null) ? $rawEvents[$id] : [];
        $events[$id] = [
            'exists' => !empty($row['exists']),
            'cancelled' => !empty($row['cancelled']),
            'title' => trim((string) ($row['title'] ?? '')),
        ];
    }

    return ['ok' => true, 'events' => $events, 'http_code' => $httpCode];
}

/**
 * ¿Se puede enviar un recordatorio para este calendar_event_id?
 *
 * @return array{ok:bool,reason:string,title?:string}
 */
function recordatorios_calendar_event_is_sendable(string $calendarEventId): array
{
    $calId = trim($calendarEventId);
    if ($calId === '') {
        return ['ok' => false, 'reason' => 'missing_event_id'];
    }
    if (str_starts_with($calId, 'test:')) {
        return ['ok' => true, 'reason' => 'test'];
    }

    $verify = recordatorios_verify_calendar_events([$calId]);
    if (empty($verify['ok'])) {
        return ['ok' => false, 'reason' => 'calendar_unverified'];
    }
    $row = $verify['events'][$calId] ?? null;
    if (!is_array($row)) {
        return ['ok' => false, 'reason' => 'event_gone'];
    }
    if (empty($row['exists'])) {
        return ['ok' => false, 'reason' => 'event_gone', 'title' => ''];
    }
    if (!empty($row['cancelled'])) {
        return [
            'ok' => false,
            'reason' => 'cancelled',
            'title' => (string) ($row['title'] ?? ''),
        ];
    }
    return [
        'ok' => true,
        'reason' => 'ok',
        'title' => (string) ($row['title'] ?? ''),
    ];
}

/**
 * Mapa alive + reasons para el bot n8n (action=check_alive).
 *
 * @param list<string> $calendarEventIds
 * @return array{ok:bool,alive:array<string,bool>,reasons:array<string,string>,error?:string}
 */
function recordatorios_check_alive_map(array $calendarEventIds): array
{
    $ids = [];
    $seen = [];
    foreach ($calendarEventIds as $raw) {
        $id = trim((string) $raw);
        if ($id === '' || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $ids[] = $id;
        if (count($ids) >= 100) {
            break;
        }
    }

    $alive = [];
    $reasons = [];
    if ($ids === []) {
        return ['ok' => true, 'alive' => $alive, 'reasons' => $reasons];
    }

    $tests = [];
    $toVerify = [];
    foreach ($ids as $id) {
        if (str_starts_with($id, 'test:')) {
            $tests[$id] = true;
            $alive[$id] = true;
            $reasons[$id] = 'test';
        } else {
            $toVerify[] = $id;
        }
    }

    if ($toVerify === []) {
        return ['ok' => true, 'alive' => $alive, 'reasons' => $reasons];
    }

    $verify = recordatorios_verify_calendar_events($toVerify);
    if (empty($verify['ok'])) {
        foreach ($toVerify as $id) {
            $alive[$id] = false;
            $reasons[$id] = 'calendar_unverified';
        }
        return [
            'ok' => false,
            'alive' => $alive,
            'reasons' => $reasons,
            'error' => (string) ($verify['error'] ?? 'calendar_unverified'),
        ];
    }

    foreach ($toVerify as $id) {
        $row = $verify['events'][$id] ?? null;
        if (!is_array($row) || empty($row['exists'])) {
            $alive[$id] = false;
            $reasons[$id] = 'event_gone';
            continue;
        }
        if (!empty($row['cancelled'])) {
            $alive[$id] = false;
            $reasons[$id] = 'cancelled';
            continue;
        }
        $alive[$id] = true;
        $reasons[$id] = 'ok';
    }

    return ['ok' => true, 'alive' => $alive, 'reasons' => $reasons];
}
