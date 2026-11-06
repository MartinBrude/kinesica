<?php
declare(strict_types=1);

/**
 * Migración 003 — pacientes.deleted_at + pacientes.version
 * Soft-delete y locking (uso pleno en etapas posteriores).
 */

return [
    'id' => '003_pacientes_version_deleted',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'deleted_at',
            'DATETIME NULL DEFAULT NULL AFTER updated_at',
            'TEXT NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1 AFTER deleted_at',
            'INTEGER NOT NULL DEFAULT 1'
        );
        kinesica_migrations_ensure_index($pdo, 'pacientes', 'idx_pacientes_deleted_at', 'deleted_at');
    },
];
