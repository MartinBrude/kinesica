<?php
declare(strict_types=1);
/**
 * One-shot: registra baja María 23/11–11/12 y se autoelimina.
 * No commitear de forma permanente; borrar del repo tras ejecutar.
 */
header('Content-Type: application/json; charset=utf-8');

$expected = '60385d018d90e84def1e9526224761261dadcf97881a94e3';
$got = (string) ($_GET['t'] ?? '');
if ($got === '' || !hash_equals($expected, $got)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/kinesica_settings_storage.php';
require_once __DIR__ . '/lib_horarios_cesiones.php';

$val = validate_schedule_override([
    'id' => 'cov_maria_leave_20261123_1211',
    'action' => 'transfer',
    'from_practitioner' => 'maria',
    'to_practitioner' => 'norberto',
    'period_type' => 'date_range',
    'start_date' => '2026-11-23',
    'end_date' => '2026-12-11',
    'time_scope' => 'all_day',
    'practitioner_on_leave' => true,
    'reason' => 'Viaje María (pasajes)',
    'created_by' => 'auto-deploy',
]);

if (!$val['isValid'] || $val['normalized'] === null) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'errors' => $val['errors']], JSON_UNESCAPED_UNICODE);
    exit;
}

$newOverride = $val['normalized'];
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
}, 'auto-deploy');

@unlink(__FILE__);

echo json_encode([
    'status' => 'success',
    'override' => $newOverride,
    'overrides_count' => count($saved['schedule_overrides'] ?? []),
    'self_deleted' => !is_file(__FILE__),
], JSON_UNESCAPED_UNICODE);
