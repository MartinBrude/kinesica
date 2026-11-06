<?php
declare(strict_types=1);

/**
 * Tests SQLite — integridad referencial etapa 9 (soft-delete, orphans, PRAGMA FK).
 * Docs: docs/etapa9-integridad-referencial.md
 * Run: php scripts/verify-relational-fk.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_flags.php';
require_once $root . '/admin/api/lib_relational_integrity.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    echo "OK: {$msg}\n";
}

// --- Soft-delete + orphan nulling (sin PRAGMA FK) ---
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_completo TEXT NOT NULL DEFAULT \'\',
        deleted_at TEXT NULL,
        version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE profesionales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        deleted_at TEXT NULL
    );
    CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL DEFAULT \'\',
        profesional TEXT NOT NULL DEFAULT \'\',
        paciente_id INTEGER NULL,
        profesional_id INTEGER NULL,
        updated_at TEXT,
        updated_by TEXT
    );
    CREATE TABLE turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NULL,
        profesional_id INTEGER NULL,
        calendar_event_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT \'scheduled\',
        source TEXT NOT NULL DEFAULT \'manual\'
    );'
);
$pdo->exec("INSERT INTO pacientes (nombre_completo) VALUES ('Ana Test')");
$pdo->exec("INSERT INTO profesionales (slug, display_name) VALUES ('norberto', 'Norberto')");
$pdo->exec("INSERT INTO fichas (id, payload, paciente_id, profesional_id) VALUES ('f1', '{}', 1, 1)");
$pdo->exec("INSERT INTO fichas (id, payload, paciente_id) VALUES ('f_orphan', '{}', 999)");

assert_true(kinesica_rel_paciente_has_clinical_children($pdo, 1), 'has clinical children');
$soft = kinesica_rel_paciente_soft_delete($pdo, 1);
assert_true($soft['ok'], 'soft delete ok');
$del = $pdo->query('SELECT deleted_at FROM pacientes WHERE id = 1')->fetchColumn();
assert_true($del !== null && $del !== '', 'deleted_at set');
assert_true(
    kinesica_rel_pacientes_not_deleted_sql($pdo) === 'deleted_at IS NULL',
    'alive sql fragment'
);

$orphans = kinesica_rel_integrity_null_orphans($pdo, true);
$nulled = 0;
foreach ($orphans as $o) {
    if ($o['table'] === 'fichas' && $o['column'] === 'paciente_id') {
        $nulled = $o['nulled'];
    }
}
assert_true($nulled === 1, 'null orphan fichas.paciente_id');
$orphanVal = $pdo->query("SELECT paciente_id FROM fichas WHERE id = 'f_orphan'")->fetchColumn();
assert_true($orphanVal === null || $orphanVal === '', 'orphan nulled');

assert_true(
    kinesica_rel_integrity_fk_name('fichas', 'paciente_id') === 'fk_fichas_paciente',
    'fk name fichas.paciente'
);
assert_true(
    kinesica_rel_integrity_fk_name('recordatorio_eventos', 'turno_id') === 'fk_recordatorio_eventos_turno',
    'fk name recordatorio.turno'
);

// enforce_fk assert
putenv('KINESICA_REL_ENFORCE_FK=1');
kinesica_rel_flags_reset_cache();
assert_true(kinesica_rel_enforce_fk() === true, 'enforce_fk env');
$bad = kinesica_rel_assert_paciente_id($pdo, 999);
assert_true(is_array($bad) && ($bad['code'] ?? '') === 'fk_paciente_missing', 'assert missing paciente');
$delAssert = kinesica_rel_assert_paciente_id($pdo, 1);
assert_true(is_array($delAssert) && ($delAssert['code'] ?? '') === 'fk_paciente_deleted', 'assert deleted paciente');
$okProf = kinesica_rel_assert_profesional_id($pdo, 1);
assert_true($okProf === true, 'assert profesional ok');
putenv('KINESICA_REL_ENFORCE_FK');
kinesica_rel_flags_reset_cache();

// Integrity exception mapping (simular errno 1451 vía errorInfo)
$ex = new PDOException('SQLSTATE[23000]: Integrity constraint violation: 1451 Cannot delete or update a parent row');
$ex->errorInfo = ['23000', 1451, 'Cannot delete or update a parent row'];
$mapped = kinesica_rel_map_integrity_exception($ex);
assert_true($mapped !== null && $mapped['body']['code'] === 'fk_restrict_delete', 'map 1451');

// --- PRAGMA foreign_keys: schema con FK en CREATE ---
$pdoFk = new PDO('sqlite::memory:');
$pdoFk->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdoFk->exec('PRAGMA foreign_keys = ON');
$pdoFk->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_completo TEXT NOT NULL DEFAULT \'\'
    );
    CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        paciente_id INTEGER NULL,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT
    );'
);
$pdoFk->exec("INSERT INTO pacientes (nombre_completo) VALUES ('X')");
$pdoFk->exec("INSERT INTO fichas (id, paciente_id) VALUES ('a', 1)");

$blocked = false;
try {
    $pdoFk->exec('DELETE FROM pacientes WHERE id = 1');
} catch (PDOException $e) {
    $blocked = true;
}
assert_true($blocked, 'SQLite FK RESTRICT blocks parent delete');

$badChild = false;
try {
    $pdoFk->exec("INSERT INTO fichas (id, paciente_id) VALUES ('b', 42)");
} catch (PDOException $e) {
    $badChild = true;
}
assert_true($badChild, 'SQLite FK blocks orphan insert');

// Migrate runner incluye 013
$pdo2 = new PDO('sqlite::memory:');
$pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo2->exec(
    'CREATE TABLE pacientes (id INTEGER PRIMARY KEY, telefono TEXT, nombre_completo TEXT, deleted_at TEXT, version INTEGER DEFAULT 1);
     CREATE TABLE fichas (id TEXT PRIMARY KEY, payload TEXT, profesional TEXT, updated_at TEXT, updated_by TEXT);
     CREATE TABLE lista_espera (id INTEGER PRIMARY KEY, paciente_telefono TEXT, paciente_nombre TEXT, profesional TEXT);
     CREATE TABLE interaccion_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, direction TEXT, body TEXT, ts_utc TEXT, received_at TEXT);
     CREATE TABLE interaccion_estado (conversation_key TEXT PRIMARY KEY, updated_at TEXT);
     CREATE TABLE recordatorio_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, status TEXT, run_at TEXT, received_at TEXT);'
);
$run = kinesica_migrations_run($pdo2, false);
assert_true(count($run['applied']) >= 13, 'migrate >=13');
assert_true(in_array('013_rel_integrity_fks', $run['applied'], true), '013 applied');

echo "verify-relational-fk: OK\n";
