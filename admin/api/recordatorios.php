<?php
declare(strict_types=1);

/**
 * API de Recordatorios WhatsApp 24h.
 *  POST action=ingest     outcomes desde n8n (secreto del bot); idempotente
 *  POST action=reconcile  fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  GET                    listado (sesión); colaborador puede leer; housekeeping reconcile
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer el historial.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/lib_recordatorios_n8n.php';

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

function recordatorios_run_housekeeping(bool $force): array
{
    $out = ['reconcile' => null];
    try {
        if (recordatorios_reconcile_due($force ? 10 : 60)) {
            $out['reconcile'] = recordatorios_reconcile(null, 6);
        }
    } catch (Throwable $e) {
        error_log('recordatorios housekeeping: ' . $e->getMessage());
    }
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');

if ($method === 'POST' && in_array($action, ['ingest', 'reconcile'], true) && recordatorios_bot_authenticated()) {
    if ($action === 'ingest') {
        recordatorios_handle_ingest($input);
    }
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($method === 'POST' && $action === 'ingest') {
    json_out(401, ['error' => 'No autorizado']);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    $house = recordatorios_run_housekeeping(!empty($_GET['sync']));
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : RECORDATORIOS_DEFAULT_DAYS;
        $view = recordatorios_load_view(null, $days);
    } catch (Throwable $e) {
        error_log('recordatorios GET: ' . $e->getMessage());
        json_out(503, ['error' => 'Base de datos no disponible']);
    }
    $st = recordatorios_reconcile_state();
    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => $view['total'],
        'days' => $view['days'],
        'counts' => $view['counts'],
        'items' => $view['items'],
        'grouped' => $view['grouped'],
        'sync' => $house['reconcile'],
        'reconcile' => [
            'status' => $st['status'] ?? null,
            'last_run' => $st['last_run'] ?? null,
            'last_ok' => $st['last_ok'] ?? null,
            'imported_last_run' => $st['imported_last_run'] ?? null,
            'message' => $st['message'] ?? null,
            'baseline_ts' => $st['baseline_ts'] ?? null,
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

if (is_colaborador($auth)) {
    json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
}

if ($action === 'reconcile') {
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

json_out(400, ['error' => 'Acción no soportada']);
