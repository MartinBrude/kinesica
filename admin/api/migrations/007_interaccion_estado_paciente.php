<?php
declare(strict_types=1);

/**
 * Migración 007 — paciente_id (+ wa_id) en interaccion_estado.
 * Modelo conceptual: estado ≈ conversación, eventos ≈ mensajes.
 * Sin rename/split de tablas (Clara/n8n intactos).
 */

return [
    'id' => '007_interaccion_estado_paciente',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'interaccion_estado')) {
            return;
        }
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'wa_id',
            'VARCHAR(32) NULL',
            'TEXT NULL'
        );
        kinesica_migrations_ensure_index(
            $pdo,
            'interaccion_estado',
            'idx_interaccion_estado_paciente_id',
            'paciente_id'
        );
    },
];
