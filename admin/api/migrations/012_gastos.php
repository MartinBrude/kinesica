<?php
declare(strict_types=1);

/**
 * Migración 012 — gastos (dual-write con JSON vía gastos_io.php).
 * Runtime: lib_relational_gastos.php · gastos_io.php
 * Docs: docs/etapa8-config-gastos.md
 */

return [
    'id' => '012_gastos',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'gastos')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE gastos (
                    id TEXT NOT NULL PRIMARY KEY,
                    concepto TEXT NOT NULL DEFAULT \'\',
                    detalle TEXT NOT NULL DEFAULT \'\',
                    fecha TEXT NOT NULL DEFAULT \'\',
                    moneda TEXT NOT NULL DEFAULT \'ARS\',
                    monto REAL NOT NULL DEFAULT 0,
                    monto_eur REAL NULL,
                    monto_usd REAL NULL,
                    monto_ars REAL NULL,
                    tc_eur_usd REAL NULL,
                    tc_eur_ars REAL NULL,
                    created_at TEXT NULL,
                    updated_at TEXT NULL,
                    created_by TEXT NOT NULL DEFAULT \'\',
                    updated_by TEXT NOT NULL DEFAULT \'\'
                )'
            );
            $pdo->exec('CREATE INDEX idx_gastos_fecha ON gastos (fecha)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE gastos (
                id VARCHAR(40) NOT NULL PRIMARY KEY,
                concepto VARCHAR(160) NOT NULL DEFAULT \'\',
                detalle TEXT NOT NULL,
                fecha DATE NOT NULL,
                moneda CHAR(3) NOT NULL DEFAULT \'ARS\',
                monto DECIMAL(14,2) NOT NULL DEFAULT 0,
                monto_eur DECIMAL(14,2) NULL,
                monto_usd DECIMAL(14,2) NULL,
                monto_ars DECIMAL(14,2) NULL,
                tc_eur_usd DECIMAL(12,4) NULL,
                tc_eur_ars DECIMAL(14,2) NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                created_by VARCHAR(60) NOT NULL DEFAULT \'\',
                updated_by VARCHAR(60) NOT NULL DEFAULT \'\',
                KEY idx_gastos_fecha (fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
