<?php
declare(strict_types=1);

/**
 * Migración 006 — turnos (espejo local / sombra de Google Calendar).
 * UNIQUE(calendar_event_id). Sin FK obligatorias. Ver lib_relational_turnos.php
 */

return [
    'id' => '006_turnos',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'turnos')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE turnos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    paciente_id INTEGER NULL,
                    profesional_id INTEGER NULL,
                    calendar_event_id TEXT NOT NULL UNIQUE,
                    starts_at TEXT NULL,
                    ends_at TEXT NULL,
                    status TEXT NOT NULL DEFAULT \'scheduled\',
                    summary TEXT NOT NULL DEFAULT \'\',
                    patient_name_snapshot TEXT NOT NULL DEFAULT \'\',
                    source TEXT NOT NULL DEFAULT \'manual\',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )'
            );
            $pdo->exec('CREATE INDEX idx_turnos_paciente_id ON turnos (paciente_id)');
            $pdo->exec('CREATE INDEX idx_turnos_starts_at ON turnos (starts_at)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE turnos (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                paciente_id INT UNSIGNED NULL,
                profesional_id INT UNSIGNED NULL,
                calendar_event_id VARCHAR(128) NOT NULL,
                starts_at DATETIME NULL,
                ends_at DATETIME NULL,
                status VARCHAR(24) NOT NULL DEFAULT \'scheduled\',
                summary VARCHAR(255) NOT NULL DEFAULT \'\',
                patient_name_snapshot VARCHAR(120) NOT NULL DEFAULT \'\',
                source VARCHAR(24) NOT NULL DEFAULT \'manual\',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_turnos_calendar_event_id (calendar_event_id),
                KEY idx_turnos_paciente_id (paciente_id),
                KEY idx_turnos_starts_at (starts_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
