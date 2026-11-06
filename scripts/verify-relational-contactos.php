<?php
declare(strict_types=1);

/**
 * Tests SQLite — sync paciente_contactos + resolve vía contactos compartidos.
 * Docs: docs/codigo-datos-relacionales.md
 * Run: php scripts/verify-relational-contactos.php
 */

$root = dirname(__DIR__);

if (!function_exists('sanitize_patient_name')) {
    function sanitize_patient_name(string $str): string
    {
        return trim(preg_replace('/\s+/u', ' ', $str) ?? $str);
    }
}

require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_contactos.php';
require_once $root . '/admin/api/lib_relational_resolve.php';

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

// Aplicar migración 001
$mig = require $root . '/admin/api/migrations/001_paciente_contactos.php';
($mig['up'])($pdo);
assert_true(kinesica_rel_contactos_ready($pdo), 'tabla paciente_contactos');

$pdo->exec(
    'CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL,
        nombre_completo TEXT NOT NULL,
        dni TEXT,
        email TEXT,
        contacto_telefono TEXT,
        contacto_email TEXT
    )'
);
$pdo->exec("INSERT INTO pacientes (telefono, nombre_completo, dni, email, contacto_telefono, contacto_email) VALUES
    ('5491161234567', 'Ana Gómez', '30111222', 'Ana@Example.com', '5491199998888', 'otro@example.com')");

$res = kinesica_rel_sync_paciente_contactos($pdo, 1, [
    'telefono' => '5491161234567',
    'email' => 'Ana@Example.com',
    'contacto_telefono' => '5491199998888',
    'contacto_email' => 'otro@example.com',
]);
assert_true($res['telefono'] === 'inserted', 'tel principal insertado');
assert_true($res['email'] === 'inserted', 'email principal insertado');
assert_true($res['secundarios'] === 2, '2 secundarios');

$rows = $pdo->query('SELECT tipo, valor_normalizado, es_principal FROM paciente_contactos ORDER BY tipo, es_principal DESC')->fetchAll(PDO::FETCH_ASSOC);
$principals = array_values(array_filter($rows, static fn ($r) => (int) $r['es_principal'] === 1));
assert_true(count($principals) === 2, 'dos principales (tel+email)');
assert_true(($principals[0]['valor_normalizado'] ?? '') === 'ana@example.com' || ($principals[1]['valor_normalizado'] ?? '') === 'ana@example.com', 'email normalizado lower');

// Cambiar teléfono principal (y la columna legacy, como haría el admin)
$res2 = kinesica_rel_sync_paciente_contactos($pdo, 1, [
    'telefono' => '5491177776666',
    'email' => 'ana@example.com',
]);
assert_true($res2['telefono'] === 'updated', 'tel principal actualizado');
$pdo->exec("UPDATE pacientes SET telefono = '5491177776666' WHERE id = 1");
$telPrincipal = $pdo->query(
    "SELECT valor_normalizado FROM paciente_contactos WHERE paciente_id = 1 AND tipo = 'telefono' AND es_principal = 1"
)->fetchColumn();
assert_true($telPrincipal === '5491177776666', 'nuevo tel principal');

// Un solo principal por tipo
$countTelP = (int) $pdo->query(
    "SELECT COUNT(*) FROM paciente_contactos WHERE paciente_id = 1 AND tipo = 'telefono' AND es_principal = 1"
)->fetchColumn();
assert_true($countTelP === 1, 'un solo tel principal');

// Backfill dry + apply sobre segundo paciente
$pdo->exec("INSERT INTO pacientes (telefono, nombre_completo, email) VALUES
    ('5491155554444', 'Luis Pérez', 'luis@example.com')");
$dry = kinesica_rel_backfill_paciente_contactos($pdo, false);
assert_true(($dry['synced'] ?? 0) >= 2, 'dry sync count');
$apply = kinesica_rel_backfill_paciente_contactos($pdo, true);
assert_true(($apply['synced'] ?? 0) >= 2, 'apply sync');
$luisTel = $pdo->query(
    "SELECT c.valor_normalizado FROM paciente_contactos c
     INNER JOIN pacientes p ON p.id = c.paciente_id
     WHERE p.nombre_completo = 'Luis Pérez' AND c.tipo = 'telefono' AND c.es_principal = 1"
)->fetchColumn();
assert_true($luisTel === '5491155554444', 'backfill luis');

// Resolve via contactos: paciente sin match en telefono column pero sí en contactos
// (simula teléfono legacy desfasado)
$pdo->exec("UPDATE pacientes SET telefono = 'sin-tel-x' WHERE id = 1");
$viaContacto = kinesica_rel_find_pacientes_by_contacto_phone($pdo, '5491177776666');
assert_true(count($viaContacto) === 1, 'lookup contactos encuentra a Ana (n=' . count($viaContacto) . ')');
putenv('KINESICA_REL_WRITE_IDS=1');
kinesica_rel_flags_reset_cache();
$resolved = kinesica_rel_resolve_paciente($pdo, ['phone' => '5491177776666'], ['ignore_flag' => true]);
assert_true(
    ($resolved['status'] ?? '') === 'matched' && (int) ($resolved['paciente_id'] ?? 0) === 1,
    'resolve por paciente_contactos (status=' . ($resolved['status'] ?? '') . ' id=' . json_encode($resolved['paciente_id'] ?? null) . ' reason=' . ($resolved['reason'] ?? '') . ')'
);

putenv('KINESICA_REL_WRITE_IDS');
kinesica_rel_flags_reset_cache();

echo "verify-relational-contactos: OK\n";
