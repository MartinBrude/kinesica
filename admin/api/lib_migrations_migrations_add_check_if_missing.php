<?php
declare(strict_types=1);


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
