<?php
declare(strict_types=1);

/**
 * API de Recordatorios WhatsApp 24h.
 *  POST action=ingest   outcomes desde n8n (secreto del bot); idempotente
 *  GET                  listado (sesión); colaborador puede leer
 * El secreto del bot SOLO sirve para ingestar: nunca para leer el historial.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_view.php';

function recordatorios_request_secret(): string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $secret = (string) ($headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '');
    if ($secret === '' && preg_match('/^Bearer\s+(.+)$/i', (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
        $secret = trim($m[1]);
    }
    return $secret;
}

function recordatorios_bot_authenticated(): bool
{
    $given = recordatorios_request_secret();
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

function recordatorios_handle_ingest(array $input): void
{
    $raw = $input['items'] ?? [];
    if (!is_array($raw) || count($raw) > RECORDATORIOS_MAX_BATCH) {
        json_out(413, ['error' => 'items debe ser un arreglo de hasta ' . RECORDATORIOS_MAX_BATCH]);
    }
    $execId = trim((string) ($input['exec_id'] ?? $input['execution_id'] ?? ''));
    $runAt = recordatorios_parse_run_at($input['run_at'] ?? null, time());
    $items = [];
    $invalid = 0;
    foreach ($raw as $r) {
        if (!is_array($r)) {
            $invalid++;
            continue;
        }
        $n = recordatorios_normalize_item($r, $execId, $runAt);
        if ($n === null) {
            $invalid++;
            continue;
        }
        $items[] = $n;
    }
    if (!$items) {
        json_out(400, ['error' => 'Sin items válidos (status + calendar_event_id o run_skipped)', 'invalid' => $invalid]);
    }
    $res = recordatorios_store_items($items);
    if ($res['failed'] > 0) {
        json_out(500, ['error' => 'No se pudo guardar; reintentar', 'invalid' => $invalid] + $res);
    }
    json_out(200, ['ok' => true, 'invalid' => $invalid] + $res);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');

if ($method === 'POST' && $action === 'ingest' && recordatorios_bot_authenticated()) {
    recordatorios_handle_ingest($input);
}

if ($method === 'POST' && $action === 'ingest') {
    json_out(401, ['error' => 'No autorizado']);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : RECORDATORIOS_DEFAULT_DAYS;
        $view = recordatorios_load_view(null, $days);
    } catch (Throwable $e) {
        error_log('recordatorios GET: ' . $e->getMessage());
        json_out(503, ['error' => 'Base de datos no disponible']);
    }
    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => $view['total'],
        'days' => $view['days'],
        'counts' => $view['counts'],
        'items' => $view['items'],
        'grouped' => $view['grouped'],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

// v1: sin mutaciones de sesión
unset($auth);
json_out(400, ['error' => 'Acción no soportada']);
