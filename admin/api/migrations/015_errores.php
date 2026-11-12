<?php
declare(strict_types=1);

/**
 * Migración 015 — tabla errores (dual-write con JSON vía errores_io.php).
 * Runtime: lib_relational_errores.php · errores_io.php
 */

return [
    'id' => '015_errores',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'errores')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE errores (
                    id TEXT NOT NULL PRIMARY KEY,
                    seccion TEXT NOT NULL DEFAULT \'\',
                    info TEXT NOT NULL DEFAULT \'\',
                    comportamiento_actual TEXT NOT NULL DEFAULT \'\',
                    comportamiento_esperado TEXT NOT NULL DEFAULT \'\',
                    foto TEXT NOT NULL DEFAULT \'\',
                    video TEXT NOT NULL DEFAULT \'\',
                    estado TEXT NOT NULL DEFAULT \'pendiente\',
                    created_at TEXT NOT NULL,
                    created_by TEXT NOT NULL DEFAULT \'\',
                    resolved_at TEXT NULL,
                    resolved_by TEXT NULL,
                    updated_at TEXT NULL
                )'
            );
            $pdo->exec('CREATE INDEX idx_errores_estado ON errores (estado)');
            $pdo->exec('CREATE INDEX idx_errores_created_at ON errores (created_at)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE errores (
                id VARCHAR(40) NOT NULL PRIMARY KEY,
                seccion VARCHAR(120) NOT NULL DEFAULT \'\',
                info VARCHAR(255) NOT NULL DEFAULT \'\',
                comportamiento_actual TEXT NOT NULL,
                comportamiento_esperado TEXT NOT NULL,
                foto VARCHAR(500) NOT NULL DEFAULT \'\',
                video VARCHAR(500) NOT NULL DEFAULT \'\',
                estado VARCHAR(20) NOT NULL DEFAULT \'pendiente\',
                created_at DATETIME NOT NULL,
                created_by VARCHAR(60) NOT NULL DEFAULT \'\',
                resolved_at DATETIME NULL,
                resolved_by VARCHAR(60) NULL,
                updated_at DATETIME NULL,
                KEY idx_errores_estado (estado),
                KEY idx_errores_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
