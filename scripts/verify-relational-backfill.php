<?php
declare(strict_types=1);

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_relational_backfill.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    echo "OK: {$msg}\n";
}

putenv('KINESICA_REL_WRITE_IDS'); // flag off — backfill usa ignore_flag
kinesica_rel_flags_reset_cache();

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL,
        nombre_completo TEXT NOT NULL,
        dni TEXT
    )'
);
$pdo->exec("INSERT INTO pacientes (telefono, nombre_completo, dni) VALUES
    ('5491161234567', 'Ana Gómez', '30111222'),
    ('5491188887777', 'Luis Pérez', '20111111'),
    ('+54 9 11 8888-7777', 'Carla Ruiz', '20999888')");

$pdo->exec(
    'CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        profesional TEXT NOT NULL,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO fichas (id, payload, profesional, paciente_id) VALUES
    ('f1', '{\"nombre\":\"Ana Gómez\",\"dni\":\"30111222\"}', 'norberto', NULL),
    ('f2', '{\"nombre\":\"Ghost\",\"dni\":\"99999999\"}', 'norberto', NULL),
    ('f3', '{\"nombre\":\"Ya linkeada\",\"dni\":\"30111222\"}', 'norberto', 1)");

$pdo->exec(
    'CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT,
        paciente_nombre TEXT,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO lista_espera (paciente_telefono, paciente_nombre, paciente_id) VALUES
    ('5491161234567', 'Ana Gómez', NULL),
    ('5491100000000', 'Nadie', NULL)");

$pdo->exec(
    'CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wa_id TEXT,
        patient_name TEXT,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO interaccion_eventos (wa_id, patient_name, paciente_id) VALUES
    ('5491161234567', 'Ana', NULL),
    ('5491161234567', 'Ana Gómez', NULL),
    ('5491177776666', 'Desconocido', NULL)");

$pdo->exec(
    'CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wa_id TEXT,
        patient_name TEXT,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO recordatorio_eventos (wa_id, patient_name, paciente_id) VALUES
    ('5491161234567', 'Ana', NULL),
    ('', 'Solo nombre', NULL)");

// Dry-run: no writes
$dry = kinesica_rel_backfill_run($pdo, false);
assert_true(($dry['tables']['fichas']['matched'] ?? 0) === 1, 'dry fichas matched=1');
assert_true(($dry['tables']['fichas']['updated'] ?? 0) === 0, 'dry no actualiza');
assert_true(($dry['tables']['fichas']['already_set'] ?? 0) === 1, 'dry already_set');
assert_true(($dry['tables']['fichas']['unmatched'] ?? 0) === 1, 'dry fichas unmatched');
assert_true(($dry['tables']['lista_espera']['matched'] ?? 0) === 1, 'dry lista matched');
assert_true(($dry['tables']['lista_espera']['ambiguous'] ?? 0) === 0, 'dry lista no ambiguous en este fixture');
assert_true(($dry['tables']['interaccion_eventos']['matched'] ?? 0) === 2, 'dry WA matched 2 eventos');
$pidBefore = $pdo->query('SELECT paciente_id FROM fichas WHERE id = \'f1\'')->fetchColumn();
assert_true($pidBefore === null || $pidBefore === '', 'dry no escribió f1');

// Apply
$apply = kinesica_rel_backfill_run($pdo, true);
assert_true(($apply['tables']['fichas']['updated'] ?? 0) === 1, 'apply fichas updated=1');
assert_true((int) $pdo->query('SELECT paciente_id FROM fichas WHERE id = \'f1\'')->fetchColumn() === 1, 'f1 linkeada');
assert_true($pdo->query('SELECT paciente_id FROM fichas WHERE id = \'f2\'')->fetchColumn() === null, 'f2 sigue null');
assert_true((int) $pdo->query('SELECT paciente_id FROM lista_espera WHERE id = 1')->fetchColumn() === 1, 'lista 1 linkeada');
assert_true((int) $pdo->query('SELECT COUNT(*) FROM interaccion_eventos WHERE paciente_id = 1')->fetchColumn() === 2, 'WA backfill');
assert_true((int) $pdo->query('SELECT paciente_id FROM recordatorio_eventos WHERE id = 1')->fetchColumn() === 1, 'recordatorio linkeado');

// Idempotente
$again = kinesica_rel_backfill_run($pdo, true);
assert_true(($again['tables']['fichas']['already_set'] ?? 0) >= 2, 'segunda pasada already_set');
assert_true(($again['tables']['fichas']['updated'] ?? 0) === 0, 'segunda pasada sin updates fichas');

// Shared phone ambiguous on lista
$pdo->exec("INSERT INTO lista_espera (paciente_telefono, paciente_nombre, paciente_id) VALUES
    ('5491188887777', 'Quién?', NULL)");
$amb = kinesica_rel_backfill_lista_espera($pdo, true);
assert_true(($amb['ambiguous'] ?? 0) >= 1, 'lista teléfono compartido → ambiguous');

echo "verify-relational-backfill: OK\n";
