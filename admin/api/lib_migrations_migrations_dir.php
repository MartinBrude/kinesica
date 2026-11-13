<?php
declare(strict_types=1);


/**
 * Runner de migraciones versionadas (MariaDB/MySQL + SQLite de pruebas).
 *
 * Responsabilidad
 * - Descubrir `migrations/NNN_nombre.php` (orden lexicográfico).
 * - Ejecutar `up(PDO)` una sola vez; registrar id + checksum en `schema_migrations`.
 * - Helpers seguros: tabla/columna/índice; FK/CHECK (etapa 9, MariaDB; SQLite ADD FK = no-op).
 *
 * Límites
 * - Solo CLI vía `migrate.php` (o tests). No invocar desde requests HTTP del admin.
 * - MySQL hace commit implícito en DDL: las migraciones no van en transacción ahí.
 * - No editar migraciones ya aplicadas en producción (checksum distinto → error).
 * - FKs InnoDB no se “apagan” con REL_ENFORCE_FK; rollback SQL = DROP CONSTRAINT / restore.
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/etapa9-integridad-referencial.md
 */

/** Directorio absoluto de archivos de migración. */
function kinesica_migrations_dir(): string
{
    return __DIR__ . '/migrations';
}


function kinesica_migrations_is_sqlite(PDO $pdo): bool
{
    return (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
}


function kinesica_migrations_table_exists(PDO $pdo, string $table): bool
{
    if (kinesica_migrations_is_sqlite($pdo)) {
        $stmt = $pdo->prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :t LIMIT 1"
        );
        $stmt->execute(['t' => $table]);
        return (bool) $stmt->fetchColumn();
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

/** Evita interpolar identificadores arbitrarios en DDL. */

/** Evita interpolar identificadores arbitrarios en DDL. */
function kinesica_migrations_assert_ident(string $name): string
{
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
        throw new InvalidArgumentException('Identificador SQL inválido: ' . $name);
    }
    return $name;
}


function kinesica_migrations_column_exists(PDO $pdo, string $table, string $column): bool
{
    $table = kinesica_migrations_assert_ident($table);
    if (!kinesica_migrations_table_exists($pdo, $table)) {
        return false;
    }
    if (kinesica_migrations_is_sqlite($pdo)) {
        $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');
        if ($stmt === false) {
            return false;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (strcasecmp((string) ($row['name'] ?? ''), $column) === 0) {
                return true;
            }
        }
        return false;
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1'
    );
    $stmt->execute(['t' => $table, 'c' => $column]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Añade columna si falta. Idempotente.
 *
 * @param string $definitionMySql  p.ej. "INT UNSIGNED NULL AFTER id"
 * @param string|null $definitionSqlite  si null, se quita la cláusula AFTER
 * @return bool true si se ejecutó ALTER
 */

/**
 * Añade columna si falta. Idempotente.
 *
 * @param string $definitionMySql  p.ej. "INT UNSIGNED NULL AFTER id"
 * @param string|null $definitionSqlite  si null, se quita la cláusula AFTER
 * @return bool true si se ejecutó ALTER
 */
function kinesica_migrations_add_column_if_missing(
    PDO $pdo,
    string $table,
    string $column,
    string $definitionMySql,
    ?string $definitionSqlite = null
): bool {
    if (kinesica_migrations_column_exists($pdo, $table, $column)) {
        return false;
    }
    if (!kinesica_migrations_table_exists($pdo, $table)) {
        return false;
    }
    if (kinesica_migrations_is_sqlite($pdo)) {
        $def = $definitionSqlite ?? preg_replace('/\s+AFTER\s+\w+/i', '', $definitionMySql) ?? $definitionMySql;
        $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $def);
        return true;
    }
    $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `'
        . str_replace('`', '``', $column) . '` ' . $definitionMySql);
    return true;
}

/**
 * ¿Existe un FOREIGN KEY con ese nombre de constraint?
 * SQLite: busca en PRAGMA foreign_key_list por tabla hija (nombre de constraint puede ser vacío).
 */

/**
 * ¿Existe un FOREIGN KEY con ese nombre de constraint?
 * SQLite: busca en PRAGMA foreign_key_list por tabla hija (nombre de constraint puede ser vacío).
 */
function kinesica_migrations_fk_exists(PDO $pdo, string $table, string $constraintName): bool
{
    $table = kinesica_migrations_assert_ident($table);
    $constraintName = kinesica_migrations_assert_ident($constraintName);
    if (kinesica_migrations_is_sqlite($pdo)) {
        // SQLite no guarda nombres de FK de forma fiable en tablas legacy;
        // usamos un marcador en schema_migrations / skip en ADD.
        return false;
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :t
           AND CONSTRAINT_NAME = :c
           AND CONSTRAINT_TYPE = \'FOREIGN KEY\'
         LIMIT 1'
    );
    $stmt->execute(['t' => $table, 'c' => $constraintName]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Añade FK idempotente. En SQLite ALTER ADD CONSTRAINT no es portable → no-op
 * (los verify usan schema con FK en CREATE + PRAGMA foreign_keys=ON).
 *
 * @return bool true si se añadió
 */

/**
 * Añade FK idempotente. En SQLite ALTER ADD CONSTRAINT no es portable → no-op
 * (los verify usan schema con FK en CREATE + PRAGMA foreign_keys=ON).
 *
 * @return bool true si se añadió
 */
function kinesica_migrations_add_fk_if_missing(
    PDO $pdo,
    string $table,
    string $constraintName,
    string $column,
    string $refTable,
    string $refColumn = 'id',
    string $onDelete = 'RESTRICT',
    string $onUpdate = 'RESTRICT'
): bool {
    $table = kinesica_migrations_assert_ident($table);
    $constraintName = kinesica_migrations_assert_ident($constraintName);
    $column = kinesica_migrations_assert_ident($column);
    $refTable = kinesica_migrations_assert_ident($refTable);
    $refColumn = kinesica_migrations_assert_ident($refColumn);
    $onDelete = strtoupper($onDelete);
    $onUpdate = strtoupper($onUpdate);
    foreach ([$onDelete, $onUpdate] as $action) {
        if (!in_array($action, ['RESTRICT', 'NO ACTION', 'CASCADE', 'SET NULL', 'SET DEFAULT'], true)) {
            throw new InvalidArgumentException('ON DELETE/UPDATE action inválida');
        }
    }

    if (!kinesica_migrations_table_exists($pdo, $table)
        || !kinesica_migrations_table_exists($pdo, $refTable)
        || !kinesica_migrations_column_exists($pdo, $table, $column)
    ) {
        return false;
    }
    if (kinesica_migrations_is_sqlite($pdo)) {
        return false;
    }
    if (kinesica_migrations_fk_exists($pdo, $table, $constraintName)) {
        return false;
    }

    $pdo->exec(
        'ALTER TABLE `' . str_replace('`', '``', $table) . '`
         ADD CONSTRAINT `' . str_replace('`', '``', $constraintName) . '`
         FOREIGN KEY (`' . str_replace('`', '``', $column) . '`)
         REFERENCES `' . str_replace('`', '``', $refTable) . '` (`' . str_replace('`', '``', $refColumn) . '`)
         ON DELETE ' . $onDelete . ' ON UPDATE ' . $onUpdate
    );
    return true;
}

/**
 * CHECK constraint idempotente (MariaDB). SQLite: no-op.
 *
 * @return bool true si se añadió
 */
