<?php
declare(strict_types=1);

/**
 * API de Interacciones (WhatsApp).
 *  GET                      lista (solo lectura salvo importar lo pendiente); requiere sesión
 *  POST action=ingest       eventos desde n8n (secreto del bot); idempotente
 *  POST (sin action)        formato legado del nodo viejo de n8n (secreto del bot)
 *  POST action=sync_all     compatibilidad con el script de sincronización (secreto del bot)
 *  POST action=reconcile    fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  POST archive|unarchive|toggle_answered   solo sesión, no-colaborador; solo cambia flags, nunca borra mensajes
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer conversaciones.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_view.php';
require_once __DIR__ . '/lib_interacciones_state.php';
require_once __DIR__ . '/lib_interacciones_n8n.php';

const INTERACCIONES_LEGACY_SECRET = 'kinesica_webhook_secret_2026';

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
    // Transición: el nodo actual de n8n usa este valor. Desactivar con 'allow_legacy_bot_secret' => false tras rotar.
    if ((cfg()['allow_legacy_bot_secret'] ?? true) !== false) {
        $valid[] = INTERACCIONES_LEGACY_SECRET;
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

/** Formato del nodo viejo de n8n: {wa_id, patient_message, clara_reply, patient_name}. */
function interacciones_handle_legacy_push(array $input): void
{
    $base = ['wa_id' => $input['wa_id'] ?? '', 'patient_name' => $input['patient_name'] ?? ''];
    $events = [];
    $p = interacciones_normalize_event($base + ['direction' => 'patient', 'body' => $input['patient_message'] ?? ''], 'legacy-push');
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

function interacciones_run_housekeeping(bool $force): array
{
    $out = ['spool' => null, 'reconcile' => null];
    try {
        interacciones_migrate_legacy();
        $out['spool'] = interacciones_spool_drain(null, 2);
        interacciones_backup_daily();
        if (interacciones_reconcile_due($force ? 10 : 60)) {
            $out['reconcile'] = interacciones_reconcile(null, 6);
        }
    } catch (Throwable $e) {
        error_log('interacciones housekeeping: ' . $e->getMessage());
    }
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');
$isLegacyPush = $method === 'POST' && $action === '' && isset($input['wa_id']);
$botAction = $method === 'POST' && ($isLegacyPush || in_array($action, ['ingest', 'sync_all', 'reconcile'], true));

if ($botAction && interacciones_bot_authenticated()) {
    if ($action === 'ingest') {
        interacciones_handle_ingest($input);
    }
    if ($action === 'sync_all') {
        interacciones_handle_sync_all($input);
    }
    if ($action === 'reconcile') {
        json_out(200, ['ok' => true] + interacciones_reconcile(null, 8));
    }
    interacciones_handle_legacy_push($input);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    $house = interacciones_run_housekeeping(!empty($_GET['sync']));
    try {
        $view = interacciones_load_view();
        $health = interacciones_health();
    } catch (Throwable $e) {
        error_log('interacciones GET: ' . $e->getMessage());
        json_out(503, ['error' => 'Base de datos no disponible. Los mensajes entrantes se siguen guardando y aparecerán al recuperarse.', 'spool_pending' => interacciones_spool_pending_count()]);
    }
    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => count($view['items']),
        'answered_count' => $view['answered_count'],
        'unanswered_count' => $view['unanswered_count'],
        'archived_count' => $view['archived_count'],
        'items' => $view['items'],
        'interactions' => $view['items'],
        'grouped' => $view['grouped'],
        'health' => $health,
        'sync' => $house['reconcile'],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

// Servidor: allowlist. Colaborador es de solo lectura en TODAS las escrituras.
if (is_colaborador($auth)) {
    json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura y no pueden modificar ni archivar conversaciones.']);
}

if ($action === 'reconcile') {
    json_out(200, ['ok' => true] + interacciones_reconcile(null, 8));
}

if (in_array($action, ['archive', 'unarchive', 'toggle_answered'], true)) {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(400, ['error' => 'id es requerido']);
    }
    if (!interacciones_set_state(db(), $id, $action, (string) ($auth['name'] ?? $auth['username'] ?? ''), (bool) ($input['answered'] ?? false))) {
        json_out(404, ['error' => 'Conversación no encontrada']);
    }
    json_out(200, ['ok' => true, 'id' => $id, 'action' => $action]);
}

json_out(400, ['error' => 'Acción no soportada']);
