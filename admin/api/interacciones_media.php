<?php
declare(strict_types=1);

/**
 * API de Archivos Adjuntos de Interacciones (WhatsApp).
 *  POST (con X-Kinesica-Bot-Secret) -> Recibe y almacena en disco el binario/base64 enviado por n8n.
 *  GET  ?media_id=...               -> Sirve el archivo (inline o attachment con &download=1) a administradores autenticados.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_store.php';

function interacciones_media_bot_authenticated(): bool
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $given = (string) ($headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '');
    if ($given === '' && preg_match('/^Bearer\s+(.+)$/i', (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
        $given = trim($m[1]);
    }
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    if (!interacciones_media_bot_authenticated()) {
        json_out(401, ['error' => 'No autorizado']);
    }
    $input = read_json();
    $res = interacciones_media_save($input);
    $status = (int) ($res['status'] ?? ($res['ok'] ? 200 : 400));
    unset($res['status']);
    json_out($status, $res);
}

if ($method === 'GET') {
    $auth = require_auth();
    $mediaId = (string) ($_GET['media_id'] ?? $_GET['file'] ?? '');
    $resolved = interacciones_media_resolve($mediaId);
    if ($resolved === null || !is_file($resolved['path'])) {
        json_out(404, ['error' => 'Archivo adjunto no disponible o aún en proceso de descarga']);
    }

    $forceDownload = !empty($_GET['download']) && $_GET['download'] !== '0';
    $disposition = $forceDownload ? 'attachment' : 'inline';
    $safeName = str_replace(['"', "\r", "\n", '\\'], '_', $resolved['filename']);

    if (!headers_sent()) {
        header('Content-Type: ' . $resolved['mime_type']);
        header('Content-Length: ' . (string) $resolved['size']);
        header('Content-Disposition: ' . $disposition . '; filename="' . $safeName . '"');
        header('Cache-Control: private, max-age=86400');
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'unsafe-inline'; object-src 'self'");
        header('Accept-Ranges: bytes');
    }
    readfile($resolved['path']);
    exit;
}

json_out(405, ['error' => 'Método no permitido']);
