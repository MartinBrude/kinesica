<?php
declare(strict_types=1);

/**
 * Bulk import de gastos.
 *
 * Auth (cualquiera):
 *   - sesión admin + header X-Kinesica: 1
 *   - Bearer / X-Webhook-Secret / X-Import-Token = webhook_secret|install_token
 *     (evitar ?token= en query: queda en logs/Referer)
 *
 * POST JSON:
 *   { "gastos": [ { concepto, detalle?, fecha, moneda, monto, monto_eur?, monto_usd?, monto_ars?, tc_eur_usd?, tc_eur_ars?, id? }, ... ] }
 *
 * Dedup por concepto|fecha|moneda|monto. Preserva cotizaciones enviadas.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/gastos_io.php';

$config = cfg();
$expectedSecret = (string) ($config['webhook_secret'] ?? $config['install_token'] ?? '');
$providedToken = (string) ($_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? $_SERVER['HTTP_X_IMPORT_TOKEN'] ?? '');
$authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($providedToken === '' && str_starts_with($authHeader, 'Bearer ')) {
    $providedToken = trim(substr($authHeader, 7));
}
$isTokenAuth = ($expectedSecret !== '' && $providedToken !== '' && hash_equals($expectedSecret, $providedToken));

$actor = 'import';
if (!$isTokenAuth) {
    require_header();
    $auth = require_auth();
    if (!is_admin($auth)) {
        json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador o token.']);
    }
    $actor = (string) ($auth['username'] ?? 'import');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$incoming = $input['gastos'] ?? null;
if (!is_array($incoming) || $incoming === []) {
    json_out(422, ['error' => 'Enviá { "gastos": [ ... ] } con al menos un gasto.']);
}

$existing = kinesica_gastos_load();
$byKey = [];
foreach ($existing as $g) {
    if (!is_array($g)) {
        continue;
    }
    $key = strtolower(trim((string) ($g['concepto'] ?? '')))
        . '|' . (string) ($g['fecha'] ?? '')
        . '|' . strtoupper((string) ($g['moneda'] ?? ''))
        . '|' . number_format((float) ($g['monto'] ?? 0), 2, '.', '');
    $byKey[$key] = true;
}

$added = 0;
$skipped = 0;
$now = gmdate('Y-m-d\TH:i:s\Z');

foreach ($incoming as $row) {
    if (!is_array($row)) {
        $skipped++;
        continue;
    }
    $concepto = trim((string) ($row['concepto'] ?? ''));
    $fecha = trim((string) ($row['fecha'] ?? ''));
    $moneda = strtoupper(trim((string) ($row['moneda'] ?? 'ARS')));
    $monto = round((float) ($row['monto'] ?? 0), 2);

    if ($concepto === '' || mb_strlen($concepto) > 255) {
        $skipped++;
        continue;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || $monto <= 0) {
        $skipped++;
        continue;
    }
    if (!in_array($moneda, ['EUR', 'ARS', 'USD'], true)) {
        $moneda = 'ARS';
    }

    $key = strtolower($concepto) . '|' . $fecha . '|' . $moneda . '|' . number_format($monto, 2, '.', '');
    if (isset($byKey[$key])) {
        $skipped++;
        continue;
    }

    $detalle = trim((string) ($row['detalle'] ?? ''));
    if ($detalle !== '' && mb_strlen($detalle) > 255) {
        $detalle = mb_substr($detalle, 0, 255);
    }

    $id = trim((string) ($row['id'] ?? ''));
    if ($id === '') {
        try {
            $id = 'gasto_' . bin2hex(random_bytes(6));
        } catch (Throwable $e) {
            $id = 'gasto_' . uniqid('', true);
        }
    }

    $norm = kinesica_normalize_gasto_amounts($moneda, $monto, $row);
    $nuevo = array_merge([
        'id' => $id,
        'concepto' => $concepto,
        'detalle' => $detalle,
        'fecha' => $fecha,
        'moneda' => $moneda,
        'monto' => $monto,
    ], $norm, [
        'created_at' => $now,
        'created_by' => $actor,
    ]);

    array_unshift($existing, $nuevo);
    $byKey[$key] = true;
    $added++;
}

kinesica_gastos_save($existing, $actor);

json_out(200, [
    'status' => 'success',
    'added' => $added,
    'skipped' => $skipped,
    'total' => count($existing),
    'message' => "Importados $added gasto(s); omitidos $skipped (duplicados o inválidos).",
]);
