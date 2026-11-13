<?php
declare(strict_types=1);

/**
 * HTTP recordatorios.
 */
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

if ($action === 'save_contact' || $action === 'update_contact') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_out(400, ['error' => 'ID de recordatorio inválido']);
    }
    $res = recordatorios_save_contact($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    json_out(400, $res);
}

if ($action === 'create_test_case' || $action === 'seed_test') {
    $res = recordatorios_create_manual_test_case($auth, is_array($input) ? $input : []);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    json_out(isset($res['error']) && str_contains((string) $res['error'], 'Solo admin') ? 403 : 400, $res);
}

if ($action === 'dispatch' || $action === 'retry' || $action === 'send_manual') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_out(400, ['error' => 'ID de recordatorio inválido']);
    }
    $res = recordatorios_dispatch_manual($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    } else {
        json_out(400, $res);
    }
}

json_out(400, ['error' => 'Acción no soportada']);
