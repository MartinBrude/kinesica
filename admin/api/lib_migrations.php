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
function kinesica_migrations_add_check_if_missing(
    PDO $pdo,
    string $table,
    string $constraintName,
    string $expressionSql
): bool {
    $table = kinesica_migrations_assert_ident($table);
    $constraintName = kinesica_migrations_assert_ident($constraintName);
    if (kinesica_migrations_is_sqlite($pdo) || !kinesica_migrations_table_exists($pdo, $table)) {
        return false;
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :t
           AND CONSTRAINT_NAME = :c
           AND CONSTRAINT_TYPE = \'CHECK\'
         LIMIT 1'
    );
    $stmt->execute(['t' => $table, 'c' => $constraintName]);
    if ($stmt->fetchColumn()) {
        return false;
    }
    try {
        $pdo->exec(
            'ALTER TABLE `' . str_replace('`', '``', $table) . '`
             ADD CONSTRAINT `' . str_replace('`', '``', $constraintName) . '`
             CHECK (' . $expressionSql . ')'
        );
        return true;
    } catch (Throwable $e) {
        // MariaDB antiguos o expression no soportada: no bloquear migrate.
        error_log('kinesica migrations CHECK skip ' . $constraintName . ': ' . $e->getMessage());
        return false;
    }
}

/** Crea índice si no existe (nombre e identificadores validados parcialmente). */
function kinesica_migrations_ensure_index(PDO $pdo, string $table, string $indexName, string $columnsSql): void
{
    if (!kinesica_migrations_table_exists($pdo, $table)) {
        return;
    }
    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->exec(
            'CREATE INDEX IF NOT EXISTS ' . $indexName . ' ON ' . $table . ' (' . $columnsSql . ')'
        );
        return;
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i LIMIT 1'
    );
    $stmt->execute(['t' => $table, 'i' => $indexName]);
    if ($stmt->fetchColumn()) {
        return;
    }
    $pdo->exec(
        'CREATE INDEX `' . str_replace('`', '``', $indexName) . '` ON `'
        . str_replace('`', '``', $table) . '` (' . $columnsSql . ')'
    );
}

/** Tabla de control del runner. */
function kinesica_migrations_ensure_control_table(PDO $pdo): void
{
    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL
            )'
        );
        return;
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            id VARCHAR(120) NOT NULL PRIMARY KEY,
            checksum CHAR(64) NOT NULL,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

/**
 * @return list<array{id:string,path:string,checksum:string,up:callable}>
 */
function kinesica_migrations_discover(): array
{
    $dir = kinesica_migrations_dir();
    if (!is_dir($dir)) {
        return [];
    }
    $files = glob($dir . '/*.php') ?: [];
    sort($files, SORT_STRING);
    $out = [];
    foreach ($files as $path) {
        $basename = basename($path, '.php');
        if (!preg_match('/^\d{3}_[a-z0-9_]+$/', $basename)) {
            throw new RuntimeException('Nombre de migración inválido: ' . $basename);
        }
        /** @var mixed $def */
        $def = require $path;
        if (!is_array($def) || !isset($def['up']) || !is_callable($def['up'])) {
            throw new RuntimeException('Migración sin up() callable: ' . $basename);
        }
        $id = (string) ($def['id'] ?? $basename);
        if ($id !== $basename) {
            throw new RuntimeException("id de migración debe coincidir con el archivo: {$basename}");
        }
        $checksum = hash_file('sha256', $path);
        if ($checksum === false) {
            throw new RuntimeException('No se pudo hashear: ' . $path);
        }
        $out[] = [
            'id' => $id,
            'path' => $path,
            'checksum' => $checksum,
            'up' => $def['up'],
        ];
    }
    return $out;
}

/**
 * @return array<string,string> id => checksum
 */
function kinesica_migrations_applied_map(PDO $pdo): array
{
    kinesica_migrations_ensure_control_table($pdo);
    $rows = $pdo->query('SELECT id, checksum FROM schema_migrations')->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows as $row) {
        $map[(string) $row['id']] = (string) $row['checksum'];
    }
    return $map;
}

/** ¿Está aplicada la migración `$id`? */
function kinesica_migrations_is_applied(PDO $pdo, string $id): bool
{
    if ($id === '') {
        return false;
    }
    try {
        $map = kinesica_migrations_applied_map($pdo);
        return isset($map[$id]);
    } catch (Throwable) {
        return false;
    }
}

/**
 * Id de la mig marcador etapa 10 (compat / identidad por ID).
 * No apaga `ensure_*`: esos puentes siguen como red de seguridad idempotente
 * para no perder funcionalidad en entornos donde migrate aún no cubrió todo.
 */
function kinesica_migrations_rel_schema_cutover_id(): string
{
    return '014_etapa10_compat';
}

/**
 * ¿Correr `ensure_*` / puentes ALTER en requests?
 *
 * Siempre true (salvo tests que mockeen). Política etapa 10 revisada:
 * - Fuente de verdad de esquema = migrate CLI.
 * - `ensure_*` permanecen: CREATE IF NOT EXISTS / ADD COLUMN IF MISSING
 *   (idempotentes, no borran ni pisan datos).
 * - Apagarlos tras 014 rompía columnas operativas (media_*, encuesta_enviada, …)
 *   que aún viven en el puente — inaceptable para data/funcionalidad productiva.
 *
 * @param bool $force reservado (repair); no cambia el resultado hoy
 */
function kinesica_schema_bridges_should_run(PDO $pdo, bool $force = false): bool
{
    unset($pdo, $force);
    return true;
}

/**
 * Aplica migraciones pendientes.
 *
 * @return array{applied:list<string>,skipped:list<string>,pending:list<string>}
 */
function kinesica_migrations_run(PDO $pdo, bool $dryRun = false): array
{
    kinesica_migrations_ensure_control_table($pdo);
    $appliedMap = kinesica_migrations_applied_map($pdo);
    $discovered = kinesica_migrations_discover();
    $result = ['applied' => [], 'skipped' => [], 'pending' => []];

    foreach ($discovered as $mig) {
        $id = $mig['id'];
        if (isset($appliedMap[$id])) {
            if (!hash_equals($appliedMap[$id], $mig['checksum'])) {
                throw new RuntimeException(
                    "Checksum distinto para migración ya aplicada {$id}. No editar migraciones aplicadas; crear una nueva."
                );
            }
            $result['skipped'][] = $id;
            continue;
        }
        $result['pending'][] = $id;
        if ($dryRun) {
            continue;
        }
        // MySQL/MariaDB hace commit implícito en DDL; solo transaccionamos en SQLite.
        $useTx = kinesica_migrations_is_sqlite($pdo);
        if ($useTx) {
            $pdo->beginTransaction();
        }
        try {
            ($mig['up'])($pdo);
            $ins = $pdo->prepare(
                'INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (:id, :checksum, :at)'
            );
            $ins->execute([
                'id' => $id,
                'checksum' => $mig['checksum'],
                'at' => gmdate('Y-m-d H:i:s'),
            ]);
            if ($useTx && $pdo->inTransaction()) {
                $pdo->commit();
            }
            $result['applied'][] = $id;
        } catch (Throwable $e) {
            if ($useTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw new RuntimeException("Fallo migración {$id}: " . $e->getMessage(), 0, $e);
        }
    }

    return $result;
}

/**
 * @return array{applied:list<string>,pending:list<string>}
 */
function kinesica_migrations_status(PDO $pdo): array
{
    $appliedMap = kinesica_migrations_applied_map($pdo);
    $applied = [];
    $pending = [];
    foreach (kinesica_migrations_discover() as $mig) {
        if (isset($appliedMap[$mig['id']])) {
            $applied[] = $mig['id'];
        } else {
            $pending[] = $mig['id'];
        }
    }
    return ['applied' => $applied, 'pending' => $pending];
}
