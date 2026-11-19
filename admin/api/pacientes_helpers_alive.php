<?php
declare(strict_types=1);

/**
 * Soft-delete / alive helpers para pacientes.
 */

/**
 * ¿La fila está activa? Soft-deleted (deleted_at seteado) no participa de match/dedupe.
 *
 * @param array<string,mixed> $row
 */
function kinesica_pacientes_row_is_active(array $row): bool
{
    if (!array_key_exists('deleted_at', $row)) {
        return true;
    }
    $v = $row['deleted_at'];
    return $v === null || $v === '';
}

/**
 * Fragmento SQL para excluir soft-deleted si la columna existe.
 */
function kinesica_pacientes_alive_sql(PDO $pdo, string $alias = ''): string
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return '1=1';
    }
    $col = $alias !== '' ? "{$alias}.deleted_at" : 'deleted_at';
    return "{$col} IS NULL";
}

/**
 * Paciente activo por id (excluye soft-deleted). Null si no existe o está borrado.
 *
 * @return array<string,mixed>|null
 */
function kinesica_pacientes_fetch_alive(PDO $pdo, int $id): ?array
{
    if ($id <= 0) {
        return null;
    }
    $alive = kinesica_pacientes_alive_sql($pdo);
    $stmt = $pdo->prepare("SELECT * FROM pacientes WHERE id = :id AND ({$alive}) LIMIT 1");
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

/**
 * Igual que fetch_alive, pero responde 404 JSON si no hay fila activa.
 *
 * @return array<string,mixed>
 */
function kinesica_pacientes_require_alive(PDO $pdo, int $id): array
{
    if ($id <= 0) {
        json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
    }
    $row = kinesica_pacientes_fetch_alive($pdo, $id);
    if (!$row) {
        json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
    }
    return $row;
}

/**
 * Ficha soft-deleted que aún ocupa UNIQUE(telefono).
 * Usado en upsert para revivir en lugar de un ON DUPLICATE "fantasma".
 *
 * @return array<string,mixed>|null
 */
function kinesica_pacientes_find_soft_deleted_by_phone(PDO $pdo, string $phone): ?array
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return null;
    }
    $clean = clean_phone_number($phone);
    if ($clean === '' || is_placeholder_phone($clean)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT * FROM pacientes WHERE telefono = :tel AND deleted_at IS NOT NULL LIMIT 1'
    );
    $stmt->execute(['tel' => $clean]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}
