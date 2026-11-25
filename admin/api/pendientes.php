<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/pendientes_io.php';
require_once __DIR__ . '/lib_digest_marker.php';

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
        'digest_paused' => kinesica_digest_is_paused('pendientes'),
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

if ($action === 'create') {
    $titulo = trim((string) ($input['titulo'] ?? ''));
    $posicion = (string) ($input['posicion'] ?? 'top');
    if ($titulo === '') {
        json_out(422, ['error' => 'El título de la tarea es obligatorio.']);
    }
    if (mb_strlen($titulo) > 255) {
        json_out(422, ['error' => 'El título no puede superar los 255 caracteres.']);
    }

    try {
        $id = 'pend_' . bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $id = 'pend_' . uniqid('', true);
    }

    $nuevo = [
        'id' => $id,
        'titulo' => $titulo,
        'estado' => 'pendiente',
        'prioridad' => 1,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'created_by' => (string) ($auth['username'] ?? 'admin'),
        'resolved_at' => null,
        'resolved_by' => null,
    ];

    $pendientes = kinesica_pendientes_load();
    if ($posicion === 'bottom') {
        $pendingList = [];
        $resolvedList = [];
        foreach ($pendientes as $p) {
            if (($p['estado'] ?? '') === 'resuelto') {
                $resolvedList[] = $p;
            } else {
                $pendingList[] = $p;
            }
        }
        $pendingList[] = $nuevo;
        $pendientes = array_merge($pendingList, $resolvedList);
    } else {
        array_unshift($pendientes, $nuevo);
    }
    $pendientes = kinesica_pendientes_normalize_priorities($pendientes);
    kinesica_pendientes_save($pendientes);

    json_out(200, [
        'status' => 'success',
        'message' => 'Pendiente agregado.',
        'pendiente' => $nuevo,
        'pendientes' => $pendientes,
    ]);
}

if ($action === 'reorder') {
    $ids = $input['ids'] ?? null;
    if (!is_array($ids)) {
        json_out(422, ['error' => 'Se requiere la lista de IDs ordenada.']);
    }

    $pendientes = kinesica_pendientes_load();
    $byId = [];
    $resueltos = [];
    foreach ($pendientes as $item) {
        $iid = (string) ($item['id'] ?? '');
        if ($iid === '') {
            continue;
        }
        if (($item['estado'] ?? '') === 'resuelto') {
            $resueltos[] = $item;
        } else {
            $byId[$iid] = $item;
        }
    }

    $reordered = [];
    foreach ($ids as $rawId) {
        $sid = trim((string) $rawId);
        if (isset($byId[$sid])) {
            $reordered[] = $byId[$sid];
            unset($byId[$sid]);
        }
    }
    foreach ($byId as $remaining) {
        $reordered[] = $remaining;
    }

    $all = array_merge($reordered, $resueltos);
    $all = kinesica_pendientes_normalize_priorities($all);
    kinesica_pendientes_save($all);

    json_out(200, [
        'status' => 'success',
        'message' => 'Orden de pendientes actualizado.',
        'pendientes' => $all,
    ]);
}

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

    $pendientes = kinesica_pendientes_normalize_priorities($pendientes);
    kinesica_pendientes_save($pendientes);
    json_out(200, [
        'status' => 'success',
        'message' => 'Estado actualizado.',
        'pendiente' => $updated,
        'pendientes' => $pendientes,
    ]);
}

if ($action === 'toggle_digest_pause') {
    $currentPaused = kinesica_digest_is_paused('pendientes');
    $newPaused = isset($input['paused']) ? (bool) $input['paused'] : !$currentPaused;
    kinesica_digest_set_paused('pendientes', $newPaused);
    json_out(200, [
        'status' => 'success',
        'digest_paused' => $newPaused,
        'message' => $newPaused ? 'Mails semanales de pendientes pausados.' : 'Mails semanales de pendientes activados.',
    ]);
}

json_out(400, ['error' => 'Acción no válida']);
