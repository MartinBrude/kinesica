<?php
declare(strict_types=1);

/**
 * Migración 011 — auditoria_cambios (historial de config/gastos/etc.).
 * Append-only. Sin PII de secrets.
 * Runtime: kinesica_rel_auditoria_append() en lib_relational_config.php
 * Docs: docs/etapa8-config-gastos.md
 */

return [
    'id' => '011_auditoria_cambios',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'auditoria_cambios')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE auditoria_cambios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity TEXT NOT NULL,
                    entity_id TEXT NOT NULL DEFAULT \'\',
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT \'\',
                    before_json TEXT NULL,
                    after_json TEXT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )'
            );
            $pdo->exec('CREATE INDEX idx_auditoria_entity ON auditoria_cambios (entity, entity_id)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE auditoria_cambios (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                entity VARCHAR(64) NOT NULL,
                entity_id VARCHAR(80) NOT NULL DEFAULT \'\',
                action VARCHAR(32) NOT NULL,
                actor VARCHAR(60) NOT NULL DEFAULT \'\',
                before_json LONGTEXT NULL,
                after_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_auditoria_entity (entity, entity_id),
                KEY idx_auditoria_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
