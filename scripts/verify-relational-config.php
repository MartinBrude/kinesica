<?php
declare(strict_types=1);

/**
 * Tests SQLite — configuraciones + auditoría + phone/email profesionales (etapa 8).
 * Docs: docs/etapa8-config-gastos.md
 * Run: php scripts/verify-relational-config.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_config.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    echo "OK: {$msg}\n";
}

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec(
    'CREATE TABLE profesionales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        username TEXT NULL,
        display_name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);
$pdo->exec(
    "INSERT INTO profesionales (slug, username, display_name) VALUES
     ('norberto', 'norberto', 'Norberto'),
     ('maria', 'maria', 'María')"
);

foreach (['009_profesionales_contactos', '010_configuraciones', '011_auditoria_cambios'] as $id) {
    $mig = require $root . "/admin/api/migrations/{$id}.php";
    ($mig['up'])($pdo);
}

assert_true(kinesica_migrations_column_exists($pdo, 'profesionales', 'phone'), 'phone column');
assert_true(kinesica_rel_config_ready($pdo), 'configuraciones ready');
assert_true(kinesica_rel_auditoria_ready($pdo), 'auditoria ready');

assert_true(
    kinesica_rel_config_set($pdo, 'fees', ['atm' => 70000, 'general' => 80000], 'tester'),
    'set fees'
);
$row = kinesica_rel_config_get($pdo, 'fees');
assert_true($row !== null && (int) $row['value']['atm'] === 70000, 'get fees');
assert_true($row['version'] === 1, 'version 1');

assert_true(
    kinesica_rel_config_set($pdo, 'fees', ['atm' => 71000, 'general' => 80000], 'tester'),
    'update fees'
);
$row = kinesica_rel_config_get($pdo, 'fees');
assert_true($row !== null && $row['version'] === 2, 'version 2');

// Conflicto de versión
$ok = kinesica_rel_config_set($pdo, 'fees', ['atm' => 1], 'other', 1);
assert_true($ok === false, 'expectedVersion conflict');

$audit = $pdo->query('SELECT COUNT(*) FROM auditoria_cambios WHERE entity = \'configuraciones\'')->fetchColumn();
assert_true((int) $audit >= 2, 'auditoria entries');

// Clave no allowlisted
assert_true(
    kinesica_rel_config_set($pdo, 'webhook_secret', 'x', 'bad') === false,
    'reject secret key'
);

assert_true(
    kinesica_rel_profesional_set_contact($pdo, 'norberto', '54911', 'n@test.com'),
    'set contact'
);
$ph = $pdo->query("SELECT phone, email FROM profesionales WHERE slug = 'norberto'")->fetch(PDO::FETCH_ASSOC);
assert_true($ph['phone'] === '54911' && $ph['email'] === 'n@test.com', 'contact stored');

$overlay = kinesica_rel_config_overlay_settings($pdo, ['fees' => ['atm' => 1], 'other' => true]);
assert_true((int) $overlay['fees']['atm'] === 71000, 'overlay wins');
assert_true($overlay['other'] === true, 'non-config key preserved');

// Migrate runner incluye 009–012
$pdo2 = new PDO('sqlite::memory:');
$pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo2->exec(
    'CREATE TABLE pacientes (id INTEGER PRIMARY KEY, telefono TEXT, nombre_completo TEXT);
     CREATE TABLE fichas (id TEXT PRIMARY KEY, payload TEXT, profesional TEXT, updated_at TEXT, updated_by TEXT);
     CREATE TABLE lista_espera (id INTEGER PRIMARY KEY, paciente_telefono TEXT, paciente_nombre TEXT, profesional TEXT);
     CREATE TABLE interaccion_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, direction TEXT, body TEXT, ts_utc TEXT, received_at TEXT);
     CREATE TABLE interaccion_estado (conversation_key TEXT PRIMARY KEY, updated_at TEXT);
     CREATE TABLE recordatorio_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, status TEXT, run_at TEXT, received_at TEXT);'
);
$run = kinesica_migrations_run($pdo2, false);
assert_true(count($run['applied']) >= 12, 'migrate >=12');
assert_true(kinesica_migrations_table_exists($pdo2, 'gastos'), '012 gastos');
assert_true(kinesica_migrations_table_exists($pdo2, 'configuraciones'), '010 config');

echo "verify-relational-config: OK\n";
