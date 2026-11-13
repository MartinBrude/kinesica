<?php
declare(strict_types=1);


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
