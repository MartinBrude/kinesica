<?php
declare(strict_types=1);


/**
 * Upsert best-effort desde una fila de campaña (GAS list_appointments).
 *
 * @param array<string,mixed> $row salida de campana_build_rows / appt enriquecido
 */
function kinesica_rel_upsert_turno_from_campana_row(PDO $pdo, array $row): ?int
{
    $calId = kinesica_rel_normalize_calendar_event_id((string) ($row['calendar_event_id'] ?? ''));
    if ($calId === '') {
        return null;
    }
    $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
    $starts = kinesica_rel_turnos_datetime_from_appt(
        isset($row['fecha']) ? (string) $row['fecha'] : null,
        (string) ($row['hora'] ?? $row['time'] ?? '')
    );
    return kinesica_rel_upsert_turno_by_calendar_event($pdo, [
        'calendar_event_id' => $calId,
        'paciente_id' => $pid > 0 ? $pid : null,
        'starts_at' => $starts,
        'status' => 'scheduled',
        'summary' => (string) ($row['patient_name_raw'] ?? ''),
        'patient_name_snapshot' => (string) ($row['patient_name_raw'] ?? trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''))),
        'source' => 'gas',
    ]);
}

/**
 * Sync sombra desde lista de filas de campaña. No lanza: errores se loguean.
 *
 * @param list<array<string,mixed>> $rows
 * @return array{attempted:int,upserted:int,skipped:int}
 */

/**
 * Sync sombra desde lista de filas de campaña. No lanza: errores se loguean.
 *
 * @param list<array<string,mixed>> $rows
 * @return array{attempted:int,upserted:int,skipped:int}
 */
function kinesica_rel_sync_turnos_from_campana_rows(PDO $pdo, array $rows): array
{
    $stats = ['attempted' => 0, 'upserted' => 0, 'skipped' => 0];
    if (!kinesica_rel_turnos_ready($pdo)) {
        return $stats;
    }
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $stats['attempted']++;
        try {
            $id = kinesica_rel_upsert_turno_from_campana_row($pdo, $row);
            if ($id !== null) {
                $stats['upserted']++;
            } else {
                $stats['skipped']++;
            }
        } catch (Throwable $e) {
            $stats['skipped']++;
            error_log('kinesica rel turnos campana upsert: ' . $e->getMessage());
        }
    }
    return $stats;
}

/**
 * Backfill: crear turnos desde calendar_event_id distintos en recordatorio_eventos.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */

/**
 * Backfill: crear turnos desde calendar_event_id distintos en recordatorio_eventos.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_turnos_from_recordatorios(PDO $pdo, bool $apply): array
{
    $stats = [
        'table' => 'turnos',
        'scanned' => 0,
        'already_set' => 0,
        'updated' => 0,
        'matched' => 0,
        'unmatched' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
    if (!kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_rel_turnos_ready($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $hasPid = kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id');
    // Una fila representativa por calendar_event_id (MIN id).
    $rows = $pdo->query(
        "SELECT r.calendar_event_id, r.patient_name, r.appointment_date, r.appointment_time,
                r.event_summary" . ($hasPid ? ', r.paciente_id' : '') . "
         FROM recordatorio_eventos r
         INNER JOIN (
            SELECT calendar_event_id, MIN(id) AS min_id
            FROM recordatorio_eventos
            WHERE calendar_event_id IS NOT NULL AND calendar_event_id != '' AND calendar_event_id != '_run'
            GROUP BY calendar_event_id
         ) g ON r.id = g.min_id"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $find = $pdo->prepare('SELECT id FROM turnos WHERE calendar_event_id = :c LIMIT 1');

    foreach ($rows as $row) {
        $stats['scanned']++;
        $calId = kinesica_rel_normalize_calendar_event_id((string) ($row['calendar_event_id'] ?? ''));
        if ($calId === '') {
            $stats['unmatched']++;
            continue;
        }
        $find->execute(['c' => $calId]);
        $existingId = $find->fetchColumn();
        if ($existingId) {
            $stats['already_set']++;
            continue;
        }
        $stats['matched']++;
        $pid = $hasPid && isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
            ? (int) $row['paciente_id']
            : null;
        if ($apply) {
            $tid = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
                'calendar_event_id' => $calId,
                'paciente_id' => $pid && $pid > 0 ? $pid : null,
                'starts_at' => kinesica_rel_turnos_datetime_from_appt(
                    $row['appointment_date'] !== null ? (string) $row['appointment_date'] : null,
                    (string) ($row['appointment_time'] ?? '')
                ),
                'status' => 'scheduled',
                'summary' => (string) ($row['event_summary'] ?? ''),
                'patient_name_snapshot' => (string) ($row['patient_name'] ?? ''),
                'source' => 'backfill',
            ]);
            if ($tid !== null) {
                $stats['updated']++;
            }
        }
        if (count($stats['samples']) < 25) {
            $stats['samples'][] = [
                'calendar_event_id' => substr($calId, 0, 24),
                'status' => 'matched',
                'paciente_id' => $pid,
            ];
        }
    }

    return $stats;
}

/**
 * Asigna recordatorio_eventos.turno_id desde turnos por calendar_event_id.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
