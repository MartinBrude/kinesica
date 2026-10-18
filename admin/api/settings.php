<?php
declare(strict_types=1);

define('KINESICA_HORARIOS_INCLUDED', true);
require_once __DIR__ . '/horarios.php';

header('Content-Type: application/json; charset=utf-8');

$settingsFile = __DIR__ . '/settings.json';

function get_runtime_settings(string $file): array
{
    return load_full_runtime_settings($file);
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
    $user = require_auth();

    $input = read_json();
    $current = get_runtime_settings($settingsFile);

    if (isset($input['clara_active'])) {
        $current['clara_active'] = (bool) $input['clara_active'];
    }
    if (isset($input['booking_active'])) {
        $current['booking_active'] = (bool) $input['booking_active'];
    }
    if (isset($input['fees']) && is_array($input['fees'])) {
        $atmVal = isset($input['fees']['atm']) ? (int) $input['fees']['atm'] : ($current['fees']['atm'] ?? 65000);
        $genVal = isset($input['fees']['general']) ? (int) $input['fees']['general'] : ($current['fees']['general'] ?? 75000);
        $payVal = isset($input['fees']['payment_methods']) ? trim((string) $input['fees']['payment_methods']) : ($current['fees']['payment_methods'] ?? 'Efectivo o transferencia bancaria');
        $current['fees'] = [
            'atm' => max(0, $atmVal),
            'general' => max(0, $genVal),
            'payment_methods' => $payVal ?: 'Efectivo o transferencia bancaria',
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'updated_by' => (string) ($user['name'] ?: $user['username']),
        ];
    }

    if (isset($input['practitioner_hours']) && is_array($input['practitioner_hours'])) {
        $val = validate_practitioner_hours_php($input['practitioner_hours']);
        if (!$val['isValid']) {
            json_out(422, [
                'error' => implode(' ', $val['errors']),
                'errors' => $val['errors'],
                'conflicts' => $val['conflicts'],
            ]);
        }
        $current['practitioner_hours'] = $val['normalized'];
        $current['horarios_updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
        $current['horarios_updated_by'] = (string) ($user['name'] ?: $user['username']);
    }

    $toPersist = [
        'clara_active' => $current['clara_active'],
        'booking_active' => $current['booking_active'],
        'fees' => $current['fees'] ?? [
            'atm' => 65000,
            'general' => 75000,
            'payment_methods' => 'Efectivo o transferencia bancaria',
            'updated_at' => null,
            'updated_by' => null,
        ],
        'practitioner_hours' => $current['practitioner_hours'],
        'horarios_updated_at' => $current['horarios_updated_at'],
        'horarios_updated_by' => $current['horarios_updated_by'],
    ];

    $saved = @file_put_contents($settingsFile, json_encode($toPersist, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($saved === false) {
        json_out(500, ['error' => 'No se pudo guardar la configuración.']);
    }

    json_out(200, get_runtime_settings($settingsFile));
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
