<?php
declare(strict_types=1);


/**
 * Asigna recordatorio_eventos.turno_id desde turnos por calendar_event_id.
 *
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_recordatorios_turno_id(PDO $pdo, bool $apply): array
{
    $stats = [
        'table' => 'recordatorio_eventos.turno_id',
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
    if (!kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_rel_turnos_ready($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $rows = $pdo->query(
        'SELECT id, calendar_event_id, turno_id FROM recordatorio_eventos'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $find = $pdo->prepare('SELECT id FROM turnos WHERE calendar_event_id = :c LIMIT 1');
    $upd = $apply
        ? $pdo->prepare('UPDATE recordatorio_eventos SET turno_id = :tid WHERE id = :id AND turno_id IS NULL')
        : null;

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['turno_id'] !== null && $row['turno_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $calId = kinesica_rel_normalize_calendar_event_id((string) ($row['calendar_event_id'] ?? ''));
        if ($calId === '') {
            $stats['unmatched']++;
            continue;
        }
        $find->execute(['c' => $calId]);
        $tid = $find->fetchColumn();
        if (!$tid) {
            $stats['unmatched']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['id' => (int) $row['id'], 'status' => 'unmatched'];
            }
            continue;
        }
        $stats['matched']++;
        if ($apply && $upd) {
            $upd->execute(['tid' => (int) $tid, 'id' => $row['id']]);
            $stats['updated'] += $upd->rowCount() > 0 ? 1 : 0;
        }
        if (count($stats['samples']) < 25) {
            $stats['samples'][] = [
                'id' => (int) $row['id'],
                'status' => 'matched',
                'turno_id' => (int) $tid,
            ];
        }
    }

    return $stats;
}

/**
 * Registra un turno tras un book exitoso (GAS / admin / calendar_backup).
 *
 * @param array{
 *   calendar_event_id?:string,eventId?:string,event_id?:string,
 *   paciente_id?:?int,profesional?:string,practitionerId?:string,
 *   date?:string,time?:string,starts_at?:?string,ends_at?:?string,
 *   summary?:string,nombre?:string,patient_name?:string,source?:string,
 *   telefono?:string,phone?:string,dni?:string
 * } $booking
 */

/**
 * Registra un turno tras un book exitoso (GAS / admin / calendar_backup).
 *
 * @param array{
 *   calendar_event_id?:string,eventId?:string,event_id?:string,
 *   paciente_id?:?int,profesional?:string,practitionerId?:string,
 *   date?:string,time?:string,starts_at?:?string,ends_at?:?string,
 *   summary?:string,nombre?:string,patient_name?:string,source?:string,
 *   telefono?:string,phone?:string,dni?:string
 * } $booking
 */
function kinesica_rel_register_turno_from_booking(PDO $pdo, array $booking): ?int
{
    if (!kinesica_rel_turnos_ready($pdo)) {
        return null;
    }
    $calId = kinesica_rel_normalize_calendar_event_id((string) (
        $booking['calendar_event_id']
        ?? $booking['eventId']
        ?? $booking['event_id']
        ?? ''
    ));
    if ($calId === '') {
        return null;
    }

    $pacienteId = isset($booking['paciente_id']) ? (int) $booking['paciente_id'] : 0;
    if ($pacienteId <= 0) {
        try {
            require_once __DIR__ . '/lib_relational_resolve.php';
            $res = kinesica_rel_resolve_paciente($pdo, [
                'phone' => (string) ($booking['telefono'] ?? $booking['phone'] ?? ''),
                'dni' => (string) ($booking['dni'] ?? ''),
                'nombre' => (string) ($booking['nombre'] ?? $booking['patient_name'] ?? ''),
            ], ['ignore_flag' => true]);
            if (($res['status'] ?? '') === 'matched' && !empty($res['paciente_id'])) {
                $pacienteId = (int) $res['paciente_id'];
            }
        } catch (Throwable $e) {
            error_log('kinesica turnos booking resolve paciente: ' . $e->getMessage());
            $pacienteId = 0;
        }
    }

    $profesionalId = null;
    $slug = strtolower(trim((string) ($booking['profesional'] ?? $booking['practitionerId'] ?? '')));
    if ($slug !== '' && $slug !== 'indistinto') {
        try {
            require_once __DIR__ . '/lib_relational_resolve.php';
            $profesionalId = kinesica_rel_resolve_profesional_id($pdo, $slug, ['ignore_flag' => true]);
        } catch (Throwable $e) {
            error_log('kinesica turnos booking resolve profesional: ' . $e->getMessage());
            $profesionalId = null;
        }
    }

    $starts = $booking['starts_at'] ?? null;
    if ($starts === null || $starts === '') {
        $starts = kinesica_rel_turnos_datetime_from_appt(
            isset($booking['date']) ? (string) $booking['date'] : null,
            (string) ($booking['time'] ?? '')
        );
    }
    $ends = $booking['ends_at'] ?? null;
    if (($ends === null || $ends === '') && is_string($starts) && $starts !== '') {
        $ts = strtotime($starts);
        if ($ts !== false) {
            $ends = date('Y-m-d H:i:s', $ts + 3600);
        }
    }

    $source = strtolower(trim((string) ($booking['source'] ?? 'booking')));
    if (!in_array($source, KINESICA_REL_TURNO_SOURCES, true)) {
        $source = 'booking';
    }
    $name = (string) ($booking['nombre'] ?? $booking['patient_name'] ?? $booking['summary'] ?? '');

    return kinesica_rel_upsert_turno_by_calendar_event($pdo, [
        'calendar_event_id' => $calId,
        'paciente_id' => $pacienteId > 0 ? $pacienteId : null,
        'profesional_id' => $profesionalId,
        'starts_at' => is_string($starts) ? $starts : null,
        'ends_at' => is_string($ends) ? $ends : null,
        'status' => 'scheduled',
        'summary' => (string) ($booking['summary'] ?? $name),
        'patient_name_snapshot' => $name,
        'source' => $source,
    ]);
}

/**
 * Cancela un turno sombra y anula recordatorios pending vinculados.
 *
 * @param array{calendar_event_id?:string,turno_id?:int} $ref
 * @return array{ok:bool,turno_id:?int,calendar_event_id:string,reminders_updated:int,reason?:string}
 */
