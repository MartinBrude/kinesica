<?php
declare(strict_types=1);


/**
 * @return list<array{table:string,column:string,parent:string,parent_column:string}>
 */
function kinesica_rel_integrity_fk_specs(): array
{
    return [
        ['table' => 'paciente_contactos', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'fichas', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'fichas', 'column' => 'profesional_id', 'parent' => 'profesionales', 'parent_column' => 'id'],
        ['table' => 'lista_espera', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'lista_espera', 'column' => 'profesional_id', 'parent' => 'profesionales', 'parent_column' => 'id'],
        ['table' => 'turnos', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'turnos', 'column' => 'profesional_id', 'parent' => 'profesionales', 'parent_column' => 'id'],
        ['table' => 'interaccion_eventos', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'interaccion_estado', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'recordatorio_eventos', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
        ['table' => 'recordatorio_eventos', 'column' => 'turno_id', 'parent' => 'turnos', 'parent_column' => 'id'],
        ['table' => 'encuestas', 'column' => 'paciente_id', 'parent' => 'pacientes', 'parent_column' => 'id'],
    ];
}

/**
 * Null out IDs que no existen en el padre (permite ADD FK).
 *
 * @return array{table:string,column:string,nulled:int}[]
 */

/**
 * Null out IDs que no existen en el padre (permite ADD FK).
 *
 * @return array{table:string,column:string,nulled:int}[]
 */
function kinesica_rel_integrity_null_orphans(PDO $pdo, bool $apply = true): array
{
    $report = [];
    foreach (kinesica_rel_integrity_fk_specs() as $spec) {
        $table = $spec['table'];
        $col = $spec['column'];
        $parent = $spec['parent'];
        $pcol = $spec['parent_column'];
        if (!kinesica_migrations_table_exists($pdo, $table)
            || !kinesica_migrations_column_exists($pdo, $table, $col)
            || !kinesica_migrations_table_exists($pdo, $parent)
        ) {
            continue;
        }
        $sqlCount = "SELECT COUNT(*) FROM {$table} c
            WHERE c.{$col} IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM {$parent} p WHERE p.{$pcol} = c.{$col})";
        $count = (int) $pdo->query($sqlCount)->fetchColumn();
        $entry = ['table' => $table, 'column' => $col, 'nulled' => $count];
        if ($apply && $count > 0) {
            $pdo->exec(
                "UPDATE {$table} SET {$col} = NULL
                 WHERE {$col} IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM {$parent} p WHERE p.{$pcol} = {$table}.{$col})"
            );
        }
        $report[] = $entry;
    }
    return $report;
}

/**
 * ¿Hay filas hijas que bloquearían hard-delete del paciente?
 */

/**
 * ¿Hay filas hijas que bloquearían hard-delete del paciente?
 */
function kinesica_rel_paciente_has_clinical_children(PDO $pdo, int $pacienteId): bool
{
    if ($pacienteId <= 0) {
        return false;
    }
    $checks = [
        'fichas' => 'paciente_id',
        'lista_espera' => 'paciente_id',
        'turnos' => 'paciente_id',
        'paciente_contactos' => 'paciente_id',
        'interaccion_eventos' => 'paciente_id',
        'interaccion_estado' => 'paciente_id',
        'recordatorio_eventos' => 'paciente_id',
        'encuestas' => 'paciente_id',
    ];
    foreach ($checks as $table => $col) {
        if (!kinesica_migrations_table_exists($pdo, $table)
            || !kinesica_migrations_column_exists($pdo, $table, $col)
        ) {
            continue;
        }
        $stmt = $pdo->prepare("SELECT 1 FROM {$table} WHERE {$col} = :id LIMIT 1");
        $stmt->execute(['id' => $pacienteId]);
        if ($stmt->fetchColumn()) {
            return true;
        }
    }
    return false;
}

/**
 * Soft-delete profesional (deleted_at). RESTRICT en hijos vía FK; no hard-delete.
 *
 * @return array{ok:bool,code:?string,message:string}
 */

/**
 * Soft-delete profesional (deleted_at). RESTRICT en hijos vía FK; no hard-delete.
 *
 * @return array{ok:bool,code:?string,message:string}
 */
function kinesica_rel_profesional_soft_delete(PDO $pdo, int $profesionalId): array
{
    if ($profesionalId <= 0) {
        return ['ok' => false, 'code' => 'invalid_id', 'message' => 'ID inválido'];
    }
    if (!kinesica_migrations_table_exists($pdo, 'profesionales')
        || !kinesica_migrations_column_exists($pdo, 'profesionales', 'deleted_at')
    ) {
        return ['ok' => false, 'code' => 'schema_missing', 'message' => 'profesionales.deleted_at no disponible'];
    }
    $stmt = $pdo->prepare('SELECT id, deleted_at FROM profesionales WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $profesionalId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return ['ok' => false, 'code' => 'not_found', 'message' => 'Profesional no encontrado'];
    }
    if ($row['deleted_at'] !== null && $row['deleted_at'] !== '') {
        return ['ok' => true, 'code' => null, 'message' => 'Profesional ya estaba desactivado'];
    }
    $upd = $pdo->prepare(
        'UPDATE profesionales SET deleted_at = CURRENT_TIMESTAMP, active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id AND deleted_at IS NULL'
    );
    $upd->execute(['id' => $profesionalId]);
    return ['ok' => true, 'code' => null, 'message' => 'Profesional desactivado (borrado lógico)'];
}

/**
 * Soft-delete paciente (deleted_at). No hard-delete si hay hijos clínicos.
 *
 * @return array{ok:bool,code:?string,message:string}
 */

/**
 * Soft-delete paciente (deleted_at). No hard-delete si hay hijos clínicos.
 *
 * @return array{ok:bool,code:?string,message:string}
 */
function kinesica_rel_paciente_soft_delete(PDO $pdo, int $pacienteId): array
{
    if ($pacienteId <= 0) {
        return ['ok' => false, 'code' => 'invalid_id', 'message' => 'ID inválido'];
    }
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return ['ok' => false, 'code' => 'schema_missing', 'message' => 'Columna deleted_at no disponible'];
    }

    $stmt = $pdo->prepare('SELECT id, deleted_at FROM pacientes WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $pacienteId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return ['ok' => false, 'code' => 'not_found', 'message' => 'Paciente no encontrado'];
    }
    if ($row['deleted_at'] !== null && $row['deleted_at'] !== '') {
        return ['ok' => true, 'code' => null, 'message' => 'Paciente ya estaba eliminado'];
    }

    // Con hijos: soft-delete igualmente (RESTRICT bloquea hard-delete; soft es el camino).
    // Sin hijos: soft-delete también (política etapa 9: borrado lógico siempre).
    $upd = $pdo->prepare('UPDATE pacientes SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id AND deleted_at IS NULL');
    $upd->execute(['id' => $pacienteId]);
    return ['ok' => true, 'code' => null, 'message' => 'Paciente eliminado (borrado lógico)'];
}

/**
 * Fragmento SQL: excluir soft-deleted si la columna existe.
 */

/**
 * Fragmento SQL: excluir soft-deleted si la columna existe.
 */
function kinesica_rel_pacientes_not_deleted_sql(PDO $pdo, string $alias = ''): string
{
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return '1=1';
    }
    $col = $alias !== '' ? "{$alias}.deleted_at" : 'deleted_at';
    return "{$col} IS NULL";
}

/**
 * Valida que paciente_id exista (y no soft-deleted) cuando REL_ENFORCE_FK.
 *
 * @return true|array{code:string,message:string}
 */
