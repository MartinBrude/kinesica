<?php
declare(strict_types=1);

/**
 * Relaciones opcionales (etapa 3): columnas nullable paciente_id / profesional_id.
 * Sin FOREIGN KEY obligatorias todavía (REL_ENFORCE_FK).
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
