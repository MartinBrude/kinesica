<?php
declare(strict_types=1);

/**
 * Tests SQLite — tabla turnos sombra, upsert UNIQUE, backfill turno_id.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-turnos.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_turnos.php';
require_once $root . '/admin/api/lib_relational_backfill.php';

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

// Sin tabla: upsert no rompe
assert_true(kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => 'evt-1',
]) === null, 'sin tabla → null');
$syncEmpty = kinesica_rel_sync_turnos_from_campana_rows($pdo, [['calendar_event_id' => 'x']]);
assert_true($syncEmpty['attempted'] === 0 && $syncEmpty['upserted'] === 0, 'sync sin tabla no intenta');

$mig = require $root . '/admin/api/migrations/006_turnos.php';
($mig['up'])($pdo);
assert_true(kinesica_rel_turnos_ready($pdo), 'tabla turnos lista');

$id1 = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => 'cal-abc',
    'paciente_id' => 10,
    'starts_at' => '2026-11-10',
    'summary' => 'Primera',
    'patient_name_snapshot' => 'Ana Test',
    'source' => 'gas',
]);
assert_true($id1 !== null && $id1 > 0, 'insert turno');

$id2 = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => 'cal-abc',
    'paciente_id' => null, // no debe pisar 10
    'summary' => 'Actualizada',
    'source' => 'recordatorio',
]);
assert_true($id2 === $id1, 'upsert idempotente mismo id');
$row = $pdo->query("SELECT paciente_id, summary, source FROM turnos WHERE id = {$id1}")->fetch(PDO::FETCH_ASSOC);
assert_true((int) $row['paciente_id'] === 10, 'no pisa paciente_id con NULL');
assert_true((string) $row['summary'] === 'Actualizada', 'actualiza summary');
assert_true((string) $row['source'] === 'recordatorio', 'actualiza source');

// Merge en carrera: simular "ya existe" con datos nuevos (path de reintento post-UNIQUE).
$idRace = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => 'cal-abc',
    'paciente_id' => 77,
    'summary' => 'Tras carrera',
    'source' => 'booking',
]);
assert_true($idRace === $id1, 'carrera/reintento mismo id');
$rowRace = $pdo->query("SELECT paciente_id, summary FROM turnos WHERE id = {$id1}")->fetch(PDO::FETCH_ASSOC);
assert_true((int) $rowRace['paciente_id'] === 77, 'carrera mergea paciente_id nuevo');
assert_true((string) $rowRace['summary'] === 'Tras carrera', 'carrera mergea summary');

assert_true(kinesica_rel_normalize_calendar_event_id('') === '', 'vacío rechazado');
assert_true(kinesica_rel_normalize_calendar_event_id('_run') === '', '_run rechazado');
assert_true(kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => '_run',
]) === null, 'skip _run');

// UNIQUE: segundo calendar distinto
$id3 = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
    'calendar_event_id' => 'cal-xyz',
    'paciente_id' => 20,
    'source' => 'manual',
]);
assert_true($id3 !== null && $id3 !== $id1, 'segundo evento distinto');

$count = (int) $pdo->query('SELECT COUNT(*) FROM turnos')->fetchColumn();
assert_true($count === 2, 'dos turnos UNIQUE');

// Schema recordatorios + backfill
$pdo->exec(
    'CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        calendar_event_id TEXT NOT NULL DEFAULT \'\',
        patient_name TEXT NOT NULL DEFAULT \'\',
        appointment_date TEXT NULL,
        appointment_time TEXT NOT NULL DEFAULT \'\',
        event_summary TEXT NOT NULL DEFAULT \'\',
        wa_id TEXT NOT NULL DEFAULT \'\',
        status TEXT NOT NULL,
        skip_reason TEXT NOT NULL DEFAULT \'\',
        run_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        paciente_id INTEGER NULL,
        turno_id INTEGER NULL
    )'
);
$pdo->exec(
    "INSERT INTO recordatorio_eventos
     (event_key, calendar_event_id, patient_name, appointment_date, appointment_time, status, run_at, received_at, paciente_id)
     VALUES
     ('rem:1:cal-new:sent', 'cal-new', 'Pedro', '2026-12-01', '10:30', 'sent', '2026-11-01 00:00:00', '2026-11-01 00:00:00', 30),
     ('rem:1:cal-abc:sent', 'cal-abc', 'Ana', '2026-11-10', '11:00', 'sent', '2026-11-01 00:00:00', '2026-11-01 00:00:00', 10),
     ('rem:2:cal-new:pending', 'cal-new', 'Pedro', '2026-12-01', '10:30', 'pending', '2026-11-02 00:00:00', '2026-11-02 00:00:00', 30)"
);

$bfTurnos = kinesica_rel_backfill_turnos_from_recordatorios($pdo, true);
assert_true(($bfTurnos['matched'] ?? 0) >= 1, 'backfill turnos matched cal-new');
assert_true(($bfTurnos['already_set'] ?? 0) >= 1, 'cal-abc already_set');
$newTurno = (int) $pdo->query("SELECT id FROM turnos WHERE calendar_event_id = 'cal-new'")->fetchColumn();
assert_true($newTurno > 0, 'turno cal-new creado');

$bfLink = kinesica_rel_backfill_recordatorios_turno_id($pdo, true);
assert_true(($bfLink['matched'] ?? 0) >= 2, 'link turno_id matched');
$linked = (int) $pdo->query(
    "SELECT COUNT(*) FROM recordatorio_eventos WHERE turno_id IS NOT NULL"
)->fetchColumn();
assert_true($linked >= 2, 'recordatorios con turno_id');

$bf2 = kinesica_rel_backfill_recordatorios_turno_id($pdo, true);
assert_true(($bf2['updated'] ?? 0) === 0, 'segunda pasada turno_id idempotente');

// Migrate runner incluye 006
$pdo2 = new PDO('sqlite::memory:');
$pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo2->exec(
    'CREATE TABLE pacientes (id INTEGER PRIMARY KEY, telefono TEXT, nombre_completo TEXT);
     CREATE TABLE fichas (id TEXT PRIMARY KEY, payload TEXT, profesional TEXT, updated_at TEXT, updated_by TEXT);
     CREATE TABLE lista_espera (id INTEGER PRIMARY KEY, paciente_telefono TEXT, paciente_nombre TEXT, profesional TEXT);
     CREATE TABLE interaccion_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, direction TEXT, body TEXT, ts_utc TEXT, received_at TEXT);
     CREATE TABLE recordatorio_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, status TEXT, run_at TEXT, received_at TEXT);'
);
$run = kinesica_migrations_run($pdo2, false);
assert_true(count($run['applied']) >= 6, 'migrate aplica >=6 incl. turnos');
assert_true(kinesica_migrations_table_exists($pdo2, 'turnos'), 'turnos tras migrate');

// Campana sync
$sync = kinesica_rel_sync_turnos_from_campana_rows($pdo, [
    [
        'calendar_event_id' => 'gas-1',
        'paciente_id' => 99,
        'fecha' => '2026-11-15',
        'patient_name_raw' => 'Gas Paciente',
        'nombre' => 'Gas',
        'apellido' => 'Paciente',
    ],
    ['calendar_event_id' => ''], // skip
]);
assert_true($sync['upserted'] === 1 && $sync['skipped'] === 1, 'campana sync 1 upsert 1 skip');

// Booking register + cancel → recordatorios
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY,
        telefono TEXT,
        nombre TEXT DEFAULT \'\',
        apellido TEXT DEFAULT \'\',
        nombre_completo TEXT DEFAULT \'\',
        dni TEXT
    )'
);
$pdo->exec(
    "INSERT INTO pacientes (id, telefono, nombre_completo) VALUES (55, '5491112345678', 'Booking Test')"
);
try {
    $mig5 = require $root . '/admin/api/migrations/005_profesionales.php';
    ($mig5['up'])($pdo);
} catch (Throwable) {
}
$bookId = kinesica_rel_register_turno_from_booking($pdo, [
    'eventId' => 'book-evt-1',
    'date' => '2026-11-20',
    'time' => '15:00',
    'nombre' => 'Booking Test',
    'telefono' => '5491112345678',
    'practitionerId' => 'norberto',
    'source' => 'booking',
]);
assert_true($bookId !== null && $bookId > 0, 'register_from_booking');
$pdo->exec(
    "INSERT INTO recordatorio_eventos
     (event_key, calendar_event_id, patient_name, status, run_at, received_at, turno_id)
     VALUES
     ('rem:x:book-evt-1:pending', 'book-evt-1', 'Booking Test', 'pending', '2026-11-19 00:00:00', '2026-11-19 00:00:00', NULL),
     ('rem:x:book-evt-1:sent', 'book-evt-1', 'Booking Test', 'sent', '2026-11-19 00:00:00', '2026-11-19 00:00:00', NULL)"
);

$cancel = kinesica_rel_cancel_turno($pdo, ['calendar_event_id' => 'book-evt-1']);
assert_true(!empty($cancel['ok']), 'cancel ok');
assert_true((string) $pdo->query("SELECT status FROM turnos WHERE calendar_event_id = 'book-evt-1'")->fetchColumn() === 'cancelled', 'turno cancelled');
$pendingLeft = (int) $pdo->query(
    "SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'book-evt-1' AND status = 'pending'"
)->fetchColumn();
assert_true($pendingLeft === 0, 'pending recordatorios anulados');
$sentKept = (int) $pdo->query(
    "SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'book-evt-1' AND status = 'sent'"
)->fetchColumn();
assert_true($sentKept === 1, 'sent no se toca');
$skipped = (int) $pdo->query(
    "SELECT COUNT(*) FROM recordatorio_eventos
     WHERE calendar_event_id = 'book-evt-1' AND status = 'skipped' AND skip_reason = 'cancelled'"
)->fetchColumn();
assert_true($skipped === 1, 'pending → skipped/cancelled');

echo "verify-relational-turnos: OK\n";
