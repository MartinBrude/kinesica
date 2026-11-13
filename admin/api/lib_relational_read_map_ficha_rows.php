<?php
declare(strict_types=1);


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
