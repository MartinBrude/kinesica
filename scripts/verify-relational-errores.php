<?php
declare(strict_types=1);

/**
 * Tests unitarios y de integración para la persistencia relacional de errores.
 * Run: php scripts/verify-relational-errores.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_errores.php';
require_once $root . '/admin/api/errores_io.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    echo "OK: {$msg}\n";
}

// 1. Setup SQLite in-memory DB
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// 2. Migration 015 up
$mig = require $root . '/admin/api/migrations/015_errores.php';
assert_true(is_array($mig) && ($mig['id'] ?? '') === '015_errores', 'Migration 015 loaded');
$mig['up']($pdo);

assert_true(kinesica_rel_errores_ready($pdo), 'Tabla errores lista en SQLite');

// 3. Insert and read
$testItem = [
    'id' => 'err_test123',
    'seccion' => 'Clara (IA / Asistente Virtual)',
    'info' => 'Prueba unitaria',
    'comportamiento_actual' => 'Comportamiento A',
    'comportamiento_esperado' => 'Comportamiento B',
    'foto' => '',
    'video' => '',
    'estado' => 'pendiente',
    'created_at' => '2026-11-12T20:00:00Z',
    'created_by' => 'tester',
    'resolved_at' => null,
    'resolved_by' => null,
];

$ok = kinesica_rel_error_upsert($pdo, $testItem, 'tester');
assert_true($ok, 'Upsert err_test123 exitoso');

$list = kinesica_rel_errores_load_db($pdo);
assert_true(count($list) === 1, '1 error cargado desde DB');
assert_true($list[0]['id'] === 'err_test123', 'ID coincide');
assert_true($list[0]['estado'] === 'pendiente', 'Estado pendiente');

// 4. Update / toggle
$testItem['estado'] = 'resuelto';
$testItem['resolved_at'] = '2026-11-12T20:30:00Z';
$testItem['resolved_by'] = 'martin';
$okUpdate = kinesica_rel_error_upsert($pdo, $testItem, 'martin');
assert_true($okUpdate, 'Update err_test123 exitoso');

$list2 = kinesica_rel_errores_load_db($pdo);
assert_true(count($list2) === 1, '1 error tras update');
assert_true($list2[0]['estado'] === 'resuelto', 'Estado actualizado a resuelto');
assert_true($list2[0]['resolved_by'] === 'martin', 'Resolved by actualizado');

// 5. Backfill
$bf = kinesica_rel_backfill_errores($pdo, true);
assert_true($bf['scanned'] >= 2, 'Backfill escaneó los errores restaurados');
assert_true($bf['updated'] >= 2, 'Backfill insertó los errores faltantes en la DB');

$listAfterBf = kinesica_rel_errores_load_db($pdo);
assert_true(count($listAfterBf) >= 3, 'DB contiene test + restaurados');

// 6. Delete
$delOk = kinesica_rel_error_delete($pdo, 'err_test123', 'tester');
assert_true($delOk, 'Delete err_test123 exitoso');
$listAfterDel = kinesica_rel_errores_load_db($pdo);
$hasDeleted = false;
foreach ($listAfterDel as $e) {
    if ($e['id'] === 'err_test123') $hasDeleted = true;
}
assert_true(!$hasDeleted, 'err_test123 ya no existe en DB');

echo "\nTodos los tests de persistencia relacional de errores pasaron con éxito.\n";
