<?php
declare(strict_types=1);


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
