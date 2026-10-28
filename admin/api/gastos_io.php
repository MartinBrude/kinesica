<?php
declare(strict_types=1);

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

/**
 * Normaliza los valores en las 3 monedas (EUR, USD, ARS) para un registro según la cotización de su fecha.
 */
function kinesica_normalize_gasto_amounts(string $moneda, float $monto, array $input): array
{
    $tcEurUsd = isset($input['tc_eur_usd']) && is_numeric($input['tc_eur_usd']) && (float) $input['tc_eur_usd'] > 0
        ? (float) $input['tc_eur_usd']
        : 1.082;
    $tcEurArs = isset($input['tc_eur_ars']) && is_numeric($input['tc_eur_ars']) && (float) $input['tc_eur_ars'] > 0
        ? (float) $input['tc_eur_ars']
        : 1450.00;

    $montoEur = isset($input['monto_eur']) && is_numeric($input['monto_eur']) && (float) $input['monto_eur'] > 0
        ? (float) $input['monto_eur']
        : null;
    $montoUsd = isset($input['monto_usd']) && is_numeric($input['monto_usd']) && (float) $input['monto_usd'] > 0
        ? (float) $input['monto_usd']
        : null;
    $montoArs = isset($input['monto_ars']) && is_numeric($input['monto_ars']) && (float) $input['monto_ars'] > 0
        ? (float) $input['monto_ars']
        : null;

    if ($moneda === 'EUR') {
        $montoEur = $monto;
        if ($montoUsd === null) $montoUsd = $monto * $tcEurUsd;
        if ($montoArs === null) $montoArs = $monto * $tcEurArs;
    } elseif ($moneda === 'USD') {
        $montoUsd = $monto;
        if ($montoEur === null) $montoEur = $tcEurUsd > 0 ? ($monto / $tcEurUsd) : $monto;
        if ($montoArs === null) {
            $tcUsdArs = $tcEurUsd > 0 ? ($tcEurArs / $tcEurUsd) : 1350.0;
            $montoArs = $monto * $tcUsdArs;
        }
    } else {
        $montoArs = $monto;
        if ($montoEur === null) $montoEur = $tcEurArs > 0 ? ($monto / $tcEurArs) : 0.0;
        if ($montoUsd === null) {
            $tcUsdArs = $tcEurUsd > 0 ? ($tcEurArs / $tcEurUsd) : 1350.0;
            $montoUsd = $tcUsdArs > 0 ? ($monto / $tcUsdArs) : 0.0;
        }
    }

    return [
        'monto_eur' => round((float) $montoEur, 2),
        'monto_usd' => round((float) $montoUsd, 2),
        'monto_ars' => round((float) $montoArs, 2),
        'tc_eur_usd' => round($tcEurUsd, 4),
        'tc_eur_ars' => round($tcEurArs, 2),
    ];
}
