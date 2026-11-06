<?php
declare(strict_types=1);

/**
 * Tabla de contactos multi-valor por paciente (teléfonos/emails).
 * Sin UNIQUE global de valor: teléfonos compartidos permitidos tras revisión.
 */

return [
    'id' => '001_paciente_contactos',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'paciente_contactos')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE paciente_contactos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    paciente_id INTEGER NOT NULL,
                    tipo TEXT NOT NULL,
                    valor TEXT NOT NULL,
                    valor_normalizado TEXT NOT NULL,
                    es_principal INTEGER NOT NULL DEFAULT 0,
                    verificado_at TEXT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )'
            );
            $pdo->exec(
                'CREATE INDEX idx_paciente_contactos_paciente ON paciente_contactos (paciente_id)'
            );
            $pdo->exec(
                'CREATE INDEX idx_paciente_contactos_norm ON paciente_contactos (tipo, valor_normalizado)'
            );
            $pdo->exec(
                'CREATE UNIQUE INDEX uq_paciente_contactos_principal
                 ON paciente_contactos (paciente_id, tipo) WHERE es_principal = 1'
            );
            return;
        }
        $pdo->exec(
            'CREATE TABLE paciente_contactos (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                paciente_id INT UNSIGNED NOT NULL,
                tipo ENUM(\'telefono\', \'email\') NOT NULL,
                valor VARCHAR(160) NOT NULL,
                valor_normalizado VARCHAR(160) NOT NULL,
                es_principal TINYINT(1) NOT NULL DEFAULT 0,
                verificado_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_paciente_contactos_paciente (paciente_id),
                KEY idx_paciente_contactos_norm (tipo, valor_normalizado),
                KEY idx_paciente_contactos_principal (paciente_id, tipo, es_principal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        // Unicidad de principal: índice generado / partial no portable en MariaDB antigua.
        // Se refuerza en aplicación; etapa 9 puede añadir trigger o generated unique.
    },
];
