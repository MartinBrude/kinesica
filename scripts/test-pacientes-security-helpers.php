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

echo "\n--- test-pacientes-security-helpers OK ---\n";
