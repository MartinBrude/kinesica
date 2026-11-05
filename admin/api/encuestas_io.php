<?php
declare(strict_types=1);

function kinesica_encuestas_runtime_file(): string
{
    return __DIR__ . '/data/encuestas.json';
}

function kinesica_encuestas_seed_file(): string
{
    return __DIR__ . '/encuestas.json';
}

function kinesica_encuestas_source_file(): string
{
    $runtime = kinesica_encuestas_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_encuestas_seed_file();
}

function kinesica_encuestas_load(): array
{
    $file = kinesica_encuestas_source_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kinesica_encuestas_save(array $encuestas): void
{
    $runtime = kinesica_encuestas_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.encuestas.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de encuestas.');
    }
    try {
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode(array_values($encuestas), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la lista de encuestas.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
