<?php
declare(strict_types=1);

/**
 * Migración 002 — columnas de relación nullable (etapa 3).
 * paciente_id / profesional_id / turno_id + índices.
 * Sin FK obligatorias (REL_ENFORCE_FK / etapa 9).
 */

return [
    'id' => '002_rel_nullable_ids',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'fichas',
            'paciente_id',
            'INT UNSIGNED NULL AFTER id',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'fichas',
            'profesional_id',
            'INT UNSIGNED NULL AFTER paciente_id',
            'INTEGER NULL'
        );
        kinesica_migrations_ensure_index($pdo, 'fichas', 'idx_fichas_paciente_id', 'paciente_id');
        kinesica_migrations_ensure_index($pdo, 'fichas', 'idx_fichas_profesional_id', 'profesional_id');

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'paciente_id',
            'INT UNSIGNED NULL AFTER id',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'profesional_id',
            'INT UNSIGNED NULL AFTER paciente_id',
            'INTEGER NULL'
        );
        kinesica_migrations_ensure_index($pdo, 'lista_espera', 'idx_lista_espera_paciente_id', 'paciente_id');

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_eventos',
            'paciente_id',
            'INT UNSIGNED NULL AFTER wa_id',
            'INTEGER NULL'
        );
        kinesica_migrations_ensure_index(
            $pdo,
            'interaccion_eventos',
            'idx_interaccion_eventos_paciente_id',
            'paciente_id'
        );

        kinesica_migrations_add_column_if_missing(
            $pdo,
            'recordatorio_eventos',
            'paciente_id',
            'INT UNSIGNED NULL AFTER wa_id',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'recordatorio_eventos',
            'turno_id',
            'INT UNSIGNED NULL AFTER paciente_id',
            'INTEGER NULL'
        );
        kinesica_migrations_ensure_index(
            $pdo,
            'recordatorio_eventos',
            'idx_recordatorio_eventos_paciente_id',
            'paciente_id'
        );
    },
];
