<?php
declare(strict_types=1);

/**
 * Tests SQLite — conversación (estado) con paciente_id + touch/backfill.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-interacciones.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_interacciones.php';

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
    'CREATE TABLE interaccion_estado (
        conversation_key TEXT PRIMARY KEY,
        patient_name TEXT,
        updated_at TEXT,
        updated_by TEXT DEFAULT \'\'
    )'
);
$pdo->exec(
    'CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT UNIQUE,
        wa_id TEXT,
        paciente_id INTEGER NULL,
        direction TEXT,
        body TEXT,
        ts_utc TEXT,
        patient_name TEXT,
        received_at TEXT
    )'
);
$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY,
        telefono TEXT,
        nombre_completo TEXT,
        nombre TEXT DEFAULT \'\',
        apellido TEXT DEFAULT \'\',
        dni TEXT
    )'
);
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre_completo) VALUES (7, '5491199887766', 'WA Paciente')");

$mig = require $root . '/admin/api/migrations/007_interaccion_estado_paciente.php';
($mig['up'])($pdo);
assert_true(kinesica_rel_interaccion_estado_has_paciente($pdo), 'estado.paciente_id');
assert_true(kinesica_migrations_column_exists($pdo, 'interaccion_estado', 'wa_id'), 'estado.wa_id');

$key = kinesica_rel_interaccion_conversation_key('5491199887766', strtotime('2026-11-06 15:00:00 UTC'));
assert_true(str_starts_with($key, '5491199887766_'), 'conversation_key prefijo wa');

kinesica_rel_touch_interaccion_estado_paciente($pdo, '5491199887766', strtotime('2026-11-06 15:00:00 UTC'), 7, 'WA Paciente');
$row = $pdo->query('SELECT paciente_id, wa_id, patient_name FROM interaccion_estado')->fetch(PDO::FETCH_ASSOC);
assert_true((int) $row['paciente_id'] === 7, 'touch set paciente_id');
assert_true((string) $row['wa_id'] === '5491199887766', 'touch set wa_id');

// No pisar con NULL
kinesica_rel_touch_interaccion_estado_paciente($pdo, '5491199887766', strtotime('2026-11-06 16:00:00 UTC'), null, '');
assert_true((int) $pdo->query('SELECT paciente_id FROM interaccion_estado')->fetchColumn() === 7, 'no pisa con null');

$pdo->exec(
    "INSERT INTO interaccion_estado (conversation_key, paciente_id, updated_at)
     VALUES ('5491100000000_2026-11-05', NULL, '2026-11-05 00:00:00')"
);
$pdo->exec(
    "INSERT INTO interaccion_eventos (event_key, wa_id, paciente_id, direction, body, ts_utc, patient_name, received_at)
     VALUES ('e1', '5491100000000', 7, 'patient', 'hola', '2026-11-05 12:00:00', 'X', '2026-11-05 12:00:00')"
);

$bf = kinesica_rel_backfill_interaccion_estado($pdo, true);
assert_true(($bf['matched'] ?? 0) >= 1, 'backfill matched');
assert_true(
    (int) $pdo->query(
        "SELECT paciente_id FROM interaccion_estado WHERE conversation_key = '5491100000000_2026-11-05'"
    )->fetchColumn() === 7,
    'backfill set id'
);

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
assert_true(count($run['applied']) >= 7, 'migrate >=7');
assert_true(kinesica_migrations_column_exists($pdo2, 'interaccion_estado', 'paciente_id'), '007 aplicada');

// Asociación posterior (link_paciente)
$pdo->exec(
    "INSERT INTO interaccion_estado (conversation_key, paciente_id, updated_at)
     VALUES ('5491188877766_2026-11-06', NULL, '2026-11-06 00:00:00')"
);
$pdo->exec(
    "INSERT INTO pacientes (id, telefono, nombre_completo) VALUES (42, '5491188877766', 'Link Posterior')"
);
$link = kinesica_rel_link_interaccion_conversacion($pdo, '5491188877766_2026-11-06', 42, 'test');
assert_true(!empty($link['ok']) && (int) $link['paciente_id'] === 42, 'link posterior ok');
assert_true(
    (int) $pdo->query(
        "SELECT paciente_id FROM interaccion_estado WHERE conversation_key = '5491188877766_2026-11-06'"
    )->fetchColumn() === 42,
    'estado linkeado'
);

echo "verify-relational-interacciones: OK\n";