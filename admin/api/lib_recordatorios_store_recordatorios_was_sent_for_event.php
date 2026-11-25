<?php
declare(strict_types=1);


/**
 * True si este calendar_event_id ya tuvo un envío exitoso (WA o email).
 * Usado por catch-up same-day para garantizar 1 solo recordatorio por turno.
 * Opcionalmente acotado por appointment_date para no suprimir turnos reprogramados.
 *
 * @param string $calendarEventId
 * @param string|PDO|null $appointmentDateOrPdo Fecha YYYY-MM-DD o instancia PDO (retrocompatibilidad)
 * @param PDO|null $pdo
 */
function recordatorios_was_sent_for_event(string $calendarEventId, $appointmentDateOrPdo = null, ?PDO $pdo = null): bool
{
    $apptDate = null;
    if ($appointmentDateOrPdo instanceof PDO) {
        $pdo = $appointmentDateOrPdo;
    } elseif (is_string($appointmentDateOrPdo)) {
        $apptDate = trim($appointmentDateOrPdo);
    }
    $cal = trim($calendarEventId);
    if ($cal === '' || $cal === '_run' || str_starts_with($cal, 'test:')) {
        return false;
    }
    try {
        $pdo = recordatorios_pdo($pdo);
        recordatorios_ensure_schema($pdo);
        $baseCal = str_replace('@google.com', '', $cal);
        $withGoogle = $baseCal . '@google.com';
        if ($apptDate !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $apptDate)) {
            $stmt = $pdo->prepare(
                'SELECT 1 FROM recordatorio_eventos
                 WHERE (calendar_event_id = :cal OR calendar_event_id = :baseCal OR calendar_event_id = :withGoogle)
                   AND (appointment_date = :appt OR appointment_date IS NULL OR appointment_date = "")
                   AND status IN (\'sent\', \'sent_email\')
                 LIMIT 1'
            );
            $stmt->execute(['cal' => $cal, 'baseCal' => $baseCal, 'withGoogle' => $withGoogle, 'appt' => $apptDate]);
        } else {
            $stmt = $pdo->prepare(
                'SELECT 1 FROM recordatorio_eventos
                 WHERE (calendar_event_id = :cal OR calendar_event_id = :baseCal OR calendar_event_id = :withGoogle)
                   AND status IN (\'sent\', \'sent_email\')
                 LIMIT 1'
            );
            $stmt->execute(['cal' => $cal, 'baseCal' => $baseCal, 'withGoogle' => $withGoogle]);
        }
        return (bool) $stmt->fetchColumn();
    } catch (Throwable $e) {
        error_log('kinesica recordatorios was_sent_for_event: ' . $e->getMessage());
        // Fail closed: si no podemos consultar, tratar como ya enviado (evita duplicados).
        return true;
    }
}

/**
 * Consulta batch (una query) para que n8n Parse Patients filtre ya enviados.
 * Opcionalmente acotada por appointment_date para admitir turnos reagendados.
 *
 * @param list<mixed> $calendarEventIds
 * @param string|PDO|null $appointmentDateOrPdo Fecha YYYY-MM-DD o instancia PDO
 * @param PDO|null $pdo
 * @return array<string,bool> map calendar_event_id => already sent
 */
function recordatorios_check_sent_map(array $calendarEventIds, $appointmentDateOrPdo = null, ?PDO $pdo = null): array
{
    $apptDate = null;
    if ($appointmentDateOrPdo instanceof PDO) {
        $pdo = $appointmentDateOrPdo;
    } elseif (is_string($appointmentDateOrPdo)) {
        $apptDate = trim($appointmentDateOrPdo);
    }
    $out = [];
    $ids = [];
    foreach ($calendarEventIds as $raw) {
        if (count($ids) >= 100) {
            break;
        }
        $cal = trim((string) $raw);
        if ($cal === '' || $cal === '_run') {
            continue;
        }
        $cal = substr($cal, 0, 128);
        if (isset($out[$cal])) {
            continue;
        }
        $out[$cal] = false;
        $ids[] = $cal;
    }
    if ($ids === []) {
        return $out;
    }
    try {
        $pdo = recordatorios_pdo($pdo);
        recordatorios_ensure_schema($pdo);
        $baseToRaw = [];
        $queryIds = [];
        foreach ($ids as $cal) {
            $base = str_replace('@google.com', '', $cal);
            $baseToRaw[$cal][] = $cal;
            $baseToRaw[$base][] = $cal;
            $baseToRaw[$base . '@google.com'][] = $cal;
            $queryIds[] = $cal;
            $queryIds[] = $base;
            $queryIds[] = $base . '@google.com';
        }
        $queryIds = array_values(array_unique($queryIds));
        $placeholders = implode(',', array_fill(0, count($queryIds), '?'));
        if ($apptDate !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $apptDate)) {
            $sql = "SELECT DISTINCT calendar_event_id FROM recordatorio_eventos
                    WHERE calendar_event_id IN ($placeholders)
                      AND (appointment_date = ? OR appointment_date IS NULL OR appointment_date = '')
                      AND status IN ('sent', 'sent_email')";
            $params = array_merge($queryIds, [$apptDate]);
        } else {
            $sql = "SELECT DISTINCT calendar_event_id FROM recordatorio_eventos
                    WHERE calendar_event_id IN ($placeholders)
                      AND status IN ('sent', 'sent_email')";
            $params = $queryIds;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        while (($row = $stmt->fetchColumn()) !== false) {
            $matched = (string) $row;
            if (isset($baseToRaw[$matched])) {
                foreach ($baseToRaw[$matched] as $originalId) {
                    $out[$originalId] = true;
                }
            }
        }
    } catch (Throwable $e) {
        error_log('kinesica recordatorios check_sent_map: ' . $e->getMessage());
        // Fail closed: sin consulta fiable, tratar como ya enviado (evita reenvíos duplicados).
        foreach ($ids as $cal) {
            $out[$cal] = true;
        }
    }
    return $out;
}


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


require_once __DIR__ . '/lib_recordatorios_store_schema.php';


function recordatorios_clean_wa_id(string $raw): string
{
    if (!function_exists('clean_phone_number')) {
        $helpers = __DIR__ . '/pacientes_helpers.php';
        if (is_file($helpers)) {
            require_once $helpers;
        }
    }
    if (function_exists('clean_phone_number')) {
        $normalized = clean_phone_number($raw);
        if ($normalized !== '') {
            return $normalized;
        }
    }
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
