<?php
declare(strict_types=1);

/**
 * Integridad referencial (etapa 9).
 *
 * - Preflight: null huérfanos antes de ADD FK (mig 013).
 * - Soft-delete pacientes (ON DELETE RESTRICT en hijos).
 * - Mapeo PDO 23000 / 1451 / 1452 → respuesta API estable.
 * - Validación app cuando REL_ENFORCE_FK (IDs deben existir).
 *
 * FKs SQL viven en migrations/013_rel_integrity_fks.php (MariaDB).
 * SQLite: PRAGMA foreign_keys + schema de tests; ALTER ADD FK = no-op.
 *
 * Docs: docs/etapa9-integridad-referencial.md
 */

require_once __DIR__ . '/lib_migrations.php';
require_once __DIR__ . '/lib_relational_flags.php';

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
function kinesica_rel_assert_paciente_id(PDO $pdo, ?int $pacienteId)
{
    if ($pacienteId === null || $pacienteId <= 0) {
        return true;
    }
    if (!kinesica_rel_enforce_fk()) {
        return true;
    }
    $sql = 'SELECT id, deleted_at FROM pacientes WHERE id = :id LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $pacienteId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return [
            'code' => 'fk_paciente_missing',
            'message' => 'No se puede referenciar un paciente inexistente.',
        ];
    }
    if (kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')
        && $row['deleted_at'] !== null
        && $row['deleted_at'] !== ''
    ) {
        return [
            'code' => 'fk_paciente_deleted',
            'message' => 'No se puede referenciar un paciente eliminado.',
        ];
    }
    return true;
}

/**
 * @return true|array{code:string,message:string}
 */
function kinesica_rel_assert_profesional_id(PDO $pdo, ?int $profesionalId)
{
    if ($profesionalId === null || $profesionalId <= 0) {
        return true;
    }
    if (!kinesica_rel_enforce_fk()) {
        return true;
    }
    if (!kinesica_migrations_table_exists($pdo, 'profesionales')) {
        return true;
    }
    $stmt = $pdo->prepare(
        'SELECT id, deleted_at FROM profesionales WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $profesionalId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return [
            'code' => 'fk_profesional_missing',
            'message' => 'No se puede asignar un profesional inexistente.',
        ];
    }
    if (($row['deleted_at'] ?? null) !== null && $row['deleted_at'] !== '') {
        return [
            'code' => 'fk_profesional_deleted',
            'message' => 'No se puede asignar un profesional desactivado.',
        ];
    }
    return true;
}

/**
 * Mapea PDOException de integridad a payload API (sin SQL crudo).
 *
 * @return array{http:int,body:array}|null null si no es integridad
 */
function kinesica_rel_map_integrity_exception(Throwable $e): ?array
{
    if (!$e instanceof PDOException) {
        return null;
    }
    $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());
    $driverCode = (int) ($e->errorInfo[1] ?? 0);
    $msg = (string) $e->getMessage();

    $isIntegrity = $sqlState === '23000'
        || in_array($driverCode, [1062, 1451, 1452], true)
        || stripos($msg, 'FOREIGN KEY') !== false
        || stripos($msg, 'UNIQUE constraint') !== false
        || stripos($msg, 'Integrity constraint') !== false;

    if (!$isIntegrity) {
        return null;
    }

    // Duplicate key
    if ($driverCode === 1062 || stripos($msg, 'UNIQUE') !== false || stripos($msg, 'Duplicate') !== false) {
        return [
            'http' => 409,
            'body' => [
                'status' => 'error',
                'code' => 'unique_violation',
                'message' => 'Ya existe un registro con esa clave única.',
            ],
        ];
    }

    // Parent delete blocked / child insert with bad FK
    if ($driverCode === 1451 || stripos($msg, 'Cannot delete') !== false) {
        return [
            'http' => 409,
            'body' => [
                'status' => 'error',
                'code' => 'fk_restrict_delete',
                'message' => 'No se puede eliminar: hay registros clínicos u operativos vinculados.',
            ],
        ];
    }

    return [
        'http' => 422,
        'body' => [
            'status' => 'error',
            'code' => 'referential_integrity',
            'message' => 'La referencia no es válida (integridad referencial).',
        ],
    ];
}

/**
 * Emite json_out si es error de integridad; si no, false.
 */
function kinesica_rel_json_out_if_integrity(Throwable $e): bool
{
    $mapped = kinesica_rel_map_integrity_exception($e);
    if ($mapped === null) {
        return false;
    }
    if (function_exists('json_out')) {
        json_out($mapped['http'], $mapped['body']);
    }
    return true;
}

/**
 * Nombre de constraint FK alineado a mig 013 / specs.
 */
function kinesica_rel_integrity_fk_name(string $table, string $column): string
{
    $suffix = match ($column) {
        'paciente_id' => 'paciente',
        'profesional_id' => 'profesional',
        'turno_id' => 'turno',
        default => preg_replace('/_id$/', '', $column) ?: $column,
    };
    return "fk_{$table}_{$suffix}";
}

/**
 * Aplica FKs RESTRICT de etapa 9 (idempotente). Usado por mig 013.
 * Fuente de verdad: kinesica_rel_integrity_fk_specs().
 *
 * @return array{added:list<string>,skipped:list<string>}
 */
function kinesica_rel_integrity_apply_fks(PDO $pdo): array
{
    $added = [];
    $skipped = [];

    // En MySQL/MariaDB asegurar que la clave primaria pacientes.id sea INT UNSIGNED
    // para coincidir con el tipo INT UNSIGNED de las columnas paciente_id foráneas.
    if (!kinesica_migrations_is_sqlite($pdo)) {
        try {
            if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
                $pdo->exec('ALTER TABLE pacientes MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT');
            }
        } catch (Throwable $e) {
            error_log('kinesica ensure pacientes.id INT UNSIGNED: ' . $e->getMessage());
        }
    }

    foreach (kinesica_rel_integrity_fk_specs() as $spec) {
        $table = $spec['table'];
        $col = $spec['column'];
        $parent = $spec['parent'];
        $name = kinesica_rel_integrity_fk_name($table, $col);
        try {
            if (kinesica_migrations_add_fk_if_missing(
                $pdo,
                $table,
                $name,
                $col,
                $parent,
                $spec['parent_column'],
                'RESTRICT',
                'RESTRICT'
            )) {
                $added[] = $name;
            } else {
                $skipped[] = $name;
            }
        } catch (Throwable $e) {
            error_log("kinesica FK {$name}: " . $e->getMessage());
            $skipped[] = $name . ':error';
        }
    }

    // CHECK opcionales (status)
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'turnos',
        'chk_turnos_status',
        "status IN ('scheduled','cancelled','completed','unknown')"
    );
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'turnos',
        'chk_turnos_source',
        "source IN ('gas','recordatorio','manual','backfill','booking','backup')"
    );
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'recordatorio_eventos',
        'chk_recordatorio_status',
        "status IN ('pending','sent','sent_email','failed','missing_phone','skipped','run_skipped')"
    );

    return ['added' => $added, 'skipped' => $skipped];
}
