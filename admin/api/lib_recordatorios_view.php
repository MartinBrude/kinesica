<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/pacientes_helpers.php';

const RECORDATORIOS_DEFAULT_DAYS = 14;

function recordatorios_tz(): DateTimeZone
{
    try {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    } catch (Throwable $e) {
        return new DateTimeZone('UTC');
    }
}

function recordatorios_status_label(string $status): string
{
    return match ($status) {
        'pending' => 'A enviar',
        'sent' => 'Enviado (WhatsApp)',
        'sent_email' => 'Enviado (email)',
        'failed' => 'Fallido',
        'missing_phone' => 'Sin teléfono ni mail',
        'skipped' => 'Omitido',
        'run_skipped' => 'Ejecución omitida',
        default => $status,
    };
}

function recordatorios_skip_label(string $reason): string
{
    return match ($reason) {
        'clara_inactive' => 'Clara pausada',
        'cancelled' => 'Cancelado / anulado',
        'blocked' => 'Bloqueo / no disponible',
        'waitlist' => 'Lista de espera',
        'non_appointment' => 'No es un turno',
        'duplicate' => 'Duplicado en la ejecución',
        'not_tomorrow' => 'Fuera de mañana',
        'other' => 'Otro',
        '' => '',
        default => $reason,
    };
}

function recordatorios_is_blocked_event(array $r): bool
{
    $reason = strtolower(trim((string) ($r['skip_reason'] ?? '')));
    if ($reason === 'blocked') {
        return true;
    }
    $name = (string) ($r['patient_name'] ?? '');
    $summary = (string) ($r['event_summary'] ?? '');
    if (function_exists('is_tk3_or_blocked_name')) {
        if (is_tk3_or_blocked_name($name) || is_tk3_or_blocked_name($summary)) {
            return true;
        }
    }
    $nameLower = mb_strtolower(trim($name));
    $summaryLower = mb_strtolower(trim($summary));
    foreach (['no dar', 'bloqueado', 'bloqueo', 'tk3', 'tk 3'] as $kw) {
        if (str_contains($nameLower, $kw) || str_contains($summaryLower, $kw)) {
            return true;
        }
    }
    return false;
}

function recordatorios_extract_phone_candidate(string $text): string
{
    $t = trim($text);
    if ($t === '') {
        return '';
    }

    if (preg_match('/(?:(?:whatsapp|wa\.me|tel|cel|telefono|celular|movil)[:\s\/]*)+([+]?[-0-9\s()]{8,22})/iu', $t, $m)) {
        $digits = preg_replace('/\D+/', '', $m[1]);
        if (strlen($digits) >= 8 && strlen($digits) <= 15) {
            return clean_phone_number($m[1]);
        }
    }

    if (preg_match('/\+\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/', $t, $m)) {
        return clean_phone_number($m[0]);
    }

    if (preg_match('/(?:\+?54\s*9?\s*)?(?:\b0?11\b|\b15\b)?[-.\s]?\d{4}[-.\s]?\d{4}\b/', $t, $m)) {
        $cleaned = clean_phone_number($m[0]);
        if (strlen($cleaned) >= 8) {
            return $cleaned;
        }
    }

    if (preg_match('/\b\d{8,13}\b/', $t, $m)) {
        return clean_phone_number($m[0]);
    }

    return '';
}

/**
 * Formatea una fila de recordatorio_eventos para la SPA.
 *
 * @param array<string,mixed> $r
 * @return array<string,mixed>
 */
function recordatorios_format_item(array $r, ?string $email = null): array
{
    $status = (string) ($r['status'] ?? '');
    $runUtc = (string) ($r['run_at'] ?? '');
    $runDay = '';
    $runLocal = $runUtc;
    try {
        $dt = new DateTimeImmutable($runUtc . ' UTC');
        $local = $dt->setTimezone(recordatorios_tz());
        $runDay = $local->format('Y-m-d');
        $runLocal = $local->format('Y-m-d H:i');
    } catch (Throwable $e) {
        $runDay = substr($runUtc, 0, 10);
    }

    $resolvedEmail = $email;
    if ($resolvedEmail === null || $resolvedEmail === '') {
        $resolvedEmail = recordatorios_extract_contact_email((string) ($r['error_message'] ?? ''));
    }

    $waId = (string) ($r['wa_id'] ?? '');
    if ($waId === '') {
        $candidate = recordatorios_extract_phone_candidate((string) ($r['event_summary'] ?? ''));
        if ($candidate === '') {
            $candidate = recordatorios_extract_phone_candidate((string) ($r['patient_name'] ?? ''));
        }
        if ($candidate !== '') {
            $waId = $candidate;
        }
    }

    return [
        'id' => (string) ($r['id'] ?? ''),
        'event_key' => (string) ($r['event_key'] ?? ''),
        'exec_id' => (string) ($r['exec_id'] ?? ''),
        'run_at' => $runUtc,
        'run_at_local' => $runLocal,
        'run_day' => $runDay,
        'appointment_date' => isset($r['appointment_date']) && $r['appointment_date'] !== null ? (string) $r['appointment_date'] : '',
        'appointment_time' => (string) ($r['appointment_time'] ?? ''),
        'calendar_event_id' => (string) ($r['calendar_event_id'] ?? ''),
        'patient_name' => (string) ($r['patient_name'] ?? ''),
        'wa_id' => $waId,
        'email' => (string) ($resolvedEmail ?? ''),
        'status' => $status,
        'status_label' => recordatorios_status_label($status),
        'skip_reason' => (string) ($r['skip_reason'] ?? ''),
        'skip_reason_label' => recordatorios_skip_label((string) ($r['skip_reason'] ?? '')),
        'error_code' => (string) ($r['error_code'] ?? ''),
        'error_message' => (string) ($r['error_message'] ?? ''),
        'event_summary' => (string) ($r['event_summary'] ?? ''),
        'is_past' => recordatorios_is_appointment_past(isset($r['appointment_date']) ? (string) $r['appointment_date'] : null, (string) ($r['appointment_time'] ?? '')),
    ];
}

function recordatorios_is_appointment_past(?string $apptDate, ?string $apptTime): bool
{
    if (!$apptDate || trim($apptDate) === '') {
        return false;
    }
    $timeStr = '23:59:59';
    if ($apptTime && trim($apptTime) !== '') {
        if (preg_match('/(\d{1,2}):(\d{2})/', $apptTime, $m)) {
            $timeStr = sprintf('%02d:%02d:00', (int) $m[1], (int) $m[2]);
        }
    }
    try {
        $tz = recordatorios_tz();
        $apptDt = new DateTimeImmutable(trim($apptDate) . ' ' . $timeStr, $tz);
        $now = new DateTimeImmutable('now', $tz);
        return $apptDt < $now;
    } catch (Throwable) {
        return false;
    }
}

function recordatorios_extract_contact_email(string $errorMessage): string
{
    if (preg_match('/^contact_email:([^\s|]+)/i', trim($errorMessage), $m)) {
        return strtolower(trim($m[1]));
    }
    if (filter_var(trim($errorMessage), FILTER_VALIDATE_EMAIL)) {
        return strtolower(trim($errorMessage));
    }
    return '';
}

/**
 * Busca emails del directorio para enriquecer la vista (por teléfono o nombre).
 *
 * @param list<array<string,mixed>> $rows
 * @return array{by_phone: array<string,string>, by_name: array<string,string>}
 */
function recordatorios_lookup_directory_contacts(PDO $pdo, array $rows): array
{
    $out = ['by_phone' => [], 'by_name' => []];
    try {
        $phones = [];
        $names = [];
        foreach ($rows as $r) {
            $phoneEnd = substr(recordatorios_clean_wa_id((string) ($r['wa_id'] ?? '')), -10);
            if (strlen($phoneEnd) >= 8) {
                $phones[$phoneEnd] = true;
            }
            $name = trim((string) ($r['patient_name'] ?? ''));
            if ($name !== '' && mb_strlen($name) >= 3) {
                $names[mb_strtolower($name)] = $name;
            }
        }
        if (!$phones && !$names) {
            return $out;
        }

        if ($phones) {
            $ends = array_keys($phones);
            $placeholders = implode(',', array_fill(0, count($ends), '?'));
            $stmt = $pdo->prepare(
                "SELECT telefono, email, nombre_completo FROM pacientes
                 WHERE email IS NOT NULL AND email != ''
                   AND RIGHT(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '+', ''), 10) IN ($placeholders)
                 LIMIT 500"
            );
            $stmt->execute($ends);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $end = substr(preg_replace('/\D+/', '', (string) ($row['telefono'] ?? '')) ?? '', -10);
                $email = strtolower(trim((string) ($row['email'] ?? '')));
                if ($end !== '' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $out['by_phone'][$end] = $email;
                }
            }
        }

        if ($names) {
            $nameList = array_values($names);
            $conds = [];
            $params = [];
            foreach ($nameList as $i => $name) {
                $conds[] = 'LOWER(nombre_completo) = LOWER(?)';
                $params[] = $name;
            }
            $stmt = $pdo->prepare(
                'SELECT nombre_completo, telefono, email FROM pacientes
                 WHERE email IS NOT NULL AND email != "" AND (' . implode(' OR ', $conds) . ')
                 LIMIT 500'
            );
            $stmt->execute($params);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $key = mb_strtolower(trim((string) ($row['nombre_completo'] ?? '')));
                $email = strtolower(trim((string) ($row['email'] ?? '')));
                if ($key !== '' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $out['by_name'][$key] = $email;
                }
            }
        }
    } catch (Throwable $e) {
        // Directorio opcional: no bloquear la vista.
    }
    return $out;
}

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

    $stmt = $pdo->prepare(
        'SELECT id, event_key, exec_id, run_at, appointment_date, appointment_time, calendar_event_id,
                patient_name, wa_id, status, skip_reason, error_code, error_message, event_summary, received_at
         FROM recordatorio_eventos
         WHERE (run_at >= :since OR status = "pending")
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
        if ($phoneEnd !== '' && isset($directory['by_phone'][$phoneEnd])) {
            $email = $directory['by_phone'][$phoneEnd];
        } elseif ($nameKey !== '' && isset($directory['by_name'][$nameKey])) {
            $email = $directory['by_name'][$nameKey];
        }
        $item = recordatorios_format_item($r, $email !== '' ? $email : null);
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
                            $parts = preg_split('/\s+/u', $rawName, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                            $nom = $parts[0] ?? $rawName;
                            $ape = $parts[1] ?? '';
                            $pila = function_exists('extract_first_name') ? extract_first_name($rawName) : $nom;

                            $stmtPac = $pdo->prepare(
                                'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, origen)
                                 VALUES (:tel, :nombre, :apellido, :full, :pila, "admin")
                                 ON DUPLICATE KEY UPDATE
                                    nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                                    apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                                    nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                                    nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END'
                            );
                            $stmtPac->execute([
                                'tel' => $rawPhone,
                                'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
                                'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
                                'full' => mb_substr($rawName, 0, 120, 'UTF-8'),
                                'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
                            ]);
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
