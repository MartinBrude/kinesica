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
        // En MySQL: limpiar registros duplicados manteniendo el último resultado relevante
        $pdo->exec("DELETE r1 FROM recordatorio_eventos r1
                    JOIN recordatorio_eventos r2
                      ON r1.calendar_event_id = r2.calendar_event_id
                     AND r1.calendar_event_id != ''
                     AND r1.calendar_event_id != '_run'
                     AND r1.id < r2.id
                     AND (
                         r1.status = r2.status
                         OR (r2.status IN ('sent', 'sent_email') AND r1.status IN ('failed', 'pending'))
                     )");
    } catch (Throwable $e) {}

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
        if ($pid > 0 && isset($pacientesById[$pid])) {
            $disp = kinesica_rel_display_from_paciente($pacientesById[$pid]);
            if ($disp['name'] !== '') {
                $r['patient_name'] = $disp['name'];
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
        if ($email === '') {
            if ($phoneEnd !== '' && isset($directory['by_phone'][$phoneEnd])) {
                $email = $directory['by_phone'][$phoneEnd];
            } elseif ($nameKey !== '' && isset($directory['by_name'][$nameKey])) {
                $email = $directory['by_name'][$nameKey];
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
        if (!empty($item['wa_id']) && !empty($item['patient_name'])) {
            $rawPhone = clean_phone_number((string) $item['wa_id']);
            $rawName = trim((string) $item['patient_name']);
            if (strlen($rawPhone) >= 6 && strlen($rawPhone) <= 16 && $rawName !== '' && $rawName !== 'Estimado/a paciente' && $rawName !== 'Paciente') {
                if (function_exists('is_tk3_or_blocked_name') && !is_tk3_or_blocked_name($rawName)) {
                    $phoneEndCheck = substr($rawPhone, -10);
                    if (!isset($directory['by_phone'][$phoneEndCheck])) {
                        try {
                            ensure_pacientes_tables($pdo);
                            $existing = function_exists('find_existing_patient_match')
                                ? find_existing_patient_match($pdo, $rawPhone, $rawName)
                                : null;

                            $profInferred = function_exists('infer_practitioner_from_schedule')
                                ? infer_practitioner_from_schedule(
                                    (string) ($item['appointment_date'] ?? $r['appointment_date'] ?? ''),
                                    (string) ($item['appointment_time'] ?? $r['appointment_time'] ?? ''),
                                    (string) (($item['event_summary'] ?? $r['event_summary'] ?? '') . ' ' . ($item['creator'] ?? ''))
                                )
                                : 'indistinto';

                            if ($existing) {
                                $existingId = (int) $existing['id'];
                                $updates = [];
                                $params = ['id' => $existingId];
                                if (function_exists('is_placeholder_phone') && is_placeholder_phone((string) ($existing['telefono'] ?? ''))) {
                                    $updates[] = 'telefono = :tel';
                                    $params['tel'] = $rawPhone;
                                }
                                if (($existing['profesional_habitual'] ?? 'indistinto') === 'indistinto' && $profInferred !== 'indistinto') {
                                    $updates[] = 'profesional_habitual = :prof';
                                    $params['prof'] = $profInferred;
                                }
                                if (!empty($updates)) {
                                    $pdo->prepare('UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id')->execute($params);
                                }
                            } else {
                                $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($rawName) : $rawName;
                                $parts = preg_split('/\s+/u', $cleanNom, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                                $nom = $parts[0] ?? $cleanNom;
                                $ape = $parts[1] ?? '';
                                $pila = function_exists('extract_first_name') ? extract_first_name($cleanNom) : $nom;

                                $stmtPac = $pdo->prepare(
                                    'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, profesional_habitual, origen)
                                     VALUES (:tel, :nombre, :apellido, :full, :pila, :prof, "admin")
                                     ON DUPLICATE KEY UPDATE
                                        nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                                        apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                                        nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                                        nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END,
                                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" AND VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END'
                                );
                                $stmtPac->execute([
                                    'tel' => $rawPhone,
                                    'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
                                    'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
                                    'full' => mb_substr($cleanNom, 0, 120, 'UTF-8'),
                                    'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
                                    'prof' => $profInferred,
                                ]);
                            }
                            $directory['by_phone'][$phoneEndCheck] = $email;
                        } catch (Throwable $syncEx) {}
                    }
                }
            }
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
