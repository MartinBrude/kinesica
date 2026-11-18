<?php
declare(strict_types=1);

/**
 * Tests: email_by_phone seguro + alive update_name resolution helpers.
 * Run: php scripts/test-pacientes-security-helpers.php
 */

$root = dirname(__DIR__);
define('KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER', true);
require_once $root . '/admin/api/lib.php';
require_once $root . '/admin/api/pacientes_helpers.php';
require_once $root . '/admin/api/pacientes_helpers_email_by_phone.php';
require_once $root . '/admin/api/campana_turnos_campana_default_date_range.php';
require_once $root . '/admin/api/campana_turnos_campana_match_paciente.php';

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
$pdo->exec('
    CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY,
        telefono TEXT NOT NULL UNIQUE,
        nombre TEXT DEFAULT "",
        apellido TEXT DEFAULT "",
        nombre_completo TEXT DEFAULT "",
        nombre_pila TEXT DEFAULT "",
        email TEXT,
        dni TEXT,
        viene_de_campana INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT NULL
    )
');

$pdo->exec("INSERT INTO pacientes (id, telefono, email) VALUES
 (1, '5491161111111', 'a@example.com'),
 (2, '5491162222222', 'b@example.com'),
 (3, '5491261111111', 'c@example.com')");

$exact = kinesica_pacientes_email_by_phone($pdo, '5491161111111');
assert_true($exact['status'] === 'success' && $exact['email'] === 'a@example.com', 'email exacto');

// Sufijo 61111111 coincide con id 1 y 3 → no adivinar.
$ambiguous = kinesica_pacientes_email_by_phone($pdo, '000061111111');
assert_true($ambiguous['status'] === 'not_found', 'sufijo ambiguo no elige al azar');

$uniqueSuffix = kinesica_pacientes_email_by_phone($pdo, '000062222222');
assert_true($uniqueSuffix['status'] === 'success' && $uniqueSuffix['email'] === 'b@example.com', 'sufijo único OK');

$pdo->exec("UPDATE pacientes SET deleted_at = datetime('now') WHERE id = 2");
$soft = kinesica_pacientes_email_by_phone($pdo, '5491162222222');
assert_true($soft['status'] === 'not_found', 'email ignora soft-deleted');

// Homónimos: no match por nombre si WhatsApp reales distintos; no pisar teléfono.
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, email, deleted_at) VALUES
 (10, '5491177770001', 'Juan', 'Perez', 'Juan Perez', 'jp1@example.com', NULL),
 (11, '5491177770002', 'Juan', 'Perez', 'Juan Perez', 'jp2@example.com', NULL)");

$noMatch = find_existing_patient_match($pdo, '5491177770002', 'Juan Perez', null);
assert_true(
    is_array($noMatch) && (int) $noMatch['id'] === 11,
    'match por teléfono exacto gana sobre homónimo'
);

$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, email, deleted_at) VALUES
 (12, '5491188880001', 'Maria', 'Lopez', 'Maria Lopez', 'ml@example.com', NULL)");
$nameOnly = find_existing_patient_match($pdo, '5491188889999', 'Maria Lopez', null);
assert_true($nameOnly === null, 'nombre + WhatsApp distinto no matchea homónimo');

$kept = kinesica_resolve_merge_phone(
    $pdo,
    ['id' => 12, 'telefono' => '5491188880001'],
    '5491188889999'
);
assert_true($kept === '5491188880001', 'resolve_merge_phone no pisa WhatsApp real');

$fromPlaceholder = kinesica_resolve_merge_phone(
    $pdo,
    ['id' => 99, 'telefono' => 'sin-tel-f-99'],
    '5491188880001'
);
assert_true($fromPlaceholder === '5491188880001', 'resolve_merge_phone adopta WA sobre placeholder');

// Campaña: fallback por nombre no pisa homónimos con WA distintos.
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, viene_de_campana, deleted_at) VALUES
 (20, '5491190010001', 'Ana', 'Garcia', 'Ana Garcia', 1, NULL),
 (21, '5491190010002', 'Ana', 'Garcia', 'Ana Garcia', 0, NULL)");
$campHit = campana_match_paciente($pdo, '5491190010002', 'Ana Garcia');
assert_true(is_array($campHit) && (int) $campHit['id'] === 21, 'campaña match por tel exacto');
$campHomonym = campana_match_paciente($pdo, '5491190019999', 'Ana Garcia');
assert_true($campHomonym === null, 'campaña no matchea homónimo solo por nombre');
$campNoPhone = campana_match_paciente($pdo, '', 'Ana Garcia');
assert_true(is_array($campNoPhone) && in_array((int) $campNoPhone['id'], [20, 21], true), 'campaña sin tel puede matchear por nombre');

echo "\n--- test-pacientes-security-helpers OK ---\n";
