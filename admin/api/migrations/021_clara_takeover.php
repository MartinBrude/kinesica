<?php
declare(strict_types=1);

/**
 * Migración 021 — pausa puntual de Clara por WhatsApp (human takeover).
 * TTL operativo: 30 minutos (aplicado en lib_clara_takeover.php).
 */

return [
    'id' => '021_clara_takeover',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'clara_takeover')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE clara_takeover (
                    wa_id TEXT NOT NULL PRIMARY KEY,
                    paused_at TEXT NOT NULL,
                    paused_until TEXT NOT NULL,
                    paused_by TEXT NOT NULL DEFAULT \'\',
                    updated_at TEXT NOT NULL
                )'
            );
            $pdo->exec('CREATE INDEX idx_clara_takeover_until ON clara_takeover (paused_until)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE clara_takeover (
                wa_id VARCHAR(32) NOT NULL PRIMARY KEY,
                paused_at DATETIME NOT NULL,
                paused_until DATETIME NOT NULL,
                paused_by VARCHAR(60) NOT NULL DEFAULT \'\',
                updated_at DATETIME NOT NULL,
                KEY idx_clara_takeover_until (paused_until)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
