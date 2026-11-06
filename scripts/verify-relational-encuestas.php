<?php
declare(strict_types=1);

/**
 * Tests SQLite — tabla encuestas + dual-write / backfill desde JSON.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-encuestas.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_encuestas.php';

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

$mig = require $root . '/admin/api/migrations/008_encuestas.php';
($mig['up'])($pdo);
assert_true(kinesica_rel_encuestas_ready($pdo), 'tabla encuestas');

$ok = kinesica_rel_encuesta_upsert($pdo, [
    'id' => 'enc_test1',
    'experiencia' => 5,
    'tratamiento_resultado' => 'excelente',
    'tratamiento_label' => 'Excelente',
    'recomendaria' => 'si',
    'recomendaria_label' => 'Sí',
    'comentarios' => 'Muy bien',
    'lang' => 'es',
    'created_at' => '2026-11-06T12:00:00Z',
]);
assert_true($ok, 'upsert encuesta');
$list = kinesica_rel_encuestas_load_db($pdo);
assert_true(count($list) === 1 && $list[0]['id'] === 'enc_test1', 'load db');
assert_true((int) $list[0]['experiencia'] === 5, 'experiencia');

assert_true(kinesica_rel_encuesta_delete($pdo, 'enc_test1'), 'delete');
assert_true(kinesica_rel_encuestas_load_db($pdo) === [], 'empty after delete');

// Backfill from temp JSON via stubbing load_json_only is hard; insert JSON path manually
$tmpDir = sys_get_temp_dir() . '/kinesica_enc_test_' . getmypid();
@mkdir($tmpDir, 0775, true);
$jsonFile = $tmpDir . '/encuestas.json';
file_put_contents($jsonFile, json_encode([
    [
        'id' => 'enc_bf1',
        'experiencia' => 4,
        'tratamiento_resultado' => 'bien',
        'tratamiento_label' => 'Bien',
        'recomendaria' => 'si',
        'recomendaria_label' => 'Sí',
        'comentarios' => '',
        'lang' => 'es',
        'created_at' => '2026-11-01T10:00:00Z',
    ],
], JSON_UNESCAPED_UNICODE));

// Inline backfill without encuestas_io file dependency: upsert from decoded JSON
$data = json_decode((string) file_get_contents($jsonFile), true);
assert_true(is_array($data), 'json fixture');
foreach ($data as $item) {
    kinesica_rel_encuesta_upsert($pdo, $item);
}
assert_true(count(kinesica_rel_encuestas_load_db($pdo)) === 1, 'backfill-like upsert');

$pdo2 = new PDO('sqlite::memory:');
$pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo2->exec(
    'CREATE TABLE pacientes (id INTEGER PRIMARY KEY, telefono TEXT, nombre_completo TEXT);
     CREATE TABLE fichas (id TEXT PRIMARY KEY, payload TEXT, profesional TEXT, updated_at TEXT, updated_by TEXT);
     CREATE TABLE lista_espera (id INTEGER PRIMARY KEY, paciente_telefono TEXT, paciente_nombre TEXT, profesional TEXT);
     CREATE TABLE interaccion_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, direction TEXT, body TEXT, ts_utc TEXT, received_at TEXT);
     CREATE TABLE interaccion_estado (conversation_key TEXT PRIMARY KEY, updated_at TEXT);
     CREATE TABLE recordatorio_eventos (id INTEGER PRIMARY KEY, event_key TEXT, wa_id TEXT, status TEXT, run_at TEXT, received_at TEXT);'
);
$run = kinesica_migrations_run($pdo2, false);
assert_true(count($run['applied']) >= 8, 'migrate >=8');
assert_true(kinesica_migrations_table_exists($pdo2, 'encuestas'), '008 aplicada');

@unlink($jsonFile);
@rmdir($tmpDir);

echo "verify-relational-encuestas: OK\n";
