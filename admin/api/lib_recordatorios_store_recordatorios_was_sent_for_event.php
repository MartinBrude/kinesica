<?php
declare(strict_types=1);


/**
 * True si este calendar_event_id ya tuvo un envío exitoso (WA o email).
 * Usado por catch-up same-day para garantizar 1 solo recordatorio por turno.
 */
function recordatorios_was_sent_for_event(string $calendarEventId, ?PDO $pdo = null): bool
{
    $cal = trim($calendarEventId);
    if ($cal === '' || $cal === '_run' || str_starts_with($cal, 'test:')) {
        return false;
    }
    try {
        $pdo = recordatorios_pdo($pdo);
        recordatorios_ensure_schema($pdo);
        $stmt = $pdo->prepare(
            'SELECT 1 FROM recordatorio_eventos
             WHERE calendar_event_id = :cal
               AND status IN (\'sent\', \'sent_email\')
             LIMIT 1'
        );
        $stmt->execute(['cal' => substr($cal, 0, 128)]);
        return (bool) $stmt->fetchColumn();
    } catch (Throwable) {
        return false;
    }
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
