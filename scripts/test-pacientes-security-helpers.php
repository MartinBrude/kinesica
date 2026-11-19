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

// Soft-deleted: fetch/require alive
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, deleted_at) VALUES
 (40, '5491444000001', 'Soft', 'Del', 'Soft Del', datetime('now'))");
assert_true(kinesica_pacientes_fetch_alive($pdo, 40) === null, 'fetch_alive ignora soft-deleted');
assert_true(is_array(kinesica_pacientes_fetch_alive($pdo, 20)), 'fetch_alive ve activo');

// --- Matriz de caracterización (match) ---
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, email, deleted_at) VALUES
 (50, '5491150000001', 'Diego', 'Ruiz', 'Diego Ruiz', '30111222', 'diego@example.com', NULL),
 (51, 'sin-tel-dni-40999888', 'Lara', 'Dni', 'Lara Dni', '40999888', NULL, NULL),
 (52, '5491150000099', 'Solo', '', 'Solo', NULL, NULL, NULL),
 (53, '5491188800011', 'Pia', 'Suffix', 'Pia Suffix', NULL, 'pia@example.com', NULL),
 (54, '5491288800011', 'Otra', 'Suffix', 'Otra Suffix', NULL, 'otra@example.com', NULL),
 (55, '5491188800099', 'Unica', 'Suf', 'Unica Suf', NULL, 'unica@example.com', NULL),
 (56, 'sin-tel-cal-abc', 'Cal', 'Place', 'Cal Place', NULL, NULL, NULL),
 (57, '5491444000099', 'Soft', 'Match', 'Soft Match', NULL, NULL, datetime('now'))");

$byTel = find_existing_patient_match($pdo, '5491150000001', 'Otro Nombre', null);
assert_true(is_array($byTel) && (int) $byTel['id'] === 50, 'strict: tel exacto');

$byDni = find_existing_patient_match($pdo, null, null, '30111222');
assert_true(is_array($byDni) && (int) $byDni['id'] === 50, 'strict: DNI columna');

$byDniPh = find_existing_patient_match($pdo, null, null, '40999888');
assert_true(is_array($byDniPh) && (int) $byDniPh['id'] === 51, 'strict: DNI via sin-tel-dni-*');

$byName2 = find_existing_patient_match($pdo, null, 'Diego Ruiz', null);
assert_true(is_array($byName2) && (int) $byName2['id'] === 50, 'strict: nombre ≥2 tokens');

$byName1 = find_existing_patient_match($pdo, null, 'Solo', null);
assert_true($byName1 === null, 'strict: nombre 1 token → null');

$campName1 = campana_match_paciente($pdo, '', 'Solo');
assert_true(is_array($campName1) && (int) $campName1['id'] === 52, 'campaña: nombre 1 token puede matchear');

$softMatch = find_existing_patient_match($pdo, '5491444000099', 'Soft Match', null);
assert_true($softMatch === null, 'strict: soft-deleted no matchea por tel');

$softCamp = campana_match_paciente($pdo, '5491444000099', 'Soft Match');
assert_true($softCamp === null, 'campaña: soft-deleted no matchea');

$phMatch = find_existing_patient_match($pdo, 'sin-tel-cal-abc', 'Cal Place', null);
assert_true(is_array($phMatch) && (int) $phMatch['id'] === 56, 'strict: placeholder no usa rama tel; nombre sí');

// Mismo sufijo 88800011, query con otro prefijo (no exact match ni tras re-clean).
$campSuffixAmb = campana_match_paciente($pdo, '5499988800011', 'Desconocido');
assert_true($campSuffixAmb === null, 'campaña: suffix-8 ambiguo → null');

$campSuffixOk = campana_match_paciente($pdo, '5499988800099', 'Desconocido');
assert_true(is_array($campSuffixOk) && (int) $campSuffixOk['id'] === 55, 'campaña: suffix-8 único');

$emailAmb = kinesica_pacientes_email_by_phone($pdo, '5499988800011');
assert_true($emailAmb['status'] === 'not_found', 'email: suffix ambiguo');

$emailSuf = kinesica_pacientes_email_by_phone($pdo, '5499988800099');
assert_true($emailSuf['status'] === 'success' && $emailSuf['email'] === 'unica@example.com', 'email: suffix único');

$cleaned = campana_clean_name_string('Juan Perez 5491150000001 turno');
assert_true($cleaned === 'Juan Perez', 'campana_clean_name_string quita dígitos y ruido');
$campClean = campana_match_paciente($pdo, '', 'Diego Ruiz 5491150000001 turno');
assert_true(is_array($campClean) && (int) $campClean['id'] === 50, 'campaña: match con título sucio vía clean');

if (function_exists('kinesica_match_patient')) {
    $polStrict = kinesica_match_patient($pdo, ['phone' => null, 'name' => 'Solo', 'dni' => null], 'strict');
    assert_true($polStrict === null, 'policy strict: 1 token null');
    $polCamp = kinesica_match_patient($pdo, ['phone' => null, 'name' => 'Solo', 'dni' => null], 'campana');
    assert_true(is_array($polCamp) && (int) $polCamp['id'] === 52, 'policy campana: 1 token hit');
}

require_once $root . '/admin/api/lib_whatsapp.php';
$safe = kinesica_whatsapp_client_safe_result([
    'ok' => false,
    'http_code' => 400,
    'error' => 'bad',
    'via' => 'graph',
    'response' => ['error' => ['message' => 'secret recipient']],
]);
assert_true($safe['ok'] === false && $safe['error'] === 'bad', 'wa safe conserva error');
assert_true(!array_key_exists('response', $safe), 'wa safe no expone response Meta');

echo "\n--- test-pacientes-security-helpers OK ---\n";
