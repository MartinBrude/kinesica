<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/gastos_io.php';

require_header();
$auth = require_auth();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $gastos = kinesica_gastos_load();
    usort($gastos, static function (array $a, array $b): int {
        return strcmp((string) ($b['fecha'] ?? ''), (string) ($a['fecha'] ?? ''));
    });

    $totalEur = 0.0;
    $totalUsd = 0.0;
    $totalArs = 0.0;

    foreach ($gastos as &$g) {
        $mon = strtoupper((string) ($g['moneda'] ?? 'EUR'));
        $val = (float) ($g['monto'] ?? 0);
        if (!isset($g['monto_eur'], $g['monto_usd'], $g['monto_ars'])) {
            $norm = kinesica_normalize_gasto_amounts($mon, $val, $g);
            $g = array_merge($g, $norm);
        }
        $totalEur += (float) $g['monto_eur'];
        $totalUsd += (float) $g['monto_usd'];
        $totalArs += (float) $g['monto_ars'];
    }
    unset($g);

    json_out(200, [
        'status' => 'success',
        'gastos' => $gastos,
        'totales' => [
            'eur' => round($totalEur, 2),
            'usd' => round($totalUsd, 2),
            'ars' => round($totalArs, 2),
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

if ($action === 'create') {
    $concepto = trim((string) ($input['concepto'] ?? ''));
    $detalle = trim((string) ($input['detalle'] ?? ''));
    $fecha = trim((string) ($input['fecha'] ?? ''));
    $montoRaw = $input['monto'] ?? null;
    $moneda = strtoupper(trim((string) ($input['moneda'] ?? 'EUR')));

    if ($concepto === '' || mb_strlen($concepto) > 255) {
        json_out(422, ['error' => 'El concepto o servicio es obligatorio (máximo 255 caracteres).']);
    }
    if ($detalle !== '' && mb_strlen($detalle) > 255) {
        json_out(422, ['error' => 'El detalle adicional no puede superar 255 caracteres.']);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        json_out(422, ['error' => 'La fecha debe tener un formato válido (AAAA-MM-DD).']);
    }
    if (!is_numeric($montoRaw) || (float) $montoRaw <= 0) {
        json_out(422, ['error' => 'El monto debe ser un número positivo mayor a 0.']);
    }
    if (!in_array($moneda, ['EUR', 'ARS', 'USD'], true)) {
        $moneda = 'EUR';
    }

    try {
        $id = 'gasto_' . bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $id = 'gasto_' . uniqid('', true);
    }

    $monto = round((float) $montoRaw, 2);
    $norm = kinesica_normalize_gasto_amounts($moneda, $monto, $input);

    $nuevo = array_merge([
        'id' => $id,
        'concepto' => $concepto,
        'detalle' => $detalle,
        'fecha' => $fecha,
        'moneda' => $moneda,
        'monto' => $monto,
    ], $norm, [
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'created_by' => (string) ($auth['username'] ?? ''),
    ]);

    $gastos = kinesica_gastos_load();
    array_unshift($gastos, $nuevo);
    kinesica_gastos_save($gastos);

    json_out(200, [
        'status' => 'success',
        'message' => 'Gasto registrado correctamente con sus equivalencias del día.',
        'gasto' => $nuevo,
    ]);
}

if ($action === 'update') {
    $id = trim((string) ($input['id'] ?? ''));
    $concepto = trim((string) ($input['concepto'] ?? ''));
    $detalle = trim((string) ($input['detalle'] ?? ''));
    $fecha = trim((string) ($input['fecha'] ?? ''));
    $montoRaw = $input['monto'] ?? null;
    $moneda = strtoupper(trim((string) ($input['moneda'] ?? 'EUR')));

    if ($id === '') {
        json_out(422, ['error' => 'ID de gasto no especificado.']);
    }
    if ($concepto === '' || mb_strlen($concepto) > 255) {
        json_out(422, ['error' => 'El concepto o servicio es obligatorio (máximo 255 caracteres).']);
    }
    if ($detalle !== '' && mb_strlen($detalle) > 255) {
        json_out(422, ['error' => 'El detalle adicional no puede superar 255 caracteres.']);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        json_out(422, ['error' => 'La fecha debe tener un formato válido (AAAA-MM-DD).']);
    }
    if (!is_numeric($montoRaw) || (float) $montoRaw <= 0) {
        json_out(422, ['error' => 'El monto debe ser un número positivo mayor a 0.']);
    }
    if (!in_array($moneda, ['EUR', 'ARS', 'USD'], true)) {
        $moneda = 'EUR';
    }

    $monto = round((float) $montoRaw, 2);
    $norm = kinesica_normalize_gasto_amounts($moneda, $monto, $input);

    $gastos = kinesica_gastos_load();
    $found = false;
    foreach ($gastos as &$g) {
        if (($g['id'] ?? '') === $id) {
            $g['concepto'] = $concepto;
            $g['detalle'] = $detalle;
            $g['fecha'] = $fecha;
            $g['moneda'] = $moneda;
            $g['monto'] = $monto;
            $g['monto_eur'] = $norm['monto_eur'];
            $g['monto_usd'] = $norm['monto_usd'];
            $g['monto_ars'] = $norm['monto_ars'];
            $g['tc_eur_usd'] = $norm['tc_eur_usd'];
            $g['tc_eur_ars'] = $norm['tc_eur_ars'];
            $g['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $g['updated_by'] = (string) ($auth['username'] ?? '');
            $found = true;
            break;
        }
    }
    unset($g);

    if (!$found) {
        json_out(404, ['error' => 'Gasto no encontrado para actualizar.']);
    }

    kinesica_gastos_save($gastos);

    json_out(200, [
        'status' => 'success',
        'message' => 'Gasto actualizado correctamente.',
    ]);
}

if ($action === 'delete') {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(422, ['error' => 'ID de gasto no especificado.']);
    }

    $gastos = kinesica_gastos_load();
    $filtered = [];
    $found = false;
    foreach ($gastos as $g) {
        if (($g['id'] ?? '') === $id) {
            $found = true;
            continue;
        }
        $filtered[] = $g;
    }

    if (!$found) {
        json_out(404, ['error' => 'Gasto no encontrado para eliminar.']);
    }

    kinesica_gastos_save($filtered);

    json_out(200, [
        'status' => 'success',
        'message' => 'Gasto eliminado correctamente.',
    ]);
}

json_out(400, ['error' => 'Acción no válida.']);
