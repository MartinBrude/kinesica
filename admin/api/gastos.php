<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

require_header();
$auth = require_auth();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

function kinesica_gastos_runtime_file(): string
{
    return __DIR__ . '/data/gastos.json';
}

function kinesica_gastos_seed_file(): string
{
    return __DIR__ . '/gastos.json';
}

function kinesica_gastos_source_file(): string
{
    $runtime = kinesica_gastos_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_gastos_seed_file();
}

function kinesica_gastos_load(): array
{
    $file = kinesica_gastos_source_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kinesica_gastos_save(array $gastos): void
{
    $runtime = kinesica_gastos_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.gastos.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de gastos.');
    }
    try {
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode(array_values($gastos), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la lista de gastos.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $gastos = kinesica_gastos_load();
    usort($gastos, static function (array $a, array $b): int {
        return strcmp((string) ($b['fecha'] ?? ''), (string) ($a['fecha'] ?? ''));
    });
    $subtotalEur = 0.0;
    $subtotalUsd = 0.0;
    $subtotalArs = 0.0;
    foreach ($gastos as $g) {
        $val = (float) ($g['monto'] ?? 0);
        $mon = strtoupper((string) ($g['moneda'] ?? 'EUR'));
        if ($mon === 'EUR') {
            $subtotalEur += $val;
        } elseif ($mon === 'USD') {
            $subtotalUsd += $val;
        } else {
            $subtotalArs += $val;
        }
    }
    json_out(200, [
        'status' => 'success',
        'gastos' => $gastos,
        'subtotales' => [
            'eur' => round($subtotalEur, 2),
            'usd' => round($subtotalUsd, 2),
            'ars' => round($subtotalArs, 2),
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
    $tipoCambio = isset($input['tipo_cambio']) && is_numeric($input['tipo_cambio']) && (float) $input['tipo_cambio'] > 0
        ? round((float) $input['tipo_cambio'], 2)
        : null;

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

    $nuevo = [
        'id' => $id,
        'concepto' => $concepto,
        'detalle' => $detalle,
        'fecha' => $fecha,
        'monto' => round((float) $montoRaw, 2),
        'moneda' => $moneda,
        'tipo_cambio' => $tipoCambio,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'created_by' => (string) ($auth['username'] ?? ''),
    ];

    $gastos = kinesica_gastos_load();
    array_unshift($gastos, $nuevo);
    kinesica_gastos_save($gastos);

    json_out(200, [
        'status' => 'success',
        'message' => 'Gasto registrado correctamente.',
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
    $tipoCambio = isset($input['tipo_cambio']) && is_numeric($input['tipo_cambio']) && (float) $input['tipo_cambio'] > 0
        ? round((float) $input['tipo_cambio'], 2)
        : null;

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

    $gastos = kinesica_gastos_load();
    $found = false;
    foreach ($gastos as &$g) {
        if (($g['id'] ?? '') === $id) {
            $g['concepto'] = $concepto;
            $g['detalle'] = $detalle;
            $g['fecha'] = $fecha;
            $g['monto'] = round((float) $montoRaw, 2);
            $g['moneda'] = $moneda;
            $g['tipo_cambio'] = $tipoCambio;
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
