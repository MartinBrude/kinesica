<?php
declare(strict_types=1);

/**
 * Reasigna tablas hijas de un paciente origen al destino (pre-DELETE / merge).
 * Idempotente: si la tabla/columna no existe en el esquema activo, se omite.
 */
function kinesica_pacientes_child_tables(): array
{
    return [
        'fichas' => 'paciente_id',
        'turnos' => 'paciente_id',
        'lista_espera' => 'paciente_id',
        'paciente_contactos' => 'paciente_id',
        'interaccion_eventos' => 'paciente_id',
        'interaccion_estado' => 'paciente_id',
        'recordatorio_eventos' => 'paciente_id',
        'encuestas' => 'paciente_id',
    ];
}

/**
 * Mueve vínculos clínicos/operativos de $sourceId a $targetId.
 * Debe llamarse dentro de una transacción abierta por el caller.
 */
function kinesica_pacientes_reassign_children(PDO $pdo, int $sourceId, int $targetId): void
{
    if ($sourceId <= 0 || $targetId <= 0 || $sourceId === $targetId) {
        return;
    }

    require_once __DIR__ . '/lib_migrations.php';

    // Evitar colisión UNIQUE (paciente_id, tipo) WHERE es_principal = 1.
    try {
        if (kinesica_migrations_table_exists($pdo, 'paciente_contactos')
            && kinesica_migrations_column_exists($pdo, 'paciente_contactos', 'es_principal')
        ) {
            $pdo->prepare(
                'UPDATE paciente_contactos SET es_principal = 0 WHERE paciente_id = :source'
            )->execute(['source' => $sourceId]);
        }
    } catch (Throwable) {
        // Esquema parcial / tests mínimos: seguir con reasignación.
    }

    foreach (kinesica_pacientes_child_tables() as $table => $col) {
        try {
            if (!kinesica_migrations_table_exists($pdo, $table)
                || !kinesica_migrations_column_exists($pdo, $table, $col)
            ) {
                continue;
            }
            $pdo->prepare(
                "UPDATE {$table} SET {$col} = :target WHERE {$col} = :source"
            )->execute([
                'target' => $targetId,
                'source' => $sourceId,
            ]);
        } catch (Throwable) {
            // Tabla ausente o constraint puntual: no abortar el merge completo aquí.
        }
    }
}
