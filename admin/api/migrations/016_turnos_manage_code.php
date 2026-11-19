<?php
declare(strict_types=1);

/**
 * Migración 016 — código de gestión web (apellido + email + código).
 * Columnas en turnos: manage_code_hash para lookup.
 * manage_code (plaintext) quedó deprecado; 017 lo limpia y los writes nuevos lo dejan NULL.
 */

return [
    'id' => '016_turnos_manage_code',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'turnos')) {
            return;
        }
        $sqlite = kinesica_migrations_is_sqlite($pdo);
        $cols = [
            'manage_email' => $sqlite
                ? 'ALTER TABLE turnos ADD COLUMN manage_email TEXT NULL'
                : 'ALTER TABLE turnos ADD COLUMN manage_email VARCHAR(120) NULL',
            'manage_apellido_norm' => $sqlite
                ? 'ALTER TABLE turnos ADD COLUMN manage_apellido_norm TEXT NULL'
                : 'ALTER TABLE turnos ADD COLUMN manage_apellido_norm VARCHAR(80) NULL',
            'manage_code_hash' => $sqlite
                ? 'ALTER TABLE turnos ADD COLUMN manage_code_hash TEXT NULL'
                : 'ALTER TABLE turnos ADD COLUMN manage_code_hash VARCHAR(64) NULL',
            // Plaintext del código (7 chars) para re-mostrar el mismo valor en mail/UI sin regenerar.
            'manage_code' => $sqlite
                ? 'ALTER TABLE turnos ADD COLUMN manage_code TEXT NULL'
                : 'ALTER TABLE turnos ADD COLUMN manage_code VARCHAR(12) NULL',
            'manage_code_created_at' => $sqlite
                ? 'ALTER TABLE turnos ADD COLUMN manage_code_created_at TEXT NULL'
                : 'ALTER TABLE turnos ADD COLUMN manage_code_created_at DATETIME NULL',
        ];
        foreach ($cols as $name => $sql) {
            if (!kinesica_migrations_column_exists($pdo, 'turnos', $name)) {
                $pdo->exec($sql);
            }
        }
        if (!$sqlite) {
            try {
                $pdo->exec('CREATE INDEX idx_turnos_manage_email ON turnos (manage_email)');
            } catch (Throwable) {
                // índice ya existe
            }
        } else {
            try {
                $pdo->exec('CREATE INDEX IF NOT EXISTS idx_turnos_manage_email ON turnos (manage_email)');
            } catch (Throwable) {
            }
        }
    },
];
