<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/pendientes_io.php';

require_header();
$auth = require_auth();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $pendientes = kinesica_pendientes_load();
    $countsOnly = isset($_GET['counts_only']) && (string) $_GET['counts_only'] === '1';

    $open = 0;
    $resueltos = 0;
    foreach ($pendientes as $item) {
        if (($item['estado'] ?? 'pendiente') === 'resuelto') {
            $resueltos++;
        } else {
            $open++;
        }
    }

    $payload = [
        'status' => 'success',
        'totales' => [
            'total' => count($pendientes),
            'pendientes' => $open,
            'resueltos' => $resueltos,
        ],
        'pending_count' => $open,
    ];
    if (!$countsOnly) {
        $payload['pendientes'] = $pendientes;
    }
    json_out(200, $payload);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

if ($action === 'toggle_status') {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(422, ['error' => 'ID no especificado.']);
    }

    $pendientes = kinesica_pendientes_load();
    $found = false;
    $updated = null;

    foreach ($pendientes as &$item) {
        if (($item['id'] ?? '') === $id) {
            $isResuelto = ($item['estado'] ?? '') === 'resuelto';
            $item['estado'] = $isResuelto ? 'pendiente' : 'resuelto';
            $item['resolved_at'] = $isResuelto ? null : gmdate('Y-m-d\TH:i:s\Z');
            $item['resolved_by'] = $isResuelto ? null : (string) ($auth['username'] ?? 'admin');
            $updated = $item;
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) {
        json_out(404, ['error' => 'Tarea pendiente no encontrada.']);
    }

    kinesica_pendientes_save($pendientes);
    json_out(200, [
        'status' => 'success',
        'message' => 'Estado actualizado.',
        'pendiente' => $updated,
    ]);
}

json_out(400, ['error' => 'Acción no válida']);
