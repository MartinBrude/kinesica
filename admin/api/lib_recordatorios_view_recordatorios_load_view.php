<?php
declare(strict_types=1);


/**
 * @return array{items:list,grouped:array,counts:array,total:int,days:int}
 */
function recordatorios_load_view(?PDO $pdo = null, int $days = RECORDATORIOS_DEFAULT_DAYS): array
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $days = max(1, min(90, $days));
    $since = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('-' . $days . ' days')
        ->format('Y-m-d H:i:s');

    try {
        $todayBA = (new DateTimeImmutable('now', recordatorios_tz()))->format('Y-m-d');
        $pdo->prepare('DELETE FROM recordatorio_eventos WHERE status = "pending" AND appointment_date IS NOT NULL AND appointment_date != "" AND appointment_date < :today')->execute(['today' => $todayBA]);
        // Casos de prueba ya resueltos (mantener pending para poder enviar).
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE (calendar_event_id LIKE 'test:%' OR exec_id = 'manual-test' OR event_summary LIKE '[PRUEBA]%') AND status != 'pending'");
        // Limpiar ruido de corridas omitidas (Clara pausada) y bloqueos.
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE status = 'run_skipped' OR skip_reason = 'clara_inactive'");
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE skip_reason = 'blocked' OR LOWER(patient_name) LIKE '%no dar%' OR LOWER(event_summary) LIKE '%no dar%' OR LOWER(patient_name) LIKE '%bloqueado%' OR LOWER(event_summary) LIKE '%bloqueado%' OR LOWER(patient_name) LIKE '%tk3%' OR LOWER(event_summary) LIKE '%tk3%' OR LOWER(patient_name) LIKE '%tk 3%' OR LOWER(event_summary) LIKE '%tk 3%'");
        // Si hay sent, borrar pending/missing_phone del mismo evento. failed se conserva para auditoría.
        $pdo->exec("DELETE pend FROM recordatorio_eventos pend
                    INNER JOIN recordatorio_eventos sent
                      ON (
                        pend.calendar_event_id = sent.calendar_event_id
                        OR REPLACE(pend.calendar_event_id, '@google.com', '') = REPLACE(sent.calendar_event_id, '@google.com', '')
                      )
                     AND pend.calendar_event_id != ''
                     AND pend.calendar_event_id != '_run'
                     AND pend.status IN ('pending', 'missing_phone')
                     AND sent.status IN ('sent', 'sent_email')");
        // Si el evento fue cancelado o eliminado, borrar pending/missing_phone huérfano.
        $pdo->exec("DELETE pend FROM recordatorio_eventos pend
                    INNER JOIN recordatorio_eventos sk
                      ON (
                        pend.calendar_event_id = sk.calendar_event_id
                        OR REPLACE(pend.calendar_event_id, '@google.com', '') = REPLACE(sk.calendar_event_id, '@google.com', '')
                      )
                     AND pend.calendar_event_id != ''
                     AND pend.calendar_event_id != '_run'
                     AND pend.status IN ('pending', 'missing_phone')
                     AND sk.status = 'skipped'
                     AND sk.skip_reason IN ('cancelled', 'event_gone', 'event_moved')");
        $pdo->exec("DELETE r1 FROM recordatorio_eventos r1
                    JOIN recordatorio_eventos r2
                      ON (
                        r1.calendar_event_id = r2.calendar_event_id
                        OR REPLACE(r1.calendar_event_id, '@google.com', '') = REPLACE(r2.calendar_event_id, '@google.com', '')
                      )
                     AND r1.calendar_event_id != ''
                     AND r1.calendar_event_id != '_run'
                     AND r1.id < r2.id
                     AND r1.status = r2.status");
    } catch (Throwable $e) {
        error_log('kinesica recordatorios view: dedupe cleanup: ' . $e->getMessage());
    }

    $hasPacienteCol = false;
    try {
        require_once __DIR__ . '/lib_migrations.php';
        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id');
    } catch (Throwable) {
    }
    $selectPid = $hasPacienteCol ? ', paciente_id' : '';
    $stmt = $pdo->prepare(
        'SELECT id, event_key, exec_id, run_at, appointment_date, appointment_time, calendar_event_id,
                patient_name, wa_id, status, skip_reason, error_code, error_message, event_summary, received_at'
        . $selectPid . '
         FROM recordatorio_eventos
         WHERE (run_at >= :since OR status = "pending")
           AND status != "run_skipped"
           AND skip_reason != "clara_inactive"
           AND skip_reason != "blocked"
           AND LOWER(patient_name) NOT LIKE "%no dar%"
           AND LOWER(event_summary) NOT LIKE "%no dar%"
           AND LOWER(patient_name) NOT LIKE "%bloqueado%"
           AND LOWER(event_summary) NOT LIKE "%bloqueado%"
           AND LOWER(patient_name) NOT LIKE "%tk3%"
           AND LOWER(event_summary) NOT LIKE "%tk3%"
           AND LOWER(patient_name) NOT LIKE "%tk 3%"
           AND LOWER(event_summary) NOT LIKE "%tk 3%"
         ORDER BY run_at DESC, id DESC
         LIMIT 2000'
    );
    $stmt->execute(['since' => $since]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $directory = recordatorios_lookup_directory_contacts($pdo, $rows);

    // REL: enrich display name por paciente_id si REL_READ_IDS (lib_relational_read.php).
    $pacientesById = [];
    try {
        require_once __DIR__ . '/lib_relational_read.php';
        if (kinesica_rel_read_ids() && $hasPacienteCol) {
            $pids = [];
            foreach ($rows as $r) {
                $pid = isset($r['paciente_id']) ? (int) $r['paciente_id'] : 0;
                if ($pid > 0) {
                    $pids[] = $pid;
                }
            }
            $pacientesById = kinesica_rel_fetch_pacientes_map($pdo, $pids);
        }
    } catch (Throwable) {
        $pacientesById = [];
    }

    $counts = [
        'pending' => 0,
        'sent' => 0,
        'sent_email' => 0,
        'failed' => 0,
        'missing_phone' => 0,
        'skipped' => 0,
        'run_skipped' => 0,
    ];
    $items = [];
    $grouped = [];

    foreach ($rows as $r) {
        if (recordatorios_is_blocked_event($r)) {
            continue;
        }
        $status = (string) ($r['status'] ?? '');
        if (isset($counts[$status])) {
            $counts[$status]++;
        }
        $phoneEnd = substr(recordatorios_clean_wa_id((string) ($r['wa_id'] ?? '')), -10);
        $nameKey = mb_strtolower(trim((string) ($r['patient_name'] ?? '')));
        $email = '';
        $pid = isset($r['paciente_id']) ? (int) $r['paciente_id'] : 0;

        // Normalización de nombre: nunca tumbar la vista entera por un caso raro.
        try {
            if (function_exists('kinesica_correct_inverted_patient_name')) {
                $correctedName = kinesica_correct_inverted_patient_name((string) ($r['patient_name'] ?? ''));
                if ($correctedName !== '' && $correctedName !== (string) ($r['patient_name'] ?? '')) {
                    $r['patient_name'] = $correctedName;
                    $nameKey = mb_strtolower($r['patient_name']);
                }
            } elseif (str_contains((string) ($r['patient_name'] ?? ''), ',')) {
                $parts = explode(',', (string) $r['patient_name'], 2);
                if (trim($parts[0]) !== '' && trim($parts[1]) !== '') {
                    $r['patient_name'] = trim($parts[1]) . ' ' . trim($parts[0]);
                    $nameKey = mb_strtolower($r['patient_name']);
                }
            }

            if ($pid <= 0 && $nameKey !== '') {
                $matchedPatient = function_exists('find_existing_patient_match')
                    ? find_existing_patient_match($pdo, (string) ($r['wa_id'] ?? ''), (string) ($r['patient_name'] ?? ''))
                    : null;
                if ($matchedPatient && !empty($matchedPatient['id'])) {
                    $candName = (string) ($matchedPatient['nombre_completo'] ?? trim(($matchedPatient['nombre'] ?? '') . ' ' . ($matchedPatient['apellido'] ?? '')));
                    // Si el paciente encontrado por teléfono tiene un nombre incompatible con el turno,
                    // es un teléfono compartido (ej. cónyuge/familiar). NO atribuir el turno a este paciente.
                    if ($candName === '' || !function_exists('kinesica_names_compatible') || kinesica_names_compatible((string) ($r['patient_name'] ?? ''), $candName)) {
                        $pid = (int) $matchedPatient['id'];
                        $pacientesById[$pid] = $matchedPatient;
                    } else {
                        // Buscar si existe el paciente real por nombre
                        $byName = function_exists('kinesica_match_patient')
                            ? kinesica_match_patient($pdo, ['name' => (string) ($r['patient_name'] ?? '')], 'strict')
                            : null;
                        if ($byName && !empty($byName['id'])) {
                            $pid = (int) $byName['id'];
                            $pacientesById[$pid] = $byName;
                        }
                    }
                }
            }

            if ($pid > 0 && isset($pacientesById[$pid])) {
                $disp = kinesica_rel_display_from_paciente($pacientesById[$pid]);
                if ($disp['name'] !== '') {
                    $currentName = trim((string) ($r['patient_name'] ?? ''));
                    if ($currentName === '' || is_tk3_or_blocked_name($currentName) || (function_exists('kinesica_names_compatible') && kinesica_names_compatible($currentName, $disp['name']))) {
                        $r['patient_name'] = $disp['name'];
                    }
                }
                if ($disp['phone'] !== '' && trim((string) ($r['wa_id'] ?? '')) === '') {
                    $r['wa_id'] = preg_replace('/\D+/', '', $disp['phone']) ?? $disp['phone'];
                }
                if ($disp['email'] !== '') {
                    $email = $disp['email'];
                }
            } elseif (function_exists('kinesica_rel_read_ids') && kinesica_rel_read_ids()) {
                kinesica_rel_note_read_fallback('recordatorios', $pid > 0 ? 'paciente_id_huerfano' : 'sin_paciente_id');
            }
        } catch (Throwable $e) {
            error_log('recordatorios enrich row: ' . $e->getMessage());
        }
        if (trim((string) ($r['wa_id'] ?? '')) === '' && $nameKey !== '') {
            if (!empty($directory['phone_by_name'][$nameKey])) {
                $r['wa_id'] = $directory['phone_by_name'][$nameKey];
                $phoneEnd = substr(recordatorios_clean_wa_id($r['wa_id']), -10);
            } elseif (function_exists('canonical_patient_name_key')) {
                $canon = canonical_patient_name_key($nameKey);
                if ($canon !== '' && !empty($directory['phone_by_name'][$canon])) {
                    $r['wa_id'] = $directory['phone_by_name'][$canon];
                    $phoneEnd = substr(recordatorios_clean_wa_id($r['wa_id']), -10);
                }
            }
        }
        if ($email === '') {
            if ($phoneEnd !== '' && isset($directory['by_phone'][$phoneEnd])) {
                $email = $directory['by_phone'][$phoneEnd];
            } elseif ($nameKey !== '' && isset($directory['by_name'][$nameKey])) {
                $email = $directory['by_name'][$nameKey];
            } elseif (function_exists('canonical_patient_name_key')) {
                $canon = canonical_patient_name_key($nameKey);
                if ($canon !== '' && isset($directory['by_name'][$canon])) {
                    $email = $directory['by_name'][$canon];
                }
            }
        }
        $item = recordatorios_format_item($r, $email !== '' ? $email : null);
        if ($pid > 0) {
            $item['paciente_id'] = $pid;
        }
        $items[] = $item;
        $runDay = $item['run_day'] !== '' ? $item['run_day'] : 'sin-fecha';
        if (!isset($grouped[$runDay])) {
            $grouped[$runDay] = [];
        }
        $grouped[$runDay][] = $item;

        // Auto-sincronizar pacientes existentes en los eventos de recordatorios con la tabla `pacientes`
        try {
            require_once __DIR__ . '/lib_recordatorios_view_sync_directory.php';
            recordatorios_sync_item_to_directory($pdo, $item, $r, $email, $directory);
        } catch (Throwable $e) {
            error_log('recordatorios sync directory: ' . $e->getMessage());
        }
    }

    return [
        'items' => $items,
        'grouped' => $grouped,
        'counts' => $counts,
        'total' => count($items),
        'days' => $days,
    ];
}
