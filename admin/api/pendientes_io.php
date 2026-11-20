<?php
declare(strict_types=1);

/**
 * Persistencia de tareas pendientes del admin (JSON).
 *
 * - Seed: admin/api/pendientes.json
 * - Runtime: admin/api/data/pendientes.json
 */

function kinesica_pendientes_runtime_file(): string
{
    return __DIR__ . '/data/pendientes.json';
}

function kinesica_pendientes_seed_file(): string
{
    return __DIR__ . '/pendientes.json';
}

function kinesica_pendientes_source_file(): string
{
    $runtime = kinesica_pendientes_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_pendientes_seed_file();
}

function kinesica_pendientes_load(): array
{
    $file = kinesica_pendientes_source_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    if (!is_array($data)) {
        return [];
    }
    $out = [];
    foreach ($data as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = trim((string) ($item['id'] ?? ''));
        $titulo = trim((string) ($item['titulo'] ?? ''));
        if ($id === '' || $titulo === '') {
            continue;
        }
        $estado = (($item['estado'] ?? '') === 'resuelto') ? 'resuelto' : 'pendiente';
        $out[] = [
            'id' => $id,
            'titulo' => $titulo,
            'estado' => $estado,
            'created_at' => (string) ($item['created_at'] ?? ''),
            'created_by' => (string) ($item['created_by'] ?? ''),
            'resolved_at' => $item['resolved_at'] ?? null,
            'resolved_by' => $item['resolved_by'] ?? null,
        ];
    }
    return $out;
}

function kinesica_pendientes_save(array $pendientes): void
{
    $runtime = kinesica_pendientes_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.pendientes.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de pendientes.');
    }
    try {
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode(array_values($pendientes), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la lista de pendientes.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
