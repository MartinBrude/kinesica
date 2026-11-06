<?php
declare(strict_types=1);

/**
 * Tests SQLite — lib_relational_audit (clasificaciones, máscaras PII; sin DB prod).
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-audit.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_relational_audit.php';

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

// Sin UNIQUE en telefono: en prod hay UNIQUE, pero la auditoría agrupa por normalización
// y debe detectar compartidos aunque el UNIQUE de prod ya lo impida en inserts nuevos.
$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL,
        nombre TEXT NOT NULL DEFAULT \'\',
        apellido TEXT NOT NULL DEFAULT \'\',
        nombre_completo TEXT NOT NULL,
        nombre_pila TEXT NOT NULL DEFAULT \'\',
        dni TEXT,
        email TEXT,
        profesional_habitual TEXT DEFAULT \'indistinto\'
    )'
);
$pdo->exec(
    'CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        profesional TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        paciente_id INTEGER NULL
    )'
);
$pdo->exec(
    'CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT NOT NULL,
        paciente_nombre TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT \'activa\',
        profesional TEXT DEFAULT \'indistinto\'
    )'
);
$pdo->exec(
    'CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL,
        wa_id TEXT NOT NULL,
        patient_name TEXT NOT NULL DEFAULT \'\',
        direction TEXT NOT NULL DEFAULT \'patient\',
        body TEXT NOT NULL DEFAULT \'\',
        ts_utc TEXT NOT NULL DEFAULT \'\',
        received_at TEXT NOT NULL DEFAULT \'\'
    )'
);
$pdo->exec(
    'CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL,
        wa_id TEXT NOT NULL DEFAULT \'\',
        patient_name TEXT NOT NULL DEFAULT \'\',
        calendar_event_id TEXT NOT NULL DEFAULT \'\',
        status TEXT NOT NULL DEFAULT \'sent\',
        run_at TEXT NOT NULL DEFAULT \'\',
        received_at TEXT NOT NULL DEFAULT \'\'
    )'
);

// 1–2: mismo teléfono normalizable + mismo nombre → candidato fusión
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, dni, email) VALUES
    ('11 6123-4567', 'Ana', 'Gómez', 'Ana Gómez', '30111222', 'ana@example.com'),
    ('5491161234567', 'Ana', 'Gomez', 'Gómez, Ana', NULL, NULL)");

// Teléfono compartido (misma normalización, nombres distintos)
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, dni) VALUES
    ('5491188887777', 'Luis', 'Pérez', 'Luis Pérez', '20111111'),
    ('+54 9 11 8888-7777', 'Carla', 'Ruiz', 'Carla Ruiz', '20999888')");

// DNI duplicado
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, dni) VALUES
    ('sin-tel-dni-a', 'Juan', 'Duplicado', 'Juan Duplicado', '55.555.555'),
    ('sin-tel-dni-b', 'Juan Carlos', 'Duplicado', 'Juan Carlos Duplicado', '55555555')");

// Sin identificador confiable
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, dni, email) VALUES
    ('sin-tel-x', '', '', '', NULL, NULL)");

// Ficha con DNI de Ana (match), ficha huérfana, JSON inválido
$pdo->exec("INSERT INTO fichas (id, payload, profesional, updated_at, updated_by) VALUES
    ('f1', '{\"nombre\":\"Ana Gómez\",\"dni\":\"30111222\",\"fecha\":\"2026-01-10\"}', 'norberto', '2026-01-10', 'norberto'),
    ('f2', '{\"nombre\":\"Desconocido\",\"dni\":\"99999999\",\"fecha\":\"2026-01-11\"}', 'ghost', '2026-01-11', 'ghost'),
    ('f3', 'not-json', 'norberto', '2026-01-12', 'norberto')");

// Lista: teléfono sin paciente + estado raro + activo duplicado
$pdo->exec("INSERT INTO lista_espera (paciente_telefono, paciente_nombre, estado) VALUES
    ('5491161234567', 'Ana Gómez', 'activa'),
    ('5491161234567', 'Ana Gómez', 'activa'),
    ('5491100000000', 'Nadie', 'activa'),
    ('5491161234567', 'Otra Persona', 'weird')");

// WA sin paciente + multi nombre + event_key dup
$pdo->exec("INSERT INTO interaccion_eventos (event_key, wa_id, patient_name) VALUES
    ('ek1', '5491177776666', 'Uno'),
    ('ek1', '5491177776666', 'Dos'),
    ('ek2', '5491161234567', 'Ana')");

$pdo->exec("INSERT INTO recordatorio_eventos (event_key, wa_id, patient_name, calendar_event_id, status) VALUES
    ('rk1', '', 'Solo Nombre', 'cal-1', 'sent'),
    ('rk2', '5491161234567', 'Ana', 'cal-1', 'sent'),
    ('rk2', '5491161234567', 'Ana', 'cal-2', 'sent')");

$report = kinesica_audit_run($pdo, false);

assert_true(($report['pacientes']['total'] ?? 0) >= 7, 'pacientes cargados');
assert_true(($report['pacientes']['counts']['duplicate_phones_same_name'] ?? 0) >= 1, 'detecta dup teléfono mismo nombre');
assert_true(($report['pacientes']['counts']['shared_phones_different_names'] ?? 0) >= 1, 'detecta teléfono compartido');
assert_true(($report['pacientes']['counts']['duplicate_dni'] ?? 0) >= 1, 'detecta DNI duplicado');
assert_true(($report['pacientes']['counts']['no_reliable_identifier'] ?? 0) >= 1, 'detecta sin identificador');
assert_true(($report['fichas']['counts']['invalid_json'] ?? 0) >= 1, 'detecta JSON inválido');
assert_true(($report['fichas']['counts']['without_patient_match'] ?? 0) >= 1, 'detecta ficha sin paciente');
assert_true(($report['lista_espera']['counts']['active_duplicates_by_phone'] ?? 0) >= 1, 'detecta lista activa duplicada');
assert_true(($report['lista_espera']['counts']['without_patient'] ?? 0) >= 1, 'detecta lista sin paciente');
assert_true(($report['lista_espera']['counts']['invalid_estado'] ?? 0) >= 1, 'detecta estado inválido');
assert_true(($report['whatsapp_recordatorios']['interacciones']['counts']['wa_without_patient'] ?? 0) >= 1, 'WA sin paciente');
assert_true(($report['whatsapp_recordatorios']['interacciones']['counts']['wa_multiple_names'] ?? 0) >= 1, 'WA multi nombre');
assert_true(($report['whatsapp_recordatorios']['interacciones']['counts']['duplicate_event_keys'] ?? 0) >= 1, 'event_key dup interacciones');
assert_true(($report['whatsapp_recordatorios']['recordatorios']['counts']['duplicate_calendar_event_id'] ?? 0) >= 1, 'calendar_event_id dup');
assert_true(($report['summary']['manual_review_count'] ?? 0) >= 1, 'hay ítems de revisión manual');
assert_true(($report['full_pii'] ?? true) === false, 'PII enmascarado por defecto');

$masked = json_encode($report['pacientes']['duplicate_phones_same_name'] ?? []);
assert_true($masked !== false && !str_contains($masked, '5491161234567'), 'teléfono no aparece completo en informe');

$md = kinesica_audit_summary_markdown($report);
assert_true(str_contains($md, 'Informe auditoría'), 'markdown generado');

echo "verify-relational-audit: OK\n";
