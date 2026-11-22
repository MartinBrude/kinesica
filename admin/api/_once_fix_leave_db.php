<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
$expected = '94f14402d3eb3cc52e5ceff693db45e38c53768d278a3ebc';
$got = (string) ($_GET['t'] ?? '');
if ($got === '' || !hash_equals($expected, $got)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
    exit;
}
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/kinesica_settings_storage.php';
require_once __DIR__ . '/lib_relational_config.php';

$raw = kinesica_settings_raw(kinesica_settings_runtime_file());
$ovs = is_array($raw['schedule_overrides'] ?? null) ? $raw['schedule_overrides'] : [];
$pdo = kinesica_settings_pdo();
if (!$pdo instanceof PDO) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Sin PDO']);
    exit;
}
$ok = kinesica_rel_config_set($pdo, 'schedule_overrides', $ovs, 'auto-deploy-fix');
$after = kinesica_settings_load();
@unlink(__FILE__);
echo json_encode([
    'status' => $ok ? 'success' : 'error',
    'file_overrides' => count($ovs),
    'loaded_overrides' => count($after['schedule_overrides'] ?? []),
    'first_id' => $after['schedule_overrides'][0]['id'] ?? null,
    'self_deleted' => !is_file(__FILE__),
], JSON_UNESCAPED_UNICODE);
