<?php
declare(strict_types=1);

/**
 * Kinésica — Webhook de Meta (Instagram Messaging API / Messenger).
 * Recibe eventos de mensajes directos (DMs) de Instagram y los ingesta en la bandeja de Interacciones.
 *
 * GET: Verificación de handshake de Meta (hub.challenge / hub.verify_token).
 * POST: Ingesta de mensajes directos entrantes.
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_store.php';

$c = cfg();
$verifyToken = (string) ($c['meta_webhook_verify_token'] ?? $c['webhook_secret'] ?? 'kinesica_meta_webhook');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = (string) ($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
    $token = (string) ($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
    $challenge = (string) ($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');

    if ($mode === 'subscribe' && $token === $verifyToken && $challenge !== '') {
        header('Content-Type: text/plain; charset=UTF-8');
        echo $challenge;
        exit(0);
    }
    http_response_code(403);
    echo 'Forbidden';
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(0);
}

$rawBody = (string) file_get_contents('php://input');
$appSecret = (string) ($c['meta_app_secret'] ?? '');

if ($appSecret !== '') {
    $headerSig = (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);
    if (!hash_equals($expected, $headerSig)) {
        http_response_code(403);
        echo 'Invalid signature';
        exit(0);
    }
}

$payload = json_decode($rawBody, true);
if (!is_array($payload) || ($payload['object'] ?? '') !== 'instagram') {
    // Meta requiere 200 para eventos desconocidos para no reintentar en bucle
    echo 'EVENT_RECEIVED';
    exit(0);
}

$myIgId = (string) ($c['instagram_user_id'] ?? '');
$pdo = db();
interacciones_ensure_schema($pdo);

foreach ($payload['entry'] ?? [] as $entry) {
    foreach ($entry['messaging'] ?? [] as $msg) {
        $senderId = (string) ($msg['sender']['id'] ?? '');
        $recipientId = (string) ($msg['recipient']['id'] ?? '');
        $message = $msg['message'] ?? null;
        if (!is_array($message)) continue;

        $mid = (string) ($message['mid'] ?? '');
        $text = trim((string) ($message['text'] ?? ''));
        $tsMs = (int) ($msg['timestamp'] ?? (time() * 1000));
        $tsSec = (int) floor($tsMs / 1000);

        $attachments = $message['attachments'] ?? [];
        if ($text === '' && !empty($attachments)) {
            $attType = (string) ($attachments[0]['type'] ?? 'imagen');
            $text = '[' . ucfirst($attType) . ' enviada por Instagram Direct]';
        }
        if ($text === '') continue;

        $isFromUs = ($myIgId !== '' && $senderId === $myIgId);
        $direction = $isFromUs ? 'clara' : 'patient';
        $contactId = $isFromUs ? $recipientId : $senderId;

        $ev = [
            'event_key' => 'ig:' . ($mid !== '' ? $mid : md5($senderId . '|' . $tsSec . '|' . $text)),
            'wa_id' => 'ig_' . $contactId,
            'direction' => $direction,
            'body' => $text,
            'ts' => $tsSec,
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
            error_log('Error ingestando mensaje de Instagram: ' . $e->getMessage());
        }
    }
}

echo 'EVENT_RECEIVED';
