<?php
declare(strict_types=1);

/**
 * HTTP recordatorios.
 */
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');

if ($method === 'POST' && in_array($action, ['ingest', 'reconcile', 'check_sent', 'check_alive'], true) && recordatorios_bot_authenticated()) {
    if ($action === 'ingest') {
        recordatorios_handle_ingest($input);
    }
    if ($action === 'check_sent') {
        $ids = $input['calendar_event_ids'] ?? [];
        if (!is_array($ids)) {
            json_out(400, ['error' => 'calendar_event_ids debe ser un arreglo']);
        }
        $appt = isset($input['appointment_date']) && is_string($input['appointment_date'])
            ? trim($input['appointment_date'])
            : null;
        $phones = $input['phones'] ?? $input['wa_ids'] ?? [];
        $items = $input['items'] ?? [];
        $phoneByEventId = [];
        $nameByEventId = [];
        $nameByPhone = [];
        if (is_array($items)) {
            foreach ($items as $it) {
                if (!is_array($it) || empty($it['calendar_event_id']) || empty($it['wa_id'])) {
                    continue;
                }
                $cal = trim((string) $it['calendar_event_id']);
                $wa = trim((string) $it['wa_id']);
                $phoneByEventId[$cal] = $wa;
                $nm = trim((string) ($it['patient_name'] ?? ''));
                if ($nm !== '') {
                    $nameByEventId[$cal] = $nm;
                    $nameByPhone[$wa] = $nm;
                }
            }
        }
        $sentIds = recordatorios_check_sent_map($ids, $appt, null, $phoneByEventId, $nameByEventId);
        $sentPhones = is_array($phones) && $phones !== []
            ? recordatorios_check_sent_phones_map($phones, $appt, null, $nameByPhone)
            : [];
        $sentPhonePeople = [];
        try {
            foreach (recordatorios_fetch_sent_phone_people($appt) as $person) {
                $sentPhonePeople[] = [
                    'wa_id' => $person['digits'],
                    'patient_name' => $person['name'],
                ];
            }
        } catch (Throwable $e) {
            $sentPhonePeople = [];
        }
        json_out(200, [
            'ok' => true,
            'sent' => $sentIds,
            'sent_phones' => $sentPhones,
            'sent_phone_people' => $sentPhonePeople,
        ]);
    }
    if ($action === 'check_alive') {
        $ids = $input['calendar_event_ids'] ?? [];
        if (!is_array($ids)) {
            json_out(400, ['error' => 'calendar_event_ids debe ser un arreglo']);
        }
        $map = recordatorios_check_alive_map($ids);
        json_out(200, [
            'ok' => !empty($map['ok']),
            'alive' => $map['alive'] ?? [],
            'reasons' => $map['reasons'] ?? [],
        ] + (isset($map['error']) ? ['error' => $map['error']] : []));
    }
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($method === 'POST' && $action === 'ingest') {
    json_out(401, ['error' => 'No autorizado']);
}
if ($method === 'POST' && $action === 'check_sent') {
    json_out(401, ['error' => 'No autorizado']);
}
if ($method === 'POST' && $action === 'check_alive') {
    json_out(401, ['error' => 'No autorizado']);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    $house = !empty($_GET['sync']) ? recordatorios_run_housekeeping(true) : ['reconcile' => null];
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : RECORDATORIOS_DEFAULT_DAYS;
        $view = recordatorios_load_view(null, $days);
    } catch (Throwable $e) {
        error_log('recordatorios GET: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        json_out(503, [
            'error' => 'No se pudieron cargar los recordatorios',
            'detail' => $e->getMessage(),
        ]);
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
        json_error(400, 'ID de recordatorio inválido', 'user_input', 'INVALID_RECORDATORIO_ID', 'Seleccioná un turno válido de la lista.');
    }
    $res = recordatorios_save_contact($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    json_error_from($res, 400, 'No se pudo guardar el contacto', 'SAVE_CONTACT_FAILED');
}

if ($action === 'create_test_case' || $action === 'seed_test') {
    $res = recordatorios_create_manual_test_case($auth, is_array($input) ? $input : []);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    $is403 = isset($res['error']) && str_contains((string) $res['error'], 'Solo admin');
    json_error_from(
        $res,
        $is403 ? 403 : 400,
        'No se pudo crear el caso de prueba',
        $is403 ? 'ADMIN_REQUIRED' : 'TEST_CASE_FAILED',
        $is403 ? 'auth' : 'user_input'
    );
}

if ($action === 'dispatch' || $action === 'retry' || $action === 'send_manual') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_error(400, 'ID de recordatorio inválido', 'user_input', 'INVALID_RECORDATORIO_ID', 'Seleccioná un turno válido de la lista.');
    }
    try {
        $res = recordatorios_dispatch_manual($id, $input, $auth);
        if (!empty($res['ok'])) {
            json_out(200, $res);
        } else {
            json_error_from($res, 400, 'No se pudo procesar el envío', 'DISPATCH_ERROR');
        }
    } catch (Throwable $e) {
        $meta = kinesica_classify_exception($e, null, 'el envío', 'DISPATCH');
        error_log(
            'recordatorios dispatch error [' . $meta['error_id'] . ']: '
            . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine()
        );
        json_error(
            500,
            $meta['error'],
            $meta['error_category'],
            $meta['error_code'],
            $meta['hint'],
            ['error_id' => $meta['error_id']]
        );
    }
}

json_out(400, ['error' => 'Acción no soportada']);
