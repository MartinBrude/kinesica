<?php
declare(strict_types=1);

/**
 * Tests unitarios para la unificación manual de pacientes (kinesica_pacientes_merge_explicit).
 * Run: php scripts/test-pacientes-merge.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib.php';
require_once $root . '/admin/api/pacientes_helpers.php';
require_once $root . '/admin/api/pacientes_helpers_merge_explicit.php';
require_once $root . '/admin/api/lib_relational_contactos.php';

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

// Crear tablas de pacientes y relaciones
$pdo->exec('
    CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL DEFAULT "",
        apellido TEXT NOT NULL DEFAULT "",
        nombre_completo TEXT NOT NULL DEFAULT "",
        nombre_pila TEXT NOT NULL DEFAULT "",
        dni TEXT NULL,
        email TEXT NULL,
        profesional_habitual TEXT NOT NULL DEFAULT "indistinto",
        motivo_consulta TEXT NULL,
        notas TEXT NULL,
        origen TEXT NOT NULL DEFAULT "whatsapp",
        contacto_nombre TEXT NULL,
        contacto_telefono TEXT NULL,
        contacto_email TEXT NULL,
        contacto_notas TEXT NULL,
        dejo_review INTEGER NOT NULL DEFAULT 0,
        encuesta_enviada INTEGER NOT NULL DEFAULT 0,
        viene_de_campana INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE fichas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        profesional_id INTEGER NOT NULL DEFAULT 1,
        notas TEXT
    );

    CREATE TABLE turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        profesional_id INTEGER NOT NULL DEFAULT 1,
        fecha_hora TEXT
    );

    CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        turno_id INTEGER,
        created_at TEXT
    );

    CREATE TABLE encuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        puntuacion INTEGER
    );
');

$mig001 = require $root . '/admin/api/migrations/001_paciente_contactos.php';
($mig001['up'])($pdo);

// Test 1: Validación de entradas incorrectas
$resInv1 = kinesica_pacientes_merge_explicit($pdo, 0, 5);
assert_true(!$resInv1['ok'], 'Rechaza sourceId <= 0');

$resInv2 = kinesica_pacientes_merge_explicit($pdo, 5, 5);
assert_true(!$resInv2['ok'], 'Rechaza sourceId == targetId');

$resInv3 = kinesica_pacientes_merge_explicit($pdo, 999, 998);
assert_true(!$resInv3['ok'], 'Rechaza pacientes inexistentes');

// Test 2: Unificación de paciente sin teléfono (origen) dentro de paciente con teléfono real (destino)
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, motivo_consulta, notas, dejo_review)
    VALUES (1, "sin-tel-cal-111", "Florencia", "Gonzalez", "Florencia Gonzalez", "ATM", "Nota ficha A", 0)
')->execute();

$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, email, motivo_consulta, notas, dejo_review)
    VALUES (2, "5491161234567", "Florencia", "González", "González, Florencia", "38123456", "flor@ejemplo.com", "RPG", "Nota ficha B", 1)
')->execute();

$pdo->exec('
    INSERT INTO fichas (paciente_id, notas) VALUES (1, "Ficha de evaluación");
    INSERT INTO turnos (paciente_id, fecha_hora) VALUES (1, "2026-11-20 10:00:00");
    INSERT INTO turnos (paciente_id, fecha_hora) VALUES (2, "2026-11-21 11:00:00");
    INSERT INTO recordatorio_eventos (paciente_id) VALUES (1);
    INSERT INTO encuestas (paciente_id, puntuacion) VALUES (1, 10);
');

$resMerge1 = kinesica_pacientes_merge_explicit($pdo, 1, 2);
assert_true($resMerge1['ok'] === true, 'kinesica_pacientes_merge_explicit devuelve ok');

// Verificar que paciente 1 fue eliminado
$delCheck = $pdo->query('SELECT id FROM pacientes WHERE id = 1')->fetch();
assert_true($delCheck === false, 'Paciente origen id=1 fue eliminado');

// Verificar paciente 2 enriquecido
$p2 = $pdo->query('SELECT * FROM pacientes WHERE id = 2')->fetch(PDO::FETCH_ASSOC);
assert_true($p2['telefono'] === '5491161234567', 'Paciente 2 conserva teléfono real');
assert_true($p2['dni'] === '38123456', 'Paciente 2 conserva DNI');
assert_true($p2['email'] === 'flor@ejemplo.com', 'Paciente 2 conserva email');
assert_true((int) $p2['dejo_review'] === 1, 'Paciente 2 conserva review = 1');
assert_true(str_contains($p2['motivo_consulta'], 'RPG') && str_contains($p2['motivo_consulta'], 'ATM'), 'Motivos combinados');
assert_true(str_contains($p2['notas'], 'Nota ficha A') && str_contains($p2['notas'], 'Nota ficha B'), 'Notas combinadas');

// Verificar registros hijos transferidos
$fichasP2 = (int) $pdo->query('SELECT COUNT(*) FROM fichas WHERE paciente_id = 2')->fetchColumn();
assert_true($fichasP2 === 1, 'Fichas transferidas a paciente 2');

$turnosP2 = (int) $pdo->query('SELECT COUNT(*) FROM turnos WHERE paciente_id = 2')->fetchColumn();
assert_true($turnosP2 === 2, 'Turnos de ambos consolidados en paciente 2');

$recsP2 = (int) $pdo->query('SELECT COUNT(*) FROM recordatorio_eventos WHERE paciente_id = 2')->fetchColumn();
assert_true($recsP2 === 1, 'Recordatorios transferidos a paciente 2');

$encP2 = (int) $pdo->query('SELECT COUNT(*) FROM encuestas WHERE paciente_id = 2')->fetchColumn();
assert_true($encP2 === 1, 'Encuestas transferidas a paciente 2');

// Test 3: Unificación donde el target tenía placeholder y el source tenía teléfono real
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, notas)
    VALUES (3, "sin-tel-cal-333", "Carlos", "Perez", "Carlos Perez", "Paciente antiguo sin tel")
')->execute();

$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, notas)
    VALUES (4, "5491199998888", "Carlos", "Pérez", "Pérez, Carlos", "Ingresó por WhatsApp")
')->execute();

$resMerge2 = kinesica_pacientes_merge_explicit($pdo, 4, 3);
assert_true($resMerge2['ok'] === true, 'kinesica_pacientes_merge_explicit 4 -> 3 ok');

$p3 = $pdo->query('SELECT * FROM pacientes WHERE id = 3')->fetch(PDO::FETCH_ASSOC);
assert_true($p3['telefono'] === '5491199998888', 'Target 3 adoptó el teléfono real del source 4');
assert_true($pdo->query('SELECT id FROM pacientes WHERE id = 4')->fetch() === false, 'Source 4 eliminado');

// Test 4: Ambos tienen teléfonos reales diferentes
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo)
    VALUES (5, "5491155551111", "Laura", "Gomez", "Laura Gomez")
')->execute();

$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo)
    VALUES (6, "5491155552222", "Laura", "Gómez", "Gómez, Laura")
')->execute();

$resMerge3 = kinesica_pacientes_merge_explicit($pdo, 6, 5);
assert_true($resMerge3['ok'] === true, 'Merge dos teléfonos reales ok');

$p5 = $pdo->query('SELECT * FROM pacientes WHERE id = 5')->fetch(PDO::FETCH_ASSOC);
assert_true($p5['telefono'] === '5491155551111', 'Target 5 conserva su teléfono');
assert_true(str_contains($p5['notas'], '5491155552222'), 'Teléfono previo de 6 guardado en notas de 5');

// Test 5: dedupe acotado al alta (around_patient) une y reasigna hijos
require_once $root . '/admin/api/pacientes_helpers_dedupe_schedule.php';

$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, dejo_review)
    VALUES (10, "sin-tel-f-10", "Sofia", "Rivas", "Sofia Rivas", "66112233", 0)
')->execute();
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, dejo_review)
    VALUES (11, "5491166611222", "Sofía", "Rivas", "Sofía Rivas", "66112233", 1)
')->execute();
$pdo->exec('INSERT INTO turnos (paciente_id, fecha_hora) VALUES (10, "2026-12-01 10:00:00")');
$pdo->exec('INSERT INTO turnos (paciente_id, fecha_hora) VALUES (11, "2026-12-08 11:00:00")');

$around = kinesica_pacientes_dedupe_around_patient($pdo, 10);
assert_true(($around['merged'] ?? 0) >= 1, 'around_patient une Sofía con DNI compartido');
assert_true((int) ($around['survivor_id'] ?? 0) > 0, 'around_patient devuelve survivor');
$survivor = (int) $around['survivor_id'];
$sofiaCount = (int) $pdo->query('SELECT COUNT(*) FROM pacientes WHERE id IN (10, 11)')->fetchColumn();
assert_true($sofiaCount === 1, 'Queda una sola ficha Sofía tras around_patient');
$turnosSofia = (int) $pdo->query("SELECT COUNT(*) FROM turnos WHERE paciente_id = {$survivor}")->fetchColumn();
assert_true($turnosSofia === 2, 'around_patient reasigna turnos al survivor');

// Sin candidatos: no-op
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo)
    VALUES (20, "5491100009999", "Unico", "Paciente", "Unico Paciente")
')->execute();
$noop = kinesica_pacientes_dedupe_around_patient($pdo, 20);
assert_true(($noop['merged'] ?? -1) === 0, 'around_patient sin candidatos merged=0');
assert_true((int) ($noop['survivor_id'] ?? 0) === 20, 'around_patient conserva id si no une');

// Soft-deleted con WhatsApp real NO debe absorber a un activo placeholder
$pdo->exec('ALTER TABLE pacientes ADD COLUMN deleted_at TEXT NULL');
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, deleted_at)
    VALUES (30, "5491333333333", "Ana", "Gomez", "Ana Gomez", "888", datetime("now"))
')->execute();
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, dni, deleted_at)
    VALUES (31, "sin-tel-f-31", "Ana", "Gómez", "Ana Gómez", "888", NULL)
')->execute();
$mergedSoft = deduplicate_pacientes_table($pdo);
assert_true($mergedSoft === 0, 'dedupe no une activos con soft-deleted (merged=0)');
$active31 = $pdo->query('SELECT id, deleted_at FROM pacientes WHERE id = 31')->fetch(PDO::FETCH_ASSOC);
assert_true($active31 && ($active31['deleted_at'] === null || $active31['deleted_at'] === ''), 'paciente activo 31 sigue vivo');
$soft30 = $pdo->query('SELECT id FROM pacientes WHERE id = 30')->fetch(PDO::FETCH_ASSOC);
assert_true((bool) $soft30, 'soft-deleted 30 sigue existiendo sin absorber al activo');

$mergeSoft = kinesica_pacientes_merge_explicit($pdo, 31, 30);
assert_true(!$mergeSoft['ok'], 'merge_explicit rechaza target soft-deleted');

// Upsert + soft-delete: match activo no ve la ficha; find_soft sí → rama revive
$pdo->prepare('
    INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, deleted_at)
    VALUES (40, "5491444444444", "Bruno", "Soft", "Bruno Soft", datetime("now"))
')->execute();
$matchAlive = find_existing_patient_match($pdo, '5491444444444', 'Bruno Soft', null);
assert_true($matchAlive === null, 'match activo ignora soft-deleted');
$soft = kinesica_pacientes_find_soft_deleted_by_phone($pdo, '5491444444444');
assert_true((int) ($soft['id'] ?? 0) === 40, 'find_soft_deleted_by_phone encuentra 40');

// Misma decisión que kinesica_pacientes_upsert: soft → update + clear deleted_at
$existing = $matchAlive ?: $soft;
$reviving = $matchAlive === null && $soft !== null;
assert_true($reviving && (int) ($existing['id'] ?? 0) === 40, 'upsert elegiría revive de id=40');
$pdo->prepare(
    'UPDATE pacientes SET deleted_at = NULL, nombre = :n, apellido = :a, nombre_completo = :f WHERE id = :id'
)->execute(['n' => 'Bruno', 'a' => 'Revived', 'f' => 'Bruno Revived', 'id' => 40]);
$row40 = $pdo->query('SELECT id, deleted_at, nombre_completo FROM pacientes WHERE id = 40')->fetch(PDO::FETCH_ASSOC);
assert_true($row40 && ($row40['deleted_at'] === null || $row40['deleted_at'] === ''), 'revive limpia deleted_at');
assert_true(($row40['nombre_completo'] ?? '') === 'Bruno Revived', 'revive actualiza nombre');
$matchAfter = find_existing_patient_match($pdo, '5491444444444', 'Bruno Revived', null);
assert_true((int) ($matchAfter['id'] ?? 0) === 40, 'tras revive el match activo es 40');

$upsertSrc = file_get_contents($root . '/admin/api/pacientes_ops_upsert.php');
$insertSrc = file_get_contents($root . '/admin/api/pacientes_ops_upsert_insert.php');
assert_true(
    str_contains($upsertSrc, 'kinesica_pacientes_find_soft_deleted_by_phone')
    && str_contains($upsertSrc, 'deleted_at = NULL'),
    'pacientes_ops_upsert revive soft-deleted'
);
assert_true(str_contains($insertSrc, 'deleted_at = NULL'), 'upsert_insert ON DUPLICATE revive deleted_at');

echo "\n--- Todos los tests de kinesica_pacientes_merge_explicit pasaron exitosamente ---\n";
