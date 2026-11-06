<?php
declare(strict_types=1);

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/calendar_event_parse.php';

/**
 * Almacén durable de outcomes de recordatorios WhatsApp 24h (ingest desde n8n).
 * Solo se AGREGA: claves únicas = idempotencia ante reintentos del workflow.
 */

const RECORDATORIOS_MAX_BATCH = 200;
const RECORDATORIOS_STATUSES = ['pending', 'sent', 'sent_email', 'failed', 'missing_phone', 'skipped', 'run_skipped'];
const RECORDATORIOS_SKIP_REASONS = [
    'clara_inactive', 'cancelled', 'blocked', 'waitlist', 'non_appointment',
    'duplicate', 'not_tomorrow', 'other',
];

function recordatorios_dir(): string
{
    $dir = defined('KINESICA_RECORDATORIOS_DIR') ? (string) KINESICA_RECORDATORIOS_DIR : (string) getenv('KINESICA_RECORDATORIOS_DIR');
    if ($dir === '') {
        $dir = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    }
    if ($dir === '') {
        $dir = __DIR__ . '/data';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function recordatorios_write_atomic(string $path, string $contents): bool
{
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $contents, LOCK_EX) !== strlen($contents)) {
        @unlink($tmp);
        return false;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

function recordatorios_pdo(?PDO $pdo = null): PDO
{
    return $pdo ?? db();
}

function recordatorios_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = recordatorios_pdo($pdo);
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    // REL: puente idempotente (no DROP). Activo como red de seguridad productiva.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS recordatorio_eventos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(160) NOT NULL,
            exec_id VARCHAR(64) NOT NULL DEFAULT \'\',
            run_at DATETIME NOT NULL,
            appointment_date DATE NULL,
            appointment_time VARCHAR(16) NOT NULL DEFAULT \'\',
            calendar_event_id VARCHAR(128) NOT NULL DEFAULT \'\',
            patient_name VARCHAR(120) NOT NULL DEFAULT \'\',
            wa_id VARCHAR(32) NOT NULL DEFAULT \'\',
            status VARCHAR(24) NOT NULL,
            skip_reason VARCHAR(40) NOT NULL DEFAULT \'\',
            error_code VARCHAR(32) NOT NULL DEFAULT \'\',
            error_message VARCHAR(500) NOT NULL DEFAULT \'\',
            event_summary VARCHAR(255) NOT NULL DEFAULT \'\',
            received_at DATETIME NOT NULL,
            UNIQUE KEY uq_event_key (event_key),
            KEY idx_run_at (run_at),
            KEY idx_status (status),
            KEY idx_appt_date (appointment_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    // REL: puente paciente_id/turno_id (mig 002). Retirar tras etapa 10.
    try {
        require_once __DIR__ . '/lib_migrations.php';
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'recordatorio_eventos',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'recordatorio_eventos',
            'turno_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
    } catch (Throwable $e) {
    }
    $done[$pdo] = true;
}

function recordatorios_clean_wa_id(string $raw): string
{
    return preg_replace('/\D/', '', $raw) ?? '';
}

function recordatorios_parse_run_at($value, int $fallback): int
{
    if (is_int($value) || (is_string($value) && preg_match('/^\d{9,13}(\.\d+)?$/', $value))) {
        $n = (float) $value;
        return (int) ($n > 99999999999 ? $n / 1000 : $n);
    }
    if (is_string($value) && trim($value) !== '') {
        try {
            return (new DateTimeImmutable(trim($value)))->getTimestamp();
        } catch (Throwable $e) {
        }
    }
    return $fallback;
}

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
function recordatorios_store_items(array $items, ?PDO $pdo = null): array
{
    $res = ['stored' => 0, 'duplicates' => 0, 'failed' => 0];
    try {
        $pdo = recordatorios_pdo($pdo);
        recordatorios_ensure_schema($pdo);
        foreach ($items as $ev) {
            $cal = (string) ($ev['calendar_event_id'] ?? '');
            // Si admin ya cargó WhatsApp en un pending, no pisarlo con un missing_phone vacío de n8n.
            if (
                $cal !== '' &&
                $cal !== '_run' &&
                ($ev['wa_id'] ?? '') === '' &&
                in_array((string) ($ev['status'] ?? ''), ['missing_phone', 'failed', 'skipped', 'pending'], true)
            ) {
                try {
                    $keptStmt = $pdo->prepare(
                        'SELECT wa_id FROM recordatorio_eventos
                         WHERE calendar_event_id = :cal AND wa_id IS NOT NULL AND wa_id != ""
                         ORDER BY id DESC LIMIT 1'
                    );
                    $keptStmt->execute(['cal' => $cal]);
                    $keptWa = $keptStmt->fetchColumn();
                    if (is_string($keptWa) && $keptWa !== '') {
                        if (($ev['status'] ?? '') === 'missing_phone') {
                            // Contacto manual ya resuelve el caso: no insertar otro missing_phone vacío.
                            $res['duplicates']++;
                            continue;
                        }
                        $ev['wa_id'] = substr($keptWa, 0, 32);
                    }
                } catch (Throwable $keepEx) {
                }
            }
            if ($ev['status'] !== 'pending' && $cal !== '' && $cal !== '_run') {
                try {
                    // Preservar pending con WhatsApp cargado a mano; solo limpiar pending vacíos.
                    $pdo->prepare(
                        'DELETE FROM recordatorio_eventos
                         WHERE calendar_event_id = :cal AND status = "pending"
                           AND (wa_id IS NULL OR wa_id = "")'
                    )->execute(['cal' => $cal]);
                } catch (Throwable $delEx) {
                }
            }
            $outcome = recordatorios_insert_item($pdo, $ev);
            $res[$outcome === 'stored' ? 'stored' : 'duplicates']++;

            // Auto-sincronización con el directorio de pacientes (teléfono/DNI + nombre).
            $rawName = trim((string) ($ev['patient_name'] ?? ''));
            $rawPhone = clean_phone_number((string) ($ev['wa_id'] ?? ''));
            $rawDni = clean_patient_dni((string) ($ev['dni'] ?? ''));
            if ($rawDni === '' || $rawPhone === '') {
                $parsedContact = kinesica_extract_calendar_contacts(
                    trim($rawName . ' ' . (string) ($ev['event_summary'] ?? '')),
                    (string) ($ev['event_description'] ?? '')
                );
                if ($rawPhone === '' && $parsedContact['phone'] !== '') {
                    $rawPhone = $parsedContact['phone'];
                }
                if ($rawDni === '' && $parsedContact['dni'] !== '') {
                    $rawDni = $parsedContact['dni'];
                }
            }
            $hasIdentity = ($rawPhone !== '' && strlen($rawPhone) >= 6 && strlen($rawPhone) <= 16) || $rawDni !== '';
            if ($hasIdentity && $rawName !== '' && $rawName !== 'Estimado/a paciente' && $rawName !== 'Paciente') {
                if (!function_exists('is_tk3_or_blocked_name') || !is_tk3_or_blocked_name($rawName)) {
                    try {
                        ensure_pacientes_tables($pdo);
                        $existing = function_exists('find_existing_patient_match')
                            ? find_existing_patient_match(
                                $pdo,
                                $rawPhone !== '' ? $rawPhone : null,
                                $rawName,
                                $rawDni !== '' ? $rawDni : null
                            )
                            : null;

                        $profInferred = function_exists('infer_practitioner_from_schedule')
                            ? infer_practitioner_from_schedule(
                                (string) ($ev['appointment_date'] ?? ''),
                                (string) ($ev['appointment_time'] ?? ''),
                                (string) (($ev['event_summary'] ?? '') . ' ' . ($ev['creator'] ?? ''))
                            )
                            : 'indistinto';

                        if ($existing) {
                            $existingId = (int) $existing['id'];
                            $updates = [];
                            $params = ['id' => $existingId];
                            if (
                                $rawPhone !== ''
                                && function_exists('is_placeholder_phone')
                                && is_placeholder_phone((string) ($existing['telefono'] ?? ''))
                            ) {
                                $updates[] = 'telefono = :tel';
                                $params['tel'] = $rawPhone;
                            }
                            if ($rawDni !== '' && clean_patient_dni((string) ($existing['dni'] ?? '')) === '') {
                                $updates[] = 'dni = :dni';
                                $params['dni'] = mb_substr($rawDni, 0, 20, 'UTF-8');
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
                            $tel = $rawPhone !== '' ? $rawPhone : ('sin-tel-dni-' . substr($rawDni, 0, 18));

                            $stmtPac = $pdo->prepare(
                                'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, origen)
                                 VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, "admin")
                                 ON DUPLICATE KEY UPDATE
                                    nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                                    apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                                    nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                                    nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END,
                                    dni = COALESCE(dni, VALUES(dni)),
                                    profesional_habitual = CASE WHEN profesional_habitual = "indistinto" AND VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END'
                            );
                            $stmtPac->execute([
                                'tel' => $tel,
                                'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
                                'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
                                'full' => mb_substr($cleanNom, 0, 120, 'UTF-8'),
                                'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
                                'dni' => $rawDni !== '' ? mb_substr($rawDni, 0, 20, 'UTF-8') : null,
                                'prof' => $profInferred,
                            ]);
                        }
                    } catch (Throwable $pacEx) {
                    }
                }
            }
        }
    } catch (Throwable $e) {
        error_log('recordatorios store: ' . $e->getMessage());
        $res['failed'] = count($items) - $res['stored'] - $res['duplicates'];
    }
    return $res;
}

function recordatorios_find_item_by_id(int $id, ?PDO $pdo = null): ?array
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT * FROM recordatorio_eventos WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

function recordatorios_update_outcome(int $id, array $updates, ?PDO $pdo = null): bool
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $existing = recordatorios_find_item_by_id($id, $pdo);
    if (!$existing) {
        return false;
    }
    $allowed = ['status', 'wa_id', 'error_code', 'error_message', 'run_at', 'received_at', 'event_key'];
    $set = [];
    $params = ['id' => $id];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $updates)) {
            $set[] = "$f = :$f";
            $params[$f] = $updates[$f];
        }
    }
    if (!$set) {
        return false;
    }
    $sql = 'UPDATE recordatorio_eventos SET ' . implode(', ', $set) . ' WHERE id = :id';
    return $pdo->prepare($sql)->execute($params);
}
