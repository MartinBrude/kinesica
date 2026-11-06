<?php
declare(strict_types=1);

/**
 * Tests SQLite — enrich lecturas con REL_READ_IDS + fallback legacy.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-read.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_relational_read.php';

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
        nombre TEXT NOT NULL DEFAULT \'\',
        apellido TEXT NOT NULL DEFAULT \'\',
        nombre_completo TEXT NOT NULL,
        dni TEXT,
        email TEXT
    )'
);
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, dni, email) VALUES
    ('5491161234567', 'Ana', 'Gómez', 'Ana Gómez', '30111222', 'ana@example.com')");

$pdo->exec(
    'CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO fichas (id, payload, paciente_id) VALUES
    ('f1', '{\"nombre\":\"Nombre Viejo\",\"dni\":\"000\"}', 1),
    ('f2', '{\"nombre\":\"Sin Link\",\"dni\":\"999\"}', NULL)");

$pdo->exec(
    'CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT,
        paciente_nombre TEXT,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec("INSERT INTO lista_espera (paciente_telefono, paciente_nombre, paciente_id) VALUES
    ('111', 'Nombre Lista Viejo', 1),
    ('222', 'Sin ID', NULL)");

// Flag off: no enrich
putenv('KINESICA_REL_READ_IDS');
kinesica_rel_flags_reset_cache();
$fichaRows = $pdo->query('SELECT payload, paciente_id FROM fichas')->fetchAll(PDO::FETCH_ASSOC);
$mapped = kinesica_rel_map_ficha_rows($pdo, $fichaRows);
$f1 = null;
foreach ($mapped as $item) {
    if (($item['dni'] ?? '') === '000' || ($item['nombre'] ?? '') === 'Nombre Viejo' || ($item['nombre'] ?? '') === 'Ana Gómez') {
        if (isset($item['paciente_id']) || ($item['nombre'] ?? '') === 'Nombre Viejo' || ($item['nombre'] ?? '') === 'Ana Gómez') {
            // find f1 by old or new
        }
    }
}
$byOld = array_values(array_filter($mapped, static fn ($i) => ($i['nombre'] ?? '') === 'Nombre Viejo'));
assert_true(count($byOld) === 1, 'flag off conserva nombre del payload');

putenv('KINESICA_REL_READ_IDS=1');
kinesica_rel_flags_reset_cache();

$mapped = kinesica_rel_map_ficha_rows($pdo, $fichaRows);
$linked = array_values(array_filter($mapped, static fn ($i) => (int) ($i['paciente_id'] ?? 0) === 1));
assert_true(count($linked) === 1, 'flag on enriquece ficha linkeada');
assert_true(($linked[0]['nombre'] ?? '') === 'Ana Gómez', 'ficha usa nombre canónico');
assert_true(($linked[0]['dni'] ?? '') === '30111222', 'ficha usa dni canónico');

$unlinked = array_values(array_filter($mapped, static fn ($i) => ($i['nombre'] ?? '') === 'Sin Link'));
assert_true(count($unlinked) === 1, 'ficha sin id sigue legacy');

$lista = $pdo->query('SELECT * FROM lista_espera')->fetchAll(PDO::FETCH_ASSOC);
$listaMapped = kinesica_rel_map_lista_rows($pdo, $lista);
assert_true(($listaMapped[0]['paciente_nombre'] ?? '') === 'Ana Gómez', 'lista usa nombre canónico');
assert_true(($listaMapped[0]['paciente_telefono'] ?? '') === '5491161234567', 'lista usa teléfono canónico');
assert_true(($listaMapped[1]['paciente_nombre'] ?? '') === 'Sin ID', 'lista sin id legacy');

$disp = kinesica_rel_display_from_paciente(kinesica_rel_fetch_paciente($pdo, 1));
assert_true($disp['name'] === 'Ana Gómez' && $disp['email'] === 'ana@example.com', 'display_from_paciente');

$log = kinesica_rel_read_fallback_log_path();
assert_true(is_file($log), 'log de fallback de lectura creado');

putenv('KINESICA_REL_READ_IDS');
kinesica_rel_flags_reset_cache();

echo "verify-relational-read: OK\n";
