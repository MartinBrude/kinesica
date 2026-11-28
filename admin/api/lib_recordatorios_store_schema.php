<?php
declare(strict_types=1);

/**
 * Creación/verificación idempotente del esquema `recordatorio_eventos`.
 */
function recordatorios_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = recordatorios_pdo($pdo);
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $marker = __DIR__ . '/data/.recordatorios_schema_migrated';
    if ($driver !== 'sqlite' && PHP_SAPI !== 'cli' && is_file($marker)) {
        $done[$pdo] = true;
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
            KEY idx_appt_date (appointment_date),
            KEY idx_cal_event (calendar_event_id),
            KEY idx_cal_appt (calendar_event_id, appointment_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $hasIdx = (bool) $pdo->query("SHOW INDEX FROM recordatorio_eventos WHERE Key_name = 'idx_cal_event'")->fetch();
            if (!$hasIdx) {
                $pdo->exec("ALTER TABLE recordatorio_eventos ADD INDEX idx_cal_event (calendar_event_id), ADD INDEX idx_cal_appt (calendar_event_id, appointment_date)");
            }
        } elseif ($driver === 'sqlite') {
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rec_cal_event ON recordatorio_eventos (calendar_event_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rec_cal_appt ON recordatorio_eventos (calendar_event_id, appointment_date)");
        }
    } catch (Throwable) {
    }
    try {
        require_once __DIR__ . '/lib_migrations.php';
        kinesica_migrations_add_column_if_missing($pdo, 'recordatorio_eventos', 'paciente_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing($pdo, 'recordatorio_eventos', 'turno_id', 'INT UNSIGNED NULL', 'INTEGER NULL');

        // Autoconsolidación de IDs de Google Calendar (Migración 018)
        if (!kinesica_migrations_is_applied($pdo, '018_consolidate_canonical_calendar_ids')) {
            $migFile = __DIR__ . '/migrations/018_consolidate_canonical_calendar_ids.php';
            if (is_file($migFile)) {
                $mig = require $migFile;
                ($mig['up'])($pdo);
                kinesica_migrations_ensure_control_table($pdo);
                $ins = $pdo->prepare(
                    'INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (:id, :checksum, :at)'
                );
                $rawCode = file_get_contents($migFile);
                $cs = hash('sha256', $rawCode !== false ? $rawCode : '018');
                $ins->execute([
                    'id' => '018_consolidate_canonical_calendar_ids',
                    'checksum' => $cs,
                    'at' => gmdate('Y-m-d H:i:s'),
                ]);
            }
        }
    } catch (Throwable $e) {
    }
    if ($driver !== 'sqlite' && PHP_SAPI !== 'cli') {
        if (!is_dir(dirname($marker))) {
            @mkdir(dirname($marker), 0775, true);
        }
        @file_put_contents($marker, (string) time());
    }
    $done[$pdo] = true;
}
