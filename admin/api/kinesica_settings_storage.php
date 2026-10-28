<?php
declare(strict_types=1);

function kinesica_settings_runtime_file(): string
{
    return __DIR__ . '/data/settings.json';
}

function kinesica_settings_seed_file(): string
{
    return __DIR__ . '/settings.json';
}

function kinesica_settings_source_file(): string
{
    $runtime = kinesica_settings_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_settings_seed_file();
}

function kinesica_settings_raw(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

final class KinesicaSettingsConflict extends RuntimeException
{
}

/**
 * Lee-modifica-escribe bajo lock exclusivo con escritura atómica (tmp + rename).
 */
function kinesica_update_settings(callable $mutate): array
{
    $runtime = kinesica_settings_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.settings.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear la configuración.');
    }
    try {
        $current = kinesica_settings_raw(kinesica_settings_source_file());
        $next = $mutate($current);
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la configuración.');
        }
        return $next;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
