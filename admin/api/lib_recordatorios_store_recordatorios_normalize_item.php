<?php
declare(strict_types=1);


/**
 * @return array{
 *   event_key:string,exec_id:string,run_at:int,appointment_date:?string,appointment_time:string,
 *   calendar_event_id:string,patient_name:string,wa_id:string,status:string,skip_reason:string,
 *   error_code:string,error_message:string,event_summary:string,event_description:string,dni:string
 * }|null
 */
function recordatorios_normalize_item(array $in, string $execId, int $runAt): ?array
{
    $status = strtolower(trim((string) ($in['status'] ?? '')));
    if (!in_array($status, RECORDATORIOS_STATUSES, true)) {
        return null;
    }
    $calId = trim((string) ($in['calendar_event_id'] ?? $in['event_id'] ?? ''));
    // "Corrida omitida / Clara inactiva" no aporta al historial clínico: no se guarda.
    if ($status === 'run_skipped') {
        return null;
    }
    if ($calId === '') {
        return null;
    }
    $skip = strtolower(trim((string) ($in['skip_reason'] ?? '')));
    if ($skip === 'clara_inactive') {
        return null;
    }
    if ($skip !== '' && !in_array($skip, RECORDATORIOS_SKIP_REASONS, true)) {
        $skip = 'other';
    }

    $nameRaw = (string) ($in['patient_name'] ?? $in['patient_full_name'] ?? '');
    $summaryRaw = (string) ($in['event_summary'] ?? '');
    $descriptionRaw = (string) ($in['event_description'] ?? $in['description'] ?? $in['event_desc'] ?? '');
    $name = mb_strtolower(trim($nameRaw));
    $summary = mb_strtolower(trim($summaryRaw));

    if (function_exists('is_tk3_or_blocked_name')) {
        if (is_tk3_or_blocked_name($nameRaw) || is_tk3_or_blocked_name($summaryRaw)) {
            return null;
        }
    }

    if ($skip === 'blocked' || str_contains($name, 'no dar') || str_contains($summary, 'no dar') || str_contains($name, 'bloqueado') || str_contains($summary, 'bloqueado') || str_contains($name, 'tk3') || str_contains($summary, 'tk3') || str_contains($name, 'tk 3') || str_contains($summary, 'tk 3')) {
        return null;
    }

    $safeExec = substr(preg_replace('/[^A-Za-z0-9_\-]/', '', $execId) ?? '', 0, 64);
    if ($safeExec === '') {
        $safeExec = 'na';
    }
    $safeCal = substr(preg_replace('/[^A-Za-z0-9_\-@.]/', '', $calId) ?? '', 0, 100);
    $key = 'rem:' . $safeExec . ':' . $safeCal . ':' . $status;
    $apptDate = trim((string) ($in['appointment_date'] ?? ''));
    if ($apptDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $apptDate)) {
        $apptDate = '';
    }
    $errMsg = trim((string) ($in['error_message'] ?? ''));
    if (mb_strlen($errMsg, 'UTF-8') > 500) {
        $errMsg = mb_substr($errMsg, 0, 500, 'UTF-8');
    }

    $waId = substr(recordatorios_clean_wa_id((string) ($in['wa_id'] ?? $in['to'] ?? '')), 0, 32);
    $contact = kinesica_extract_calendar_contacts(
        trim($nameRaw . ' ' . $summaryRaw),
        $descriptionRaw
    );
    if ($waId === '' && $contact['phone'] !== '') {
        $waId = substr(recordatorios_clean_wa_id($contact['phone']), 0, 32);
    }
    $dni = clean_patient_dni((string) ($in['dni'] ?? $in['documento'] ?? ''));
    if ($dni === '' && $contact['dni'] !== '') {
        $dni = $contact['dni'];
    }

    return [
        'event_key' => substr($key, 0, 160),
        'exec_id' => $safeExec,
        'run_at' => $runAt,
        'appointment_date' => $apptDate !== '' ? $apptDate : null,
        'appointment_time' => substr(trim((string) ($in['appointment_time'] ?? $in['formatted_time'] ?? '')), 0, 16),
        'calendar_event_id' => substr($calId, 0, 128),
        'patient_name' => mb_substr(trim((string) ($in['patient_name'] ?? $in['patient_full_name'] ?? '')), 0, 120, 'UTF-8'),
        'wa_id' => $waId,
        'status' => $status,
        'skip_reason' => substr($skip, 0, 40),
        'error_code' => substr(trim((string) ($in['error_code'] ?? '')), 0, 32),
        'error_message' => $errMsg,
        'event_summary' => mb_substr(trim((string) ($in['event_summary'] ?? '')), 0, 255, 'UTF-8'),
        'event_description' => mb_substr(trim($descriptionRaw), 0, 2000, 'UTF-8'),
        'dni' => $dni,
    ];
}


function recordatorios_is_duplicate_error(PDOException $e): bool
{
    return (string) $e->getCode() === '23000' || (int) ($e->errorInfo[1] ?? 0) === 1062;
}

/** @return string 'stored'|'duplicate' */

/** @return string 'stored'|'duplicate' */
function recordatorios_insert_item(PDO $pdo, array $ev): string
{
    // REL: paciente_id en insert recordatorios solo con REL_WRITE_IDS.
    $pacienteId = null;
    $turnoId = null;
    $hasPacienteCol = false;
    $hasTurnoCol = false;
    try {
        require_once __DIR__ . '/lib_relational_resolve.php';
        require_once __DIR__ . '/lib_migrations.php';
        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id');
        $hasTurnoCol = kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id');
        if (kinesica_rel_write_ids() && $hasPacienteCol) {
            $pacienteId = kinesica_rel_resolve_paciente_id_or_note($pdo, 'recordatorios', [
                'wa_id' => (string) ($ev['wa_id'] ?? ''),
                'phone' => (string) ($ev['wa_id'] ?? ''),
                'dni' => (string) ($ev['dni'] ?? ''),
                'nombre' => (string) ($ev['patient_name'] ?? ''),
            ]);
        }
        // REL: sombra turnos + turno_id (no requiere WRITE_IDS; UNIQUE por calendar_event_id).
        if ($hasTurnoCol) {
            require_once __DIR__ . '/lib_relational_turnos.php';
            $cal = (string) ($ev['calendar_event_id'] ?? '');
            if (kinesica_rel_normalize_calendar_event_id($cal) !== '') {
                $turnoId = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
                    'calendar_event_id' => $cal,
                    'paciente_id' => $pacienteId,
                    'starts_at' => kinesica_rel_turnos_datetime_from_appt(
                        isset($ev['appointment_date']) ? (string) $ev['appointment_date'] : null,
                        (string) ($ev['appointment_time'] ?? '')
                    ),
                    'status' => 'scheduled',
                    'summary' => (string) ($ev['event_summary'] ?? ''),
                    'patient_name_snapshot' => (string) ($ev['patient_name'] ?? ''),
                    'source' => 'recordatorio',
                ]);
            }
        }
    } catch (Throwable) {
    }

    $cols = 'event_key, exec_id, run_at, appointment_date, appointment_time, calendar_event_id,
             patient_name, wa_id, status, skip_reason, error_code, error_message, event_summary, received_at';
    $vals = ':k, :exec, :run, :ad, :at, :cal, :name, :wa, :st, :sk, :ec, :em, :sum, :rcv';
    $params = [
        'k' => $ev['event_key'],
        'exec' => $ev['exec_id'],
        'run' => gmdate('Y-m-d H:i:s', (int) $ev['run_at']),
        'ad' => $ev['appointment_date'],
        'at' => $ev['appointment_time'],
        'cal' => $ev['calendar_event_id'],
        'name' => $ev['patient_name'],
        'wa' => $ev['wa_id'],
        'st' => $ev['status'],
        'sk' => $ev['skip_reason'],
        'ec' => $ev['error_code'],
        'em' => $ev['error_message'],
        'sum' => $ev['event_summary'],
        'rcv' => gmdate('Y-m-d H:i:s'),
    ];
    if ($hasPacienteCol) {
        $cols .= ', paciente_id';
        $vals .= ', :pid';
        $params['pid'] = $pacienteId;
    }
    if ($hasTurnoCol) {
        $cols .= ', turno_id';
        $vals .= ', :tid';
        $params['tid'] = $turnoId;
    }
    $sql = "INSERT INTO recordatorio_eventos ({$cols}) VALUES ({$vals})";
    try {
        $pdo->prepare($sql)->execute($params);
        return 'stored';
    } catch (PDOException $e) {
        if (recordatorios_is_duplicate_error($e)) {
            return 'duplicate';
        }
        throw $e;
    }
}

/**
 * @param list<array> $items ya normalizados
 * @return array{stored:int,duplicates:int,failed:int}
 */
