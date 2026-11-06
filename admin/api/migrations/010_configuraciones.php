<?php
declare(strict_types=1);

/**
 * Migración 010 — configuraciones (key → JSON + version).
 * Solo claves operativas allowlisted (no secrets de config.php).
 * Runtime: lib_relational_config.php · kinesica_settings_storage.php
 * Docs: docs/etapa8-config-gastos.md
 */

return [
    'id' => '010_configuraciones',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'configuraciones')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE configuraciones (
                    config_key TEXT NOT NULL PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_by TEXT NOT NULL DEFAULT \'\'
                )'
            );
            return;
        }
        $pdo->exec(
            'CREATE TABLE configuraciones (
                config_key VARCHAR(64) NOT NULL PRIMARY KEY,
                value_json LONGTEXT NOT NULL,
                version INT UNSIGNED NOT NULL DEFAULT 1,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by VARCHAR(60) NOT NULL DEFAULT \'\'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
