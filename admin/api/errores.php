<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/errores_io.php';

require_header();
$auth = require_auth();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $errores = kinesica_errores_load();
    usort($errores, static function (array $a, array $b): int {
        return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
    });

    $pendientes = 0;
    $resueltos = 0;
    foreach ($errores as $err) {
        if (($err['estado'] ?? 'pendiente') === 'resuelto') {
            $resueltos++;
        } else {
            $pendientes++;
        }
    }

    json_out(200, [
        'status' => 'success',
        'errores' => $errores,
        'totales' => [
            'total' => count($errores),
            'pendientes' => $pendientes,
            'resueltos' => $resueltos,
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

if ($action === 'create') {
    $seccion = trim((string) ($input['seccion'] ?? ''));
    $info = trim((string) ($input['info'] ?? ''));
    $comportamientoActual = trim((string) ($input['comportamiento_actual'] ?? ''));
    $comportamientoEsperado = trim((string) ($input['comportamiento_esperado'] ?? ''));
    $foto = trim((string) ($input['foto'] ?? ''));
    $video = trim((string) ($input['video'] ?? ''));

    if ($seccion === '') {
        json_out(422, ['error' => 'La sección es obligatoria.']);
    }
    if ($info === '' || mb_strlen($info) > 255) {
        json_out(422, ['error' => 'El resumen o información es obligatorio (máximo 255 caracteres).']);
    }
    if ($comportamientoActual === '') {
        json_out(422, ['error' => 'El comportamiento actual es obligatorio.']);
    }
    if ($comportamientoEsperado === '') {
        json_out(422, ['error' => 'El comportamiento esperado es obligatorio.']);
    }

    $safeUrlPattern = '/^(?:https?:\/\/|\/admin\/api\/(?:foto|video)\.php|\/admin\/uploads\/)/i';
    if ($foto !== '' && (!preg_match($safeUrlPattern, $foto) || preg_match('/[\r\n\t]/', $foto))) {
        json_out(422, ['error' => 'La URL o ruta de la foto no es válida.']);
    }
    if ($video !== '' && (!preg_match($safeUrlPattern, $video) || preg_match('/[\r\n\t]/', $video))) {
        json_out(422, ['error' => 'La URL o ruta del video no es válida.']);
    }

    try {
        $id = 'err_' . bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $id = 'err_' . uniqid('', true);
    }

    $nuevo = [
        'id' => $id,
        'seccion' => $seccion,
        'info' => $info,
        'comportamiento_actual' => $comportamientoActual,
        'comportamiento_esperado' => $comportamientoEsperado,
        'foto' => $foto,
        'video' => $video,
        'estado' => 'pendiente',
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'created_by' => (string) ($auth['username'] ?? 'admin'),
        'resolved_at' => null,
        'resolved_by' => null,
    ];

    $actor = (string) ($auth['username'] ?? 'admin');
    $errores = kinesica_errores_load();
    array_unshift($errores, $nuevo);
    kinesica_errores_save($errores, $actor);

    json_out(200, [
        'status' => 'success',
        'message' => 'Error reportado correctamente.',
        'error_report' => $nuevo,
    ]);
}

if ($action === 'toggle_status') {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(422, ['error' => 'ID no especificado.']);
    }

    $errores = kinesica_errores_load();
    $found = false;
    $updated = null;

    foreach ($errores as &$err) {
        if (($err['id'] ?? '') === $id) {
            $isResuelto = ($err['estado'] ?? '') === 'resuelto';
            $err['estado'] = $isResuelto ? 'pendiente' : 'resuelto';
            $err['resolved_at'] = $isResuelto ? null : gmdate('Y-m-d\TH:i:s\Z');
            $err['resolved_by'] = $isResuelto ? null : (string) ($auth['username'] ?? 'admin');
            $updated = $err;
            $found = true;
            break;
        }
    }
    unset($err);

    if (!$found) {
        json_out(404, ['error' => 'Reporte de error no encontrado.']);
    }

    $actor = (string) ($auth['username'] ?? 'admin');
    kinesica_errores_save($errores, $actor);
    json_out(200, [
        'status' => 'success',
        'message' => 'Estado actualizado.',
        'error_report' => $updated,
    ]);
}

if ($action === 'delete') {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(422, ['error' => 'ID no especificado.']);
    }

    $errores = kinesica_errores_load();
    $filtrados = array_values(array_filter($errores, static fn (array $e): bool => ($e['id'] ?? '') !== $id));

    if (count($filtrados) === count($errores)) {
        json_out(404, ['error' => 'Reporte no encontrado.']);
    }

    $actor = (string) ($auth['username'] ?? 'admin');
    kinesica_errores_save($filtrados, $actor);
    json_out(200, [
        'status' => 'success',
        'message' => 'Reporte eliminado.',
    ]);
}

json_out(400, ['error' => 'Acción no válida']);
