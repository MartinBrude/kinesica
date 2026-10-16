<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$settingsFile = __DIR__ . '/settings.json';

function get_runtime_settings(string $file): array
{
    $defaults = [
        'clara_active' => true,
        'booking_active' => true,
    ];
    if (!is_file($file)) {
        return $defaults;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return $defaults;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return $defaults;
    }
    return [
        'clara_active' => isset($data['clara_active']) ? (bool) $data['clara_active'] : true,
        'booking_active' => isset($data['booking_active']) ? (bool) $data['booking_active'] : true,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Cache-Control: public, max-age=15, stale-while-revalidate=45');
    echo json_encode(get_runtime_settings($settingsFile), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    require __DIR__ . '/lib.php';
    require_header();
    require_auth();

    $input = read_json();
    $current = get_runtime_settings($settingsFile);

    if (isset($input['clara_active'])) {
        $current['clara_active'] = (bool) $input['clara_active'];
    }
    if (isset($input['booking_active'])) {
        $current['booking_active'] = (bool) $input['booking_active'];
    }

    $saved = @file_put_contents($settingsFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($saved === false) {
        json_out(500, ['error' => 'No se pudo guardar la configuración.']);
    }

    json_out(200, $current);
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
