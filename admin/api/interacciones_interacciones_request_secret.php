<?php
declare(strict_types=1);


function interacciones_request_secret(): string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $secret = (string) ($headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '');
    if ($secret === '' && preg_match('/^Bearer\s+(.+)$/i', (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
        $secret = trim($m[1]);
    }
    return $secret;
}


function interacciones_bot_authenticated(): bool
{
    $given = interacciones_request_secret();
    if ($given === '') {
        return false;
    }
    $valid = [];
    foreach (['webhook_secret', 'bot_token'] as $k) {
        $v = trim((string) (cfg()[$k] ?? ''));
        if ($v !== '' && $v !== 'CAMBIAR') {
            $valid[] = $v;
        }
    }
    // Legado solo si se activa EXPLÍCITAMENTE en config.php (nunca hardcodeado en el repo).
    if ((cfg()['allow_legacy_bot_secret'] ?? false) === true) {
        $legacy = trim((string) (cfg()['legacy_bot_secret'] ?? ''));
        if ($legacy !== '' && $legacy !== 'CAMBIAR') {
            $valid[] = $legacy;
        }
    }
    foreach ($valid as $secret) {
        if (hash_equals($secret, $given)) {
            return true;
        }
    }
    return false;
}


function interacciones_ingest_response(array $events, int $invalid): void
{
    if (!$events) {
        json_out(400, ['error' => 'Sin eventos válidos (wa_id, direction patient|clara, body)', 'invalid' => $invalid]);
    }
    $res = interacciones_store_events($events);
    if ($res['failed'] > 0) {
        json_out(500, ['error' => 'No se pudo guardar; reintentar', 'failed' => $res['failed']] + $res);
    }
    json_out(200, ['ok' => true, 'invalid' => $invalid] + $res);
}


function interacciones_handle_ingest(array $input): void
{
    $raw = $input['events'] ?? [];
    if (!is_array($raw) || count($raw) > INTERACCIONES_MAX_BATCH) {
        json_out(413, ['error' => 'events debe ser un arreglo de hasta ' . INTERACCIONES_MAX_BATCH]);
    }
    $events = [];
    $invalid = 0;
    foreach ($raw as $r) {
        $ev = is_array($r) ? interacciones_normalize_event($r, 'push') : null;
        $ev === null ? $invalid++ : $events[] = $ev;
    }
    interacciones_ingest_response($events, $invalid);
}

/** Formato del nodo viejo de n8n: {wa_id, patient_message, clara_reply, patient_name, media_*}. */

/** Formato del nodo viejo de n8n: {wa_id, patient_message, clara_reply, patient_name, media_*}. */
function interacciones_handle_legacy_push(array $input): void
{
    $base = [
        'wa_id' => $input['wa_id'] ?? '',
        'patient_name' => $input['patient_name'] ?? '',
        'message_id' => $input['message_id'] ?? '',
    ];
    $events = [];
    $p = interacciones_normalize_event($base + [
        'direction' => 'patient',
        'body' => $input['patient_message'] ?? '',
        'media_id' => $input['media_id'] ?? $input['attachment_id'] ?? $input['audio_id'] ?? '',
        'media_type' => $input['media_type'] ?? $input['attachment_type'] ?? '',
        'media_mime' => $input['media_mime'] ?? $input['attachment_mime'] ?? '',
        'media_filename' => $input['media_filename'] ?? $input['attachment_filename'] ?? '',
    ], 'legacy-push');
    if ($p !== null) {
        $events[] = $p;
    }
    $c = interacciones_normalize_event($base + ['direction' => 'clara', 'body' => $input['clara_reply'] ?? ''], 'legacy-push');
    if ($c !== null) {
        $events[] = $c;
    }
    interacciones_ingest_response($events, 0);
}


function interacciones_handle_sync_all(array $input): void
{
    $incoming = $input['items'] ?? [];
    if (!is_array($incoming)) {
        json_out(400, ['error' => 'items debe ser un arreglo']);
    }
    $events = interacciones_legacy_items_to_events($incoming, 'sync_all');
    $res = interacciones_store_events($events);
    if ($res['failed'] > 0) {
        json_out(500, ['error' => 'No se pudo guardar; reintentar'] + $res);
    }
    json_out(200, ['ok' => true, 'message' => 'Sincronizado', 'total' => count($events)] + $res);
}

