<?php
declare(strict_types=1);

/**
 * Tests SQLite — resolve paciente_id (tel/DNI/nombre, ambiguos, unlinked metric).
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-resolve.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_relational_resolve.php';
require_once $root . '/admin/api/lib_migrations.php';

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

// Flag off
putenv('KINESICA_REL_WRITE_IDS');
kinesica_rel_flags_reset_cache();
$r = kinesica_rel_resolve_paciente($pdo, ['phone' => '5491161234567']);
assert_true($r['status'] === 'disabled' && $r['paciente_id'] === null, 'flag off → disabled');

putenv('KINESICA_REL_WRITE_IDS=1');
kinesica_rel_flags_reset_cache();

$r = kinesica_rel_resolve_paciente($pdo, ['phone' => '11 6123-4567']);
assert_true($r['status'] === 'matched' && $r['paciente_id'] === 1 && $r['reason'] === 'telefono', 'match por teléfono');

$r = kinesica_rel_resolve_paciente($pdo, ['dni' => '30.111.222']);
assert_true($r['status'] === 'matched' && $r['paciente_id'] === 1 && $r['reason'] === 'dni', 'match por DNI');

$r = kinesica_rel_resolve_paciente($pdo, ['phone' => '5491188887777']);
assert_true($r['status'] === 'ambiguous' && $r['paciente_id'] === null, 'teléfono compartido → ambiguous');

$r = kinesica_rel_resolve_paciente($pdo, ['wa_id' => '5491199990000', 'nombre' => 'Nadie']);
assert_true($r['status'] === 'unmatched', 'sin coincidencia');

// Nombre único + DNI hint: no vincular si el DNI del paciente es otro
$pdo->exec("INSERT INTO pacientes (telefono, nombre_completo, dni) VALUES ('5491100000001', 'Nombre Unico Test', '40111222')");
$r = kinesica_rel_resolve_paciente($pdo, [
    'nombre' => 'Nombre Unico Test',
    'dni' => '99999888',
]);
assert_true($r['status'] === 'unmatched' && $r['paciente_id'] === null, 'nombre+dni distinto → unmatched');

$r = kinesica_rel_resolve_paciente($pdo, [
    'nombre' => 'Ana Gómez',
    'dni' => '30111222',
]);
// Ana ya matchea por DNI en paso 2
assert_true($r['status'] === 'matched' && $r['paciente_id'] === 1, 'nombre+dni coherente vía dni');

// ID parse: strings no numéricos no se castean a basura
assert_true(kinesica_rel_parse_positive_id('12abc') === 0, 'parse id rechaza 12abc');
assert_true(kinesica_rel_parse_positive_id('42') === 42, 'parse id acepta string dígitos');
assert_true(kinesica_rel_parse_positive_id(true) === 0, 'parse id rechaza bool');

// Lista espera write path simulation
$pdo->exec(
    'CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT,
        paciente_nombre TEXT,
        profesional TEXT,
        estado TEXT,
        paciente_id INTEGER NULL,
        profesional_id INTEGER NULL
    )'
);
$pid = kinesica_rel_resolve_paciente_id_or_note($pdo, 'lista_espera_test', [
    'phone' => '5491161234567',
    'nombre' => 'Ana Gómez',
]);
assert_true($pid === 1, 'resolve_or_note matched');

$log = kinesica_rel_unlinked_log_path();
$before = is_file($log) ? filesize($log) : 0;
$pid2 = kinesica_rel_resolve_paciente_id_or_note($pdo, 'lista_espera_test', [
    'phone' => '5491100009999',
    'nombre' => 'Fantasma',
]);
assert_true($pid2 === null, 'unmatched → null');
clearstatcache();
assert_true(is_file($log) && filesize($log) > $before, 'métrica unlinked escrita');

// Interacciones insert with paciente_id
require_once $root . '/admin/api/lib_interacciones_store.php';
$pdo->exec(
    'CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        wa_id TEXT NOT NULL,
        paciente_id INTEGER NULL,
        direction TEXT NOT NULL,
        body TEXT NOT NULL,
        ts_utc TEXT NOT NULL,
        patient_name TEXT NOT NULL DEFAULT \'\',
        source TEXT NOT NULL DEFAULT \'\',
        exec_id TEXT NULL,
        media_id TEXT NULL,
        media_type TEXT NULL,
        media_mime TEXT NULL,
        media_filename TEXT NULL,
        received_at TEXT NOT NULL
    )'
);
$ev = [
    'event_key' => 'test-ek-1',
    'wa_id' => '5491161234567',
    'direction' => 'patient',
    'body' => 'hola',
    'ts' => time(),
    'patient_name' => 'Ana Gómez',
    'source' => 'test',
    'exec_id' => null,
    'media_id' => null,
    'media_type' => null,
    'media_mime' => null,
    'media_filename' => null,
];
$out = interacciones_insert_event($pdo, $ev);
assert_true($out === 'stored', 'interaccion stored');
$row = $pdo->query('SELECT paciente_id FROM interaccion_eventos WHERE event_key = \'test-ek-1\'')->fetch(PDO::FETCH_ASSOC);
assert_true((int) ($row['paciente_id'] ?? 0) === 1, 'interaccion escribió paciente_id');

putenv('KINESICA_REL_WRITE_IDS');
kinesica_rel_flags_reset_cache();

echo "verify-relational-resolve: OK\n";
