<?php
declare(strict_types=1);

/**
 * Kinésica — Instagram Direct Messaging (Meta Graph API).
 * - Perfil conectado (instagram_basic) para mostrar @kinesicabrude en /admin/interacciones.
 * - Envío de respuestas en vivo (instagram_manage_messages) desde /admin/interacciones.
 */

require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_interacciones_store.php';

/**
 * @return array{user_id:string,token:string,api_base:string}
 */
function ig_dm_credentials(): array
{
    $c = cfg();
    $userId = trim((string) ($c['instagram_user_id'] ?? ''));
    $token = trim((string) ($c['instagram_dm_token'] ?? ''));
    if ($token === '') {
        try {
            $token = trim((string) (ig_token_get()['token'] ?? ''));
        } catch (Throwable $e) {
            $token = trim((string) ($c['instagram_token'] ?? ''));
        }
    }
    $apiBase = rtrim((string) ($c['instagram_api_base'] ?? 'https://graph.facebook.com/v21.0'), '/');
    return [
        'user_id' => $userId,
        'token' => $token,
        'api_base' => $apiBase,
    ];
}

/**
 * Obtiene metadatos básicos de la cuenta profesional conectada (instagram_basic).
 * Cacheado 10 minutos en archivo temporal para no ralentizar la carga de /admin/interacciones.
 *
 * @return array{configured:bool,id:string,username:string,name:string,source:string}
 */
function ig_dm_account_profile(): array
{
    $creds = ig_dm_credentials();
    $fallback = [
        'configured' => $creds['user_id'] !== '' && $creds['token'] !== '',
        'id' => $creds['user_id'],
        'username' => 'kinesicabrude',
        'name' => 'Kinésica Brude',
        'source' => 'config',
    ];
    if ($creds['user_id'] === '' || $creds['token'] === '') {
        return $fallback;
    }

    $cacheFile = rtrim(sys_get_temp_dir(), '/') . '/kinesica_ig_profile_' . md5($creds['user_id']) . '.json';
    if (is_file($cacheFile) && (time() - (int) @filemtime($cacheFile)) < 600) {
        $cached = json_decode((string) @file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['username'])) {
            return $cached;
        }
    }

    $url = $creds['api_base'] . '/' . rawurlencode($creds['user_id'])
        . '?' . http_build_query([
            'fields' => 'id,username,name',
            'access_token' => $creds['token'],
        ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($raw === false || $httpCode < 200 || $httpCode >= 300) {
        return $fallback;
    }
    $data = json_decode((string) $raw, true);
    if (!is_array($data) || empty($data['username'])) {
        return $fallback;
    }

    $profile = [
        'configured' => true,
        'id' => (string) ($data['id'] ?? $creds['user_id']),
        'username' => (string) $data['username'],
        'name' => (string) ($data['name'] ?? 'Kinésica Brude'),
        'source' => 'graph_api',
    ];
    @file_put_contents($cacheFile, json_encode($profile, JSON_UNESCAPED_UNICODE));
    return $profile;
}

/**
 * Envía un mensaje de texto por Instagram Direct usando Graph API (instagram_manage_messages).
 *
 * @return array{ok:bool,http_code:int,message_id?:string,error?:string,response?:array}
 */
function ig_dm_send_text(string $recipientIgId, string $text): array
{
    $recipient = preg_replace('/^ig_/', '', trim($recipientIgId)) ?? '';
    $recipient = preg_replace('/[^A-Za-z0-9_.]/', '', $recipient) ?? '';
    $body = trim($text);
    if ($recipient === '' || $body === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Destinatario o mensaje vacío'];
    }

    $creds = ig_dm_credentials();
    if ($creds['user_id'] === '' || $creds['token'] === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta instagram_user_id o instagram_token en config.php'];
    }

    $url = $creds['api_base'] . '/' . rawurlencode($creds['user_id']) . '/messages';
    $payload = json_encode([
        'recipient' => ['id' => $recipient],
        'message' => ['text' => $body],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $creds['token'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $raw = curl_exec($ch);
    $curlErr = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($raw === false) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Error de red con Meta: ' . $curlErr];
    }

    $data = json_decode((string) $raw, true);
    if ($httpCode < 200 || $httpCode >= 300 || !is_array($data) || isset($data['error'])) {
        $msg = is_array($data['error'] ?? null)
            ? (string) ($data['error']['message'] ?? 'Error de Meta Graph API')
            : ('HTTP ' . $httpCode);
        return [
            'ok' => false,
            'http_code' => $httpCode,
            'error' => 'Instagram: ' . $msg,
            'response' => is_array($data) ? $data : [],
        ];
    }

    return [
        'ok' => true,
        'http_code' => $httpCode,
        'message_id' => (string) ($data['message_id'] ?? ''),
        'response' => $data,
    ];
}

/**
 * Envía una respuesta por Instagram Direct y la registra en el hilo de interaccion_eventos.
 *
 * @return array{ok:bool,channel:string,wa_id:string,http_code?:int,message_id?:string,event_key?:string,body?:string,ts?:int,error?:string}
 */
function ig_dm_reply(string $waId, string $body, string $actor = '', ?PDO $pdo = null): array
{
    $rawId = preg_replace('/^ig_/', '', trim($waId)) ?? '';
    $recipient = preg_replace('/[^A-Za-z0-9_.]/', '', $rawId) ?? '';
    $normalizedWa = 'ig_' . $recipient;
    $text = trim($body);
    if ($recipient === '' || $text === '') {
        return ['ok' => false, 'channel' => 'instagram', 'wa_id' => $normalizedWa, 'error' => 'Destinatario o mensaje inválido'];
    }

    $send = ig_dm_send_text($recipient, $text);
    if (empty($send['ok'])) {
        return [
            'ok' => false,
            'channel' => 'instagram',
            'wa_id' => $normalizedWa,
            'http_code' => (int) ($send['http_code'] ?? 0),
            'error' => (string) ($send['error'] ?? 'No se pudo enviar por Instagram Direct'),
        ];
    }

    $pdo = $pdo ?? db();
    interacciones_ensure_schema($pdo);
    $mid = (string) ($send['message_id'] ?? '');
    $ts = time();
    $eventKey = $mid !== ''
        ? ('ig:' . (strlen($mid) <= 90 ? $mid : sha1($mid)))
        : ('ig:admin-reply-' . bin2hex(random_bytes(8)));

    $ev = [
        'event_key' => $eventKey,
        'wa_id' => $normalizedWa,
        'direction' => 'clara',
        'body' => $text,
        'ts' => $ts,
        'patient_name' => '',
        'source' => 'instagram',
        'exec_id' => null,
        'media_id' => null,
        'media_type' => null,
        'media_mime' => null,
        'media_filename' => null,
    ];
    try {
        interacciones_insert_event($pdo, $ev);
    } catch (Throwable $e) {
        error_log('ig_dm_reply insert error: ' . $e->getMessage());
    }

    return [
        'ok' => true,
        'channel' => 'instagram',
        'wa_id' => $normalizedWa,
        'http_code' => (int) ($send['http_code'] ?? 200),
        'message_id' => $mid,
        'event_key' => $eventKey,
        'body' => $text,
        'ts' => $ts,
    ];
}
