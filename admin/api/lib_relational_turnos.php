<?php
declare(strict_types=1);

/**
 * Turnos sombra (espejo local de Google Calendar).
 *
 * Tabla: migrations/006_turnos.php — UNIQUE(calendar_event_id).
 * Upsert idempotente; no pisa paciente_id/profesional_id existentes con NULL.
 * Fuentes: campaña GAS, recordatorios, booking (admin/backup), mirror GAS → turnos.php.
 * Cancelar turno marca status=cancelled y anula recordatorios pending.
 *
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

/** @var list<string> */
const KINESICA_REL_TURNO_STATUSES = ['scheduled', 'cancelled', 'completed', 'unknown'];

/** @var list<string> */
const KINESICA_REL_TURNO_SOURCES = ['gas', 'recordatorio', 'manual', 'backfill', 'booking', 'backup'];

function kinesica_rel_turnos_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'turnos');
}

function kinesica_rel_normalize_calendar_event_id(string $raw): string
{
    $id = trim($raw);
    if ($id === '' || $id === '_run') {
        return '';
    }
    return substr($id, 0, 128);
}

/**
 * @param array{
 *   calendar_event_id:string,
 *   paciente_id?:?int,
 *   profesional_id?:?int,
 *   starts_at?:?string,
 *   ends_at?:?string,
 *   status?:string,
 *   summary?:string,
 *   patient_name_snapshot?:string,
 *   source?:string
 * } $data
 * @return int|null id del turno o null si no se pudo upsert
 */
function kinesica_rel_upsert_turno_by_calendar_event(PDO $pdo, array $data): ?int
{
    if (!kinesica_rel_turnos_ready($pdo)) {
        return null;
    }
    $calId = kinesica_rel_normalize_calendar_event_id((string) ($data['calendar_event_id'] ?? ''));
    if ($calId === '') {
        return null;
    }

    $status = strtolower(trim((string) ($data['status'] ?? 'scheduled')));
    if (!in_array($status, KINESICA_REL_TURNO_STATUSES, true)) {
        $status = 'unknown';
    }
    $source = strtolower(trim((string) ($data['source'] ?? 'manual')));
    if (!in_array($source, KINESICA_REL_TURNO_SOURCES, true)) {
        $source = 'manual';
    }

    $pacienteId = isset($data['paciente_id']) && $data['paciente_id'] !== null && (int) $data['paciente_id'] > 0
        ? (int) $data['paciente_id']
        : null;
    $profesionalId = isset($data['profesional_id']) && $data['profesional_id'] !== null && (int) $data['profesional_id'] > 0
        ? (int) $data['profesional_id']
        : null;
    $startsAt = kinesica_rel_turnos_normalize_datetime($data['starts_at'] ?? null);
    $endsAt = kinesica_rel_turnos_normalize_datetime($data['ends_at'] ?? null);
    $summary = mb_substr(trim((string) ($data['summary'] ?? '')), 0, 255, 'UTF-8');
    $nameSnap = mb_substr(trim((string) ($data['patient_name_snapshot'] ?? '')), 0, 120, 'UTF-8');

    $find = $pdo->prepare('SELECT id, paciente_id, profesional_id FROM turnos WHERE calendar_event_id = :c LIMIT 1');
    $find->execute(['c' => $calId]);
    $existing = $find->fetch(PDO::FETCH_ASSOC);

    if (is_array($existing)) {
        $id = (int) $existing['id'];
        $keepPid = $existing['paciente_id'] !== null && $existing['paciente_id'] !== ''
            ? (int) $existing['paciente_id']
            : null;
        $keepProf = $existing['profesional_id'] !== null && $existing['profesional_id'] !== ''
            ? (int) $existing['profesional_id']
            : null;
        $nextPid = $pacienteId ?? $keepPid;
        $nextProf = $profesionalId ?? $keepProf;

        $nextSummary = $summary !== '' ? $summary : null;
        $nextName = $nameSnap !== '' ? $nameSnap : null;
        $upd = $pdo->prepare(
            'UPDATE turnos SET
                paciente_id = :pid,
                profesional_id = :prof,
                starts_at = COALESCE(:starts, starts_at),
                ends_at = COALESCE(:ends, ends_at),
                status = :status,
                summary = COALESCE(:summary, summary),
                patient_name_snapshot = COALESCE(:name, patient_name_snapshot),
                source = :source,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $upd->execute([
            'pid' => $nextPid,
            'prof' => $nextProf,
            'starts' => $startsAt,
            'ends' => $endsAt,
            'status' => $status,
            'summary' => $nextSummary,
            'name' => $nextName,
            'source' => $source,
            'id' => $id,
        ]);
        return $id;
    }

    $ins = $pdo->prepare(
        'INSERT INTO turnos (
            paciente_id, profesional_id, calendar_event_id, starts_at, ends_at,
            status, summary, patient_name_snapshot, source
         ) VALUES (
            :pid, :prof, :cal, :starts, :ends, :status, :summary, :name, :source
         )'
    );
    try {
        $ins->execute([
            'pid' => $pacienteId,
            'prof' => $profesionalId,
            'cal' => $calId,
            'starts' => $startsAt,
            'ends' => $endsAt,
            'status' => $status,
            'summary' => $summary,
            'name' => $nameSnap,
            'source' => $source,
        ]);
    } catch (PDOException $e) {
        // Carrera: otro proceso insertó el mismo calendar_event_id → merge (no descartar datos).
        $find->execute(['c' => $calId]);
        $again = $find->fetch(PDO::FETCH_ASSOC);
        if (is_array($again)) {
            return kinesica_rel_upsert_turno_by_calendar_event($pdo, $data);
        }
        throw $e;
    }

    $newId = (int) $pdo->lastInsertId();
    return $newId > 0 ? $newId : null;
}

function kinesica_rel_turnos_normalize_datetime(mixed $raw): ?string
{
    if ($raw === null || $raw === '') {
        return null;
    }
    $s = trim((string) $raw);
    if ($s === '') {
        return null;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        return $s . ' 00:00:00';
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/', $s)) {
        $s = str_replace('T', ' ', $s);
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $s)) {
            $s .= ':00';
        }
        return $s;
    }
    return null;
}

/**
 * Combina fecha + hora de recordatorio en DATETIME local/naive.
 */
function kinesica_rel_turnos_datetime_from_appt(?string $date, string $time = ''): ?string
{
    $date = trim((string) $date);
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return null;
    }
    $time = trim($time);
    if ($time !== '' && preg_match('/^(\d{1,2}):(\d{2})/', $time, $m)) {
        return sprintf('%s %02d:%02d:00', $date, (int) $m[1], (int) $m[2]);
    }
    return $date . ' 00:00:00';
}

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
function kinesica_rel_cancel_turno(PDO $pdo, array $ref): array
{
    $out = [
        'ok' => false,
        'turno_id' => null,
        'calendar_event_id' => '',
        'reminders_updated' => 0,
    ];
    if (!kinesica_rel_turnos_ready($pdo)) {
        $out['reason'] = 'turnos_table_missing';
        return $out;
    }

    $turnoId = isset($ref['turno_id']) ? (int) $ref['turno_id'] : 0;
    $calId = kinesica_rel_normalize_calendar_event_id((string) ($ref['calendar_event_id'] ?? ''));

    if ($turnoId > 0) {
        $stmt = $pdo->prepare('SELECT id, calendar_event_id, status FROM turnos WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $turnoId]);
    } elseif ($calId !== '') {
        $stmt = $pdo->prepare('SELECT id, calendar_event_id, status FROM turnos WHERE calendar_event_id = :c LIMIT 1');
        $stmt->execute(['c' => $calId]);
    } else {
        $out['reason'] = 'missing_ref';
        return $out;
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        if ($calId !== '') {
            $tid = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
                'calendar_event_id' => $calId,
                'status' => 'cancelled',
                'source' => 'manual',
            ]);
            $out['turno_id'] = $tid;
            $out['calendar_event_id'] = $calId;
            $out['reminders_updated'] = kinesica_rel_cancel_recordatorios_for_calendar_event($pdo, $calId, $tid);
            $out['ok'] = true;
            return $out;
        }
        $out['reason'] = 'not_found';
        return $out;
    }

    $turnoId = (int) $row['id'];
    $calId = kinesica_rel_normalize_calendar_event_id((string) $row['calendar_event_id']);
    $pdo->prepare(
        'UPDATE turnos SET status = \'cancelled\', updated_at = CURRENT_TIMESTAMP WHERE id = :id'
    )->execute(['id' => $turnoId]);

    $out['turno_id'] = $turnoId;
    $out['calendar_event_id'] = $calId;
    $out['reminders_updated'] = kinesica_rel_cancel_recordatorios_for_calendar_event($pdo, $calId, $turnoId);
    $out['ok'] = true;
    return $out;
}

/**
 * Marca recordatorios no terminales del evento como skipped/cancelled.
 */
function kinesica_rel_cancel_recordatorios_for_calendar_event(PDO $pdo, string $calId, ?int $turnoId = null): int
{
    $calId = kinesica_rel_normalize_calendar_event_id($calId);
    if ($calId === '' || !kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        return 0;
    }
    $updated = 0;
    try {
        $stmt = $pdo->prepare(
            'UPDATE recordatorio_eventos
             SET status = \'skipped\', skip_reason = \'cancelled\'
             WHERE calendar_event_id = :c
               AND status IN (\'pending\', \'missing_phone\', \'failed\')'
        );
        $stmt->execute(['c' => $calId]);
        $updated = $stmt->rowCount();

        if (
            $turnoId !== null
            && $turnoId > 0
            && kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id')
        ) {
            $link = $pdo->prepare(
                'UPDATE recordatorio_eventos SET turno_id = COALESCE(turno_id, :tid)
                 WHERE calendar_event_id = :c AND turno_id IS NULL'
            );
            $link->execute(['tid' => $turnoId, 'c' => $calId]);
        }
    } catch (Throwable $e) {
        error_log('kinesica rel cancel recordatorios: ' . $e->getMessage());
    }
    return $updated;
}
