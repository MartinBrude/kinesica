<?php
declare(strict_types=1);

/**
 * Prueba el runner de migraciones contra SQLite en memoria (idempotencia + columnas).
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_flags.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    echo "OK: {$msg}\n";
}

// Flags defaults
kinesica_rel_flags_reset_cache();
$flags = kinesica_rel_flags();
assert_true($flags['write_ids'] === false, 'write_ids default false');
assert_true($flags['read_ids'] === false, 'read_ids default false');
assert_true($flags['enforce_fk'] === false, 'enforce_fk default false');

putenv('KINESICA_REL_WRITE_IDS=1');
kinesica_rel_flags_reset_cache();
assert_true(kinesica_rel_write_ids() === true, 'env KINESICA_REL_WRITE_IDS=1');
putenv('KINESICA_REL_WRITE_IDS');
kinesica_rel_flags_reset_cache();

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Esquema mínimo legacy (como producción antes del refactor)
$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL DEFAULT \'\',
        apellido TEXT NOT NULL DEFAULT \'\',
        nombre_completo TEXT NOT NULL,
        nombre_pila TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
    )'
);
$pdo->exec(
    'CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        profesional TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
    )'
);
$pdo->exec(
    'CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT NOT NULL,
        paciente_nombre TEXT NOT NULL,
        profesional TEXT NOT NULL DEFAULT \'indistinto\',
        estado TEXT NOT NULL DEFAULT \'activa\',
        created_at TEXT
    )'
);
$pdo->exec(
    'CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        wa_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        body TEXT NOT NULL,
        ts_utc TEXT NOT NULL,
        received_at TEXT NOT NULL
    )'
);
$pdo->exec(
    'CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        wa_id TEXT NOT NULL DEFAULT \'\',
        status TEXT NOT NULL,
        run_at TEXT NOT NULL,
        received_at TEXT NOT NULL
    )'
);

$first = kinesica_migrations_run($pdo, false);
assert_true(count($first['applied']) >= 4, 'primera corrida aplica migraciones');
assert_true($first['skipped'] === [], 'primera corrida sin skipped');

assert_true(kinesica_migrations_table_exists($pdo, 'schema_migrations'), 'tabla schema_migrations');
assert_true(kinesica_migrations_table_exists($pdo, 'paciente_contactos'), 'tabla paciente_contactos');
assert_true(kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id'), 'fichas.paciente_id');
assert_true(kinesica_migrations_column_exists($pdo, 'fichas', 'profesional_id'), 'fichas.profesional_id');
assert_true(kinesica_migrations_column_exists($pdo, 'fichas', 'version'), 'fichas.version');
assert_true(kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id'), 'lista_espera.paciente_id');
assert_true(kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id'), 'interaccion_eventos.paciente_id');
assert_true(kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id'), 'recordatorio_eventos.paciente_id');
assert_true(kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id'), 'recordatorio_eventos.turno_id');
assert_true(kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at'), 'pacientes.deleted_at');
assert_true(kinesica_migrations_column_exists($pdo, 'pacientes', 'version'), 'pacientes.version');

$second = kinesica_migrations_run($pdo, false);
assert_true($second['applied'] === [], 'segunda corrida no reaplica');
assert_true(count($second['skipped']) === count($first['applied']), 'segunda corrida skipea todas');

$status = kinesica_migrations_status($pdo);
assert_true($status['pending'] === [], 'sin migraciones pendientes');

echo "verify-relational-migrations: OK\n";
