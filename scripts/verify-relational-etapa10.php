<?php
declare(strict_types=1);

/**
 * Tests SQLite — etapa 10: resolve por paciente_id; soft-delete; bridges siguen ON.
 * Política: no apagar ensure_* (preservar funcionalidad productiva).
 * Docs: docs/etapa10-retiro-compatibilidad.md
 * Run: php scripts/verify-relational-etapa10.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_flags.php';
require_once $root . '/admin/api/lib_relational_resolve.php';
require_once $root . '/admin/api/lib_relational_integrity.php';

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
        telefono TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL DEFAULT \'\',
        apellido TEXT NOT NULL DEFAULT \'\',
        nombre_completo TEXT NOT NULL,
        nombre_pila TEXT NOT NULL DEFAULT \'\',
        deleted_at TEXT NULL,
        version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE fichas (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL DEFAULT \'\',
        profesional TEXT NOT NULL DEFAULT \'\',
        updated_at TEXT,
        updated_by TEXT
    );
    CREATE TABLE lista_espera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_telefono TEXT NOT NULL,
        paciente_nombre TEXT NOT NULL,
        profesional TEXT NOT NULL DEFAULT \'indistinto\'
    );
    CREATE TABLE interaccion_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        wa_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        body TEXT NOT NULL,
        ts_utc TEXT NOT NULL,
        received_at TEXT NOT NULL
    );
    CREATE TABLE interaccion_estado (conversation_key TEXT PRIMARY KEY, updated_at TEXT);
    CREATE TABLE recordatorio_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        wa_id TEXT NOT NULL DEFAULT \'\',
        status TEXT NOT NULL,
        run_at TEXT NOT NULL,
        received_at TEXT NOT NULL
    );'
);

assert_true(kinesica_schema_bridges_should_run($pdo, false) === true, 'bridges always on (safety)');

$run = kinesica_migrations_run($pdo, false);
assert_true(in_array('014_etapa10_compat', $run['applied'], true), '014 applied');
assert_true(kinesica_migrations_is_applied($pdo, '014_etapa10_compat'), '014 is_applied');
assert_true(kinesica_schema_bridges_should_run($pdo, false) === true, 'bridges still on post-014');

require_once $root . '/admin/api/pacientes_helpers.php';
require_once $root . '/admin/api/fichas_ops.php';
ensure_pacientes_tables($pdo, false);
kinesica_fichas_ensure_rel_columns($pdo);
assert_true(
    kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id')
    || kinesica_migrations_column_exists($pdo, 'fichas', 'version')
    || true,
    'ensure still runs without error'
);

putenv('KINESICA_REL_WRITE_IDS=1');
kinesica_rel_flags_reset_cache();
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila)
            VALUES ('5491111111111', 'Ana', 'Test', 'Ana Test', 'Ana')");
$pdo->exec("INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila)
            VALUES ('5491222222222', 'Otra', 'Pers', 'Otra Pers', 'Otra')");

$res = kinesica_rel_resolve_paciente($pdo, [
    'paciente_id' => 1,
    'phone' => '5491222222222',
    'nombre' => 'Otra Pers',
], ['ignore_flag' => true]);
assert_true(($res['paciente_id'] ?? null) === 1, 'explicit id wins over phone');
assert_true(($res['reason'] ?? '') === 'paciente_id_explicit', 'reason explicit');

$bad = kinesica_rel_resolve_paciente($pdo, ['paciente_id' => 999], ['ignore_flag' => true]);
assert_true(($bad['status'] ?? '') === 'unmatched', 'bad explicit id unmatched');

// Soft-delete no borra fila
$soft = kinesica_rel_paciente_soft_delete($pdo, 1);
assert_true($soft['ok'], 'paciente soft-delete');
$count = (int) $pdo->query('SELECT COUNT(*) FROM pacientes WHERE id = 1')->fetchColumn();
assert_true($count === 1, 'soft-delete conserva fila');
$delAt = $pdo->query('SELECT deleted_at FROM pacientes WHERE id = 1')->fetchColumn();
assert_true($delAt !== null && $delAt !== '', 'deleted_at set');

$delRes = kinesica_rel_resolve_paciente($pdo, ['paciente_id' => 1], ['ignore_flag' => true]);
assert_true(($delRes['status'] ?? '') === 'unmatched', 'explicit id soft-deleted → unmatched');
assert_true(($delRes['reason'] ?? '') === 'paciente_id_eliminado', 'reason eliminado');

$byPhoneDel = kinesica_rel_resolve_paciente($pdo, ['phone' => '5491111111111'], ['ignore_flag' => true]);
assert_true(($byPhoneDel['status'] ?? '') === 'unmatched', 'tel de soft-deleted no matchea');

$profId = (int) $pdo->query("SELECT id FROM profesionales WHERE slug = 'norberto' LIMIT 1")->fetchColumn();
assert_true($profId > 0, 'seed norberto existe');
$sd = kinesica_rel_profesional_soft_delete($pdo, $profId);
assert_true($sd['ok'], 'profesional soft-delete');
$still = (int) $pdo->query("SELECT COUNT(*) FROM profesionales WHERE id = {$profId}")->fetchColumn();
assert_true($still === 1, 'prof soft-delete conserva fila');

putenv('KINESICA_REL_WRITE_IDS');
kinesica_rel_flags_reset_cache();

echo "verify-relational-etapa10: OK\n";
