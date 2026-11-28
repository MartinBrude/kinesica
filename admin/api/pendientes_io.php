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

function kinesica_pendientes_normalize_priorities(array $items): array
{
    $pendientes = [];
    $resueltos = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (($item['estado'] ?? '') === 'resuelto') {
            $item['prioridad'] = 0;
            $resueltos[] = $item;
        } else {
            $pendientes[] = $item;
        }
    }

    $idx = 1;
    foreach ($pendientes as &$item) {
        $item['prioridad'] = $idx++;
    }
    unset($item);

    return array_merge($pendientes, $resueltos);
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
    $pIdx = 1;
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
        $prioridad = isset($item['prioridad']) && is_numeric($item['prioridad'])
            ? (int) $item['prioridad']
            : ($estado === 'pendiente' ? $pIdx++ : 0);

        $entry = [
            'id' => $id,
            'titulo' => $titulo,
            'estado' => $estado,
            'prioridad' => $prioridad,
            'created_at' => (string) ($item['created_at'] ?? ''),
            'created_by' => (string) ($item['created_by'] ?? ''),
            'resolved_at' => $item['resolved_at'] ?? null,
            'resolved_by' => $item['resolved_by'] ?? null,
        ];
        if (isset($item['updated_at']) && is_scalar($item['updated_at']) && trim((string) $item['updated_at']) !== '') {
            $entry['updated_at'] = trim((string) $item['updated_at']);
        }
        if (isset($item['updated_by']) && is_scalar($item['updated_by']) && trim((string) $item['updated_by']) !== '') {
            $entry['updated_by'] = trim((string) $item['updated_by']);
        }
        $out[] = $entry;
    }
    return kinesica_pendientes_normalize_priorities($out);
}

/**
 * Valida y normaliza el título de una tarea pendiente.
 *
 * @return array{ok:bool,titulo?:string,error?:string}
 */
function kinesica_pendientes_validate_titulo(string $raw): array
{
    $titulo = trim($raw);
    if ($titulo === '') {
        return ['ok' => false, 'error' => 'El título de la tarea es obligatorio.'];
    }
    if (mb_strlen($titulo, 'UTF-8') > 255) {
        return ['ok' => false, 'error' => 'El título no puede superar los 255 caracteres.'];
    }
    return ['ok' => true, 'titulo' => $titulo];
}

/**
 * Actualiza el texto (título) de un pendiente existente preservando prioridad y estado.
 *
 * @return array{pendiente:array<string,mixed>,pendientes:list<array<string,mixed>>}|null
 */
function kinesica_pendientes_update_titulo(array $pendientes, string $id, string $titulo, string $username): ?array
{
    $updated = null;
    $actor = trim($username) !== '' ? trim($username) : 'admin';
    foreach ($pendientes as &$item) {
        if (($item['id'] ?? '') === $id) {
            $item['titulo'] = $titulo;
            $item['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $item['updated_by'] = $actor;
            $updated = $item;
            break;
        }
    }
    unset($item);
    if ($updated === null) {
        return null;
    }
    return ['pendiente' => $updated, 'pendientes' => $pendientes];
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
