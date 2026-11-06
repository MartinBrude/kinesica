<?php
declare(strict_types=1);

/**
 * Optimistic locking en fichas clínicas (etapa 5).
 */

return [
    'id' => '004_fichas_version',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'fichas',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1 AFTER updated_by',
            'INTEGER NOT NULL DEFAULT 1'
        );
    },
];
