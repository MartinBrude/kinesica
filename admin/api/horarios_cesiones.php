<?php
declare(strict_types=1);

/**
 * Endpoint REST para administración de cesiones de tiempo y cierres de consultorio.
 * Soporta listado, creación, revocación y chequeo previo de turnos agendados.
 *
 * Docs: docs/etapa8-config-gastos.md
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/kinesica_settings_storage.php';
require_once __DIR__ . '/lib_horarios_cesiones.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    require_header();
    $auth = require_auth();

    $settings = kinesica_settings_load();
    $overrides = is_array($settings['schedule_overrides'] ?? null) ? $settings['schedule_overrides'] : [];

    // Chequeo opcional de turnos en conflicto si se pasa check_conflicts=1
    $checkConflicts = (string) ($_GET['check_conflicts'] ?? '') === '1';
    $conflicts = [];
    if ($checkConflicts) {
        $sDate = trim((string) ($_GET['start_date'] ?? ''));
        $eDate = trim((string) ($_GET['end_date'] ?? $sDate));
        $pid = trim((string) ($_GET['practitioner_id'] ?? ''));
        if (is_valid_iso_date($sDate) && is_valid_iso_date($eDate)) {
            $pdo = kinesica_settings_pdo();
            if ($pdo instanceof PDO) {
                $conflicts = fetch_conflicting_turnos($pdo, $sDate, $eDate, $pid !== '' ? $pid : null);
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'overrides' => array_values($overrides),
        'conflicts' => $conflicts,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    require_header();
    $auth = require_auth();
    if (function_exists('is_colaborador') && is_colaborador($auth)) {
        json_out(403, ['status' => 'error', 'message' => 'Acceso denegado']);
    }

    $input = read_json();
    $action = strtolower(trim((string) ($input['action'] ?? 'create')));
    $userName = (string) ($auth['name'] ?? $auth['username'] ?? 'admin');

    if ($action === 'check_conflicts') {
        $sDate = trim((string) ($input['start_date'] ?? ''));
        $eDate = trim((string) ($input['end_date'] ?? $sDate));
        $pid = trim((string) ($input['practitioner_id'] ?? ''));
        $conflicts = [];
        if (is_valid_iso_date($sDate) && is_valid_iso_date($eDate)) {
            $pdo = kinesica_settings_pdo();
            if ($pdo instanceof PDO) {
                $conflicts = fetch_conflicting_turnos($pdo, $sDate, $eDate, $pid !== '' ? $pid : null);
            }
        }
        json_out(200, ['status' => 'success', 'conflicts' => $conflicts]);
    }

    if ($action === 'create') {
        $val = validate_schedule_override($input);
        if (!$val['isValid'] || $val['normalized'] === null) {
            json_out(422, [
                'status' => 'error',
                'message' => 'Datos de cesión o cierre inválidos.',
                'errors' => $val['errors'],
            ]);
        }
        $newOverride = $val['normalized'];
        $newOverride['created_by'] = $userName;

        $saved = kinesica_update_settings(static function (array $raw) use ($newOverride): array {
            $list = is_array($raw['schedule_overrides'] ?? null) ? $raw['schedule_overrides'] : [];
            $filtered = [];
            foreach ($list as $item) {
                if (is_array($item) && ($item['id'] ?? '') !== $newOverride['id']) {
                    $filtered[] = $item;
                }
            }
            $filtered[] = $newOverride;
            $raw['schedule_overrides'] = array_values($filtered);
            return $raw;
        }, $userName);

        $currentOverrides = is_array($saved['schedule_overrides'] ?? null) ? $saved['schedule_overrides'] : [];
        json_out(200, [
            'status' => 'success',
            'message' => 'Excepción de horario registrada correctamente.',
            'override' => $newOverride,
            'overrides' => array_values($currentOverrides),
        ]);
    }

    if ($action === 'revoke' || $action === 'anular' || $action === 'delete') {
        $targetId = trim((string) ($input['id'] ?? ''));
        if ($targetId === '') {
            json_out(400, ['status' => 'error', 'message' => 'Se requiere el identificador de la excepción.']);
        }

        $saved = kinesica_update_settings(static function (array $raw) use ($targetId, $action, $userName): array {
            $list = is_array($raw['schedule_overrides'] ?? null) ? $raw['schedule_overrides'] : [];
            $updated = [];
            foreach ($list as $item) {
                if (!is_array($item)) continue;
                if (($item['id'] ?? '') === $targetId) {
                    if ($action === 'revoke' || $action === 'anular') {
                        $item['active'] = false;
                        $item['annulled_at'] = gmdate('Y-m-d\TH:i:s\Z');
                        $item['annulled_by'] = $userName;
                        $updated[] = $item;
                    }
                    // Si es delete, no se agrega
                } else {
                    $updated[] = $item;
                }
            }
            $raw['schedule_overrides'] = array_values($updated);
            return $raw;
        }, $userName);

        $currentOverrides = is_array($saved['schedule_overrides'] ?? null) ? $saved['schedule_overrides'] : [];
        json_out(200, [
            'status' => 'success',
            'message' => ($action === 'delete') ? 'Registro eliminado correctamente.' : 'Excepción anulada correctamente.',
            'overrides' => array_values($currentOverrides),
        ]);
    }

    json_out(400, ['status' => 'error', 'message' => "Acción '{$action}' no reconocida."]);
}

json_out(405, ['status' => 'error', 'message' => 'Método no permitido.']);
