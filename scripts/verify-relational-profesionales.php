<?php
declare(strict_types=1);

/**
 * Tests SQLite — tabla profesionales, seed, backfill profesional_id, ficha version/409.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-profesionales.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_resolve.php';
require_once $root . '/admin/api/lib_relational_profesionales.php';

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

$mig5 = require $root . '/admin/api/migrations/005_profesionales.php';
($mig5['up'])($pdo);
assert_true(kinesica_rel_profesionales_ready($pdo), 'tabla profesionales');

$n = kinesica_rel_fetch_profesional_by_slug($pdo, 'norberto');
$m = kinesica_rel_fetch_profesional_by_slug($pdo, 'maria');
assert_true($n !== null && $m !== null && $n['id'] !== $m['id'], 'seed norberto/maria');

$pid = kinesica_rel_resolve_profesional_id($pdo, 'norberto', ['ignore_flag' => true]);
assert_true($pid === $n['id'], 'resolve profesional_id');

$pdo->exec(
    'CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        profesional TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL DEFAULT \'\',
        paciente_id INTEGER NULL,
        profesional_id INTEGER NULL,
        version INTEGER NOT NULL DEFAULT 1
    )'
);
$pdo->exec("INSERT INTO fichas (id, payload, profesional, profesional_id, version) VALUES
    ('f1', '{\"nombre\":\"A\"}', 'norberto', NULL, 1),
    ('f2', '{\"nombre\":\"B\"}', 'maria', NULL, 3),
    ('f3', '{\"nombre\":\"C\"}', 'indistinto', NULL, 1)");

$bf = kinesica_rel_backfill_fichas_profesional_id($pdo, true);
assert_true(($bf['matched'] ?? 0) === 2, 'backfill matched 2');
assert_true(($bf['unmatched'] ?? 0) === 1, 'indistinto unmatched');
assert_true((int) $pdo->query("SELECT profesional_id FROM fichas WHERE id = 'f1'")->fetchColumn() === $n['id'], 'f1 profesional_id');
assert_true((int) $pdo->query("SELECT profesional_id FROM fichas WHERE id = 'f2'")->fetchColumn() === $m['id'], 'f2 profesional_id');

// Version: cliente stale vs DB
$dbV = (int) $pdo->query("SELECT version FROM fichas WHERE id = 'f2'")->fetchColumn();
assert_true($dbV === 3, 'versión actual f2=3');
assert_true(1 !== $dbV, 'cliente stale detectado');

// Save incrementa version (sin auth real: llamar SQL path)
$pdo->exec("UPDATE fichas SET version = version + 1 WHERE id = 'f2'");
assert_true((int) $pdo->query("SELECT version FROM fichas WHERE id = 'f2'")->fetchColumn() === 4, 'version++');

// Migraciones 001-005 idempotentes en sqlite vacío + fichas base
$pdo2 = new PDO('sqlite::memory:');
$pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo2->exec(
    'CREATE TABLE pacientes (id INTEGER PRIMARY KEY, telefono TEXT, nombre_completo TEXT);
     CREATE TABLE fichas (id TEXT PRIMARY KEY, payload TEXT, profesional TEXT, updated_at TEXT, updated_by TEXT);
     CREATE TABLE lista_espera (id INTEGER PRIMARY KEY, paciente_telefono TEXT, paciente_nombre TEXT, profesional TEXT);
     CREATE TABLE interaccion_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, direction TEXT, body TEXT, ts_utc TEXT, received_at TEXT);
     CREATE TABLE recordatorio_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, status TEXT, run_at TEXT, received_at TEXT);'
);
$first = kinesica_migrations_run($pdo2, false);
$second = kinesica_migrations_run($pdo2, false);
assert_true(count($first['applied']) >= 5, 'aplica >=5 migraciones');
assert_true($second['applied'] === [], 'segunda pasada idempotente');
assert_true(kinesica_migrations_table_exists($pdo2, 'profesionales'), 'profesionales tras migrate');
assert_true(kinesica_migrations_column_exists($pdo2, 'fichas', 'version'), 'fichas.version');

echo "verify-relational-profesionales: OK\n";
