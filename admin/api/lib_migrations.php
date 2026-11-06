<?php
declare(strict_types=1);

/**
 * Runner de migraciones versionadas (MariaDB/MySQL + SQLite de pruebas).
 *
 * Responsabilidad
 * - Descubrir `migrations/NNN_nombre.php` (orden lexicográfico).
 * - Ejecutar `up(PDO)` una sola vez; registrar id + checksum en `schema_migrations`.
 * - Helpers seguros de existencia de tabla/columna/índice (MariaDB y SQLite).
 *
 * Límites
 * - Solo CLI vía `migrate.php` (o tests). No invocar desde requests HTTP del admin.
 * - MySQL hace commit implícito en DDL: las migraciones no van en transacción ahí.
 * - No editar migraciones ya aplicadas en producción (checksum distinto → error).
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/plan-refactor-datos-relacionales.md
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
