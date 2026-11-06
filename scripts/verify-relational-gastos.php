<?php
declare(strict_types=1);

/**
 * Tests SQLite — gastos dual-write / auditoría (etapa 8).
 * Docs: docs/etapa8-config-gastos.md
 * Run: php scripts/verify-relational-gastos.php
 */

$root = dirname(__DIR__);

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_gastos.php';
require_once $root . '/admin/api/lib_relational_config.php';

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

$migA = require $root . '/admin/api/migrations/011_auditoria_cambios.php';
($migA['up'])($pdo);
$mig = require $root . '/admin/api/migrations/012_gastos.php';
($mig['up'])($pdo);

assert_true(kinesica_rel_gastos_ready($pdo), 'tabla gastos');

$ok = kinesica_rel_gasto_upsert($pdo, [
    'id' => 'gasto_t1',
    'concepto' => 'Hosting',
    'detalle' => 'test',
    'fecha' => '2026-11-01',
    'moneda' => 'EUR',
    'monto' => 10.5,
    'monto_eur' => 10.5,
    'monto_usd' => 11.0,
    'monto_ars' => 15000,
], 'admin');
assert_true($ok, 'upsert gasto');

$list = kinesica_rel_gastos_load_db($pdo);
assert_true(count($list) === 1 && $list[0]['id'] === 'gasto_t1', 'load db');
assert_true((float) $list[0]['monto'] === 10.5, 'monto');

$ok2 = kinesica_rel_gasto_upsert($pdo, [
    'id' => 'gasto_t1',
    'concepto' => 'Hosting Pro',
    'detalle' => 'test',
    'fecha' => '2026-11-01',
    'moneda' => 'EUR',
    'monto' => 12.0,
], 'admin');
assert_true($ok2, 'update gasto');
$list = kinesica_rel_gastos_load_db($pdo);
assert_true((float) $list[0]['monto'] === 12.0, 'monto updated');

$audit = (int) $pdo->query("SELECT COUNT(*) FROM auditoria_cambios WHERE entity = 'gastos'")->fetchColumn();
assert_true($audit >= 2, 'auditoria gastos');

assert_true(kinesica_rel_gasto_delete($pdo, 'gasto_t1', 'admin'), 'delete');
assert_true(kinesica_rel_gastos_load_db($pdo) === [], 'empty after delete');

echo "verify-relational-gastos: OK\n";
