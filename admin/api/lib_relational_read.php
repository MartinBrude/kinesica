<?php
declare(strict_types=1);

/**
 * Lecturas con REL_READ_IDS: preferir paciente canónico por ID.
 *
 * Si el flag está off → no-op (devuelve filas/payloads tal cual).
 * Si está on y hay paciente_id → overlay nombre/dni/tel/email desde pacientes.
 * Si falta ID → fallback legacy + línea en rel_read_fallback.jsonl.
 *
 * Usado por: fichas_ops (GET), pacientes waitlist, vistas WA/recordatorios.
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_relational_flags.php';
require_once __DIR__ . '/lib_migrations.php';

function kinesica_rel_read_fallback_log_path(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir . '/rel_read_fallback.jsonl';
}

function kinesica_rel_note_read_fallback(string $source, string $reason = 'sin_paciente_id'): void
{
    if (!kinesica_rel_read_ids()) {
        return;
    }
    $line = json_encode([
        'ts' => gmdate('c'),
        'source' => $source,
        'reason' => $reason,
    ], JSON_UNESCAPED_UNICODE);
    if ($line === false) {
        return;
    }
    @file_put_contents(kinesica_rel_read_fallback_log_path(), $line . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * @return array{id:int,nombre_completo:string,nombre:string,apellido:string,telefono:string,dni:string,email:string}|null
 */
function kinesica_rel_fetch_paciente(PDO $pdo, int $pacienteId): ?array
{
    if ($pacienteId <= 0 || !kinesica_migrations_table_exists($pdo, 'pacientes')) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT id, nombre_completo, nombre, apellido, telefono, dni, email
         FROM pacientes WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $pacienteId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    return [
        'id' => (int) $row['id'],
        'nombre_completo' => (string) ($row['nombre_completo'] ?? ''),
        'nombre' => (string) ($row['nombre'] ?? ''),
        'apellido' => (string) ($row['apellido'] ?? ''),
        'telefono' => (string) ($row['telefono'] ?? ''),
        'dni' => (string) ($row['dni'] ?? ''),
        'email' => (string) ($row['email'] ?? ''),
    ];
}

/**
 * @param list<int> $ids
 * @return array<int,array{id:int,nombre_completo:string,nombre:string,apellido:string,telefono:string,dni:string,email:string}>
 */
function kinesica_rel_fetch_pacientes_map(PDO $pdo, array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
    if ($ids === [] || !kinesica_migrations_table_exists($pdo, 'pacientes')) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, nombre_completo, nombre, apellido, telefono, dni, email
         FROM pacientes WHERE id IN ({$placeholders})"
    );
    $stmt->execute($ids);
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) $row['id'];
        $map[$id] = [
            'id' => $id,
            'nombre_completo' => (string) ($row['nombre_completo'] ?? ''),
            'nombre' => (string) ($row['nombre'] ?? ''),
            'apellido' => (string) ($row['apellido'] ?? ''),
            'telefono' => (string) ($row['telefono'] ?? ''),
            'dni' => (string) ($row['dni'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
        ];
    }
    return $map;
}

/**
 * Nombre para mostrar desde fila canónica de pacientes.
 *
 * @param array{nombre_completo?:string,nombre?:string,apellido?:string}|null $paciente
 */
function kinesica_rel_paciente_display_name(?array $paciente): string
{
    if ($paciente === null) {
        return '';
    }
    $display = trim((string) ($paciente['nombre_completo'] ?? ''));
    if ($display === '') {
        $display = trim(trim((string) ($paciente['nombre'] ?? '')) . ' ' . trim((string) ($paciente['apellido'] ?? '')));
    }
    if ($display !== '' && function_exists('sanitize_patient_name')) {
        return sanitize_patient_name($display);
    }
    return $display;
}

/**
 * Enriquece payload de ficha con datos canónicos del directorio.
 *
 * @param array<string,mixed> $payload
 * @param array{id:int,nombre_completo:string,nombre:string,apellido:string,telefono:string,dni:string,email:string}|null $paciente
 * @return array{payload:array<string,mixed>,used_id:bool}
 */
function kinesica_rel_enrich_ficha_payload(array $payload, ?array $paciente): array
{
    if ($paciente === null) {
        return ['payload' => $payload, 'used_id' => false];
    }
    $display = kinesica_rel_paciente_display_name($paciente);
    if ($display !== '') {
        $payload['nombre'] = $display;
    }
    if ($paciente['dni'] !== '') {
        $payload['dni'] = $paciente['dni'];
    }
    $payload['paciente_id'] = $paciente['id'];
    $tel = trim((string) ($payload['telefono'] ?? ''));
    if ($paciente['telefono'] !== '' && $tel === '') {
        $payload['telefono'] = $paciente['telefono'];
    }
    $email = trim((string) ($payload['email'] ?? ''));
    if ($paciente['email'] !== '' && $email === '') {
        $payload['email'] = $paciente['email'];
    }
    return ['payload' => $payload, 'used_id' => true];
}

/**
 * @param array<string,mixed> $row fila lista_espera
 * @param array{id:int,nombre_completo:string,nombre:string,apellido:string,telefono:string,dni:string,email:string}|null $paciente
 * @return array{row:array<string,mixed>,used_id:bool}
 */
function kinesica_rel_enrich_lista_row(array $row, ?array $paciente): array
{
    if ($paciente === null) {
        return ['row' => $row, 'used_id' => false];
    }
    $display = kinesica_rel_paciente_display_name($paciente);
    if ($display !== '') {
        $row['paciente_nombre'] = $display;
    }
    if ($paciente['telefono'] !== '') {
        $row['paciente_telefono'] = $paciente['telefono'];
    }
    $row['paciente_id'] = $paciente['id'];
    return ['row' => $row, 'used_id' => true];
}

/**
 * Aplica REL_READ_IDS a una lista de fichas (payload + paciente_id opcional).
 *
 * @param list<array{payload?:string,paciente_id?:mixed}> $rows
 * @return list<array<string,mixed>>
 */
function kinesica_rel_map_ficha_rows(PDO $pdo, array $rows): array
{
    $readIds = kinesica_rel_read_ids();
    $hasCol = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $ids = [];
    if ($readIds && $hasCol) {
        foreach ($rows as $row) {
            $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
            if ($pid > 0) {
                $ids[] = $pid;
            }
        }
    }
    $map = $ids !== [] ? kinesica_rel_fetch_pacientes_map($pdo, $ids) : [];

    $items = [];
    foreach ($rows as $row) {
        $item = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($item)) {
            continue;
        }
        if (isset($item['nombre']) && function_exists('sanitize_patient_name')) {
            $item['nombre'] = sanitize_patient_name((string) $item['nombre']);
        }
        $pid = $hasCol && isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
        if ($readIds) {
            if ($pid > 0 && isset($map[$pid])) {
                $enriched = kinesica_rel_enrich_ficha_payload($item, $map[$pid]);
                $item = $enriched['payload'];
            } else {
                kinesica_rel_note_read_fallback('fichas', $pid > 0 ? 'paciente_id_huerfano' : 'sin_paciente_id');
            }
        }
        if (array_key_exists('version', $row) && $row['version'] !== null && $row['version'] !== '') {
            $item['version'] = (int) $row['version'];
        }
        $items[] = $item;
    }
    return $items;
}

/**
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */
function kinesica_rel_map_lista_rows(PDO $pdo, array $rows): array
{
    $readIds = kinesica_rel_read_ids();
    if (!$readIds) {
        return $rows;
    }
    $hasCol = kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id');
    if (!$hasCol) {
        foreach ($rows as $_) {
            kinesica_rel_note_read_fallback('lista_espera', 'sin_columna');
        }
        return $rows;
    }
    $ids = [];
    foreach ($rows as $row) {
        $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
        if ($pid > 0) {
            $ids[] = $pid;
        }
    }
    $map = $ids !== [] ? kinesica_rel_fetch_pacientes_map($pdo, $ids) : [];
    $out = [];
    foreach ($rows as $row) {
        $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
        if ($pid > 0 && isset($map[$pid])) {
            $out[] = kinesica_rel_enrich_lista_row($row, $map[$pid])['row'];
        } else {
            kinesica_rel_note_read_fallback('lista_espera', $pid > 0 ? 'paciente_id_huerfano' : 'sin_paciente_id');
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * Nombre/email canónicos para recordatorios/interacciones.
 *
 * @param array{id:int,nombre_completo:string,nombre:string,apellido:string,telefono:string,dni:string,email:string}|null $paciente
 * @return array{name:string,email:string,phone:string}
 */
function kinesica_rel_display_from_paciente(?array $paciente): array
{
    if ($paciente === null) {
        return ['name' => '', 'email' => '', 'phone' => ''];
    }
    return [
        'name' => kinesica_rel_paciente_display_name($paciente),
        'email' => $paciente['email'],
        'phone' => $paciente['telefono'],
    ];
}
