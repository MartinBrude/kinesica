<?php
declare(strict_types=1);

/**
 * Tests de pausa puntual Clara (sin envío WhatsApp real).
 * Ejecutar: php scripts/test-clara-takeover.php
 * Con DB: KT_DB_* + KT_TMP (igual que test-interacciones.php).
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_clara_takeover.php';
require_once $root . '/admin/api/lib_migrations.php';

$fails = 0;
$passed = 0;
function ok(bool $cond, string $msg): void
{
    global $fails, $passed;
    if ($cond) {
        $passed++;
        echo "  ✓ $msg\n";
        return;
    }
    $fails++;
    echo "  ✗ FALLÓ: $msg\n";
}

echo "— test-clara-takeover —\n";

ok(clara_takeover_normalize_wa_id('+54 9 11 5555-6666') === '5491155556666', 'normaliza wa_id a dígitos');
ok(clara_takeover_normalize_wa_id('11 5555-6666') === '5491155556666', 'local AR 10 dígitos → 549…');
ok(clara_takeover_match_key('5491155556666') === '55556666', 'match_key last-8');
ok(CLARA_TAKEOVER_TTL_SECONDS === 30 * 60, 'TTL default 30 minutos');

$host = getenv('KT_DB_HOST');
$tmp = getenv('KT_TMP');
if (!$host || !$tmp) {
    echo "• Sin KT_DB_HOST/KT_TMP: solo tests de normalización ($passed ok)\n";
    exit($fails > 0 ? 1 : 0);
}

$dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $host,
    (int) (getenv('KT_DB_PORT') ?: 3306),
    getenv('KT_DB_NAME')
);
$pdo = new PDO($dsn, (string) getenv('KT_DB_USER'), (string) getenv('KT_DB_PASS'), [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

clara_takeover_ensure_schema($pdo);
$wa = '5491199' . substr((string) time(), -6);
clara_takeover_end($wa, $pdo);

$row = clara_takeover_start($wa, 'Norberto', CLARA_TAKEOVER_TTL_SECONDS, $pdo);
ok($row['wa_id'] === $wa, 'start guarda wa_id');
ok(!empty($row['paused_until']), 'start define paused_until');
ok(clara_takeover_is_active($wa, $pdo), 'is_active tras start');

$list = clara_takeover_list_active($pdo);
$found = false;
foreach ($list as $item) {
    if (($item['wa_id'] ?? '') === $wa) {
        $found = true;
        break;
    }
}
ok($found, 'list_active incluye el contacto');

ok(clara_takeover_end($wa, $pdo), 'end elimina fila');
ok(!clara_takeover_is_active($wa, $pdo), 'ya no está activo tras end');

// Alias last-8: fila vieja sin 549… se encuentra y end_all limpia todo
$alias = substr($wa, -8);
$pdo->prepare(
    'INSERT INTO clara_takeover (wa_id, paused_at, paused_until, paused_by, updated_at)
     VALUES (:wa, :at, :until, :by, :upd)'
)->execute([
    'wa' => $alias,
    'at' => gmdate('Y-m-d H:i:s'),
    'until' => gmdate('Y-m-d H:i:s', time() + 1800),
    'by' => 'alias',
    'upd' => gmdate('Y-m-d H:i:s'),
]);
ok(clara_takeover_is_active($wa, $pdo), 'get encuentra alias por last-8');
clara_takeover_start($wa, 'Norberto', CLARA_TAKEOVER_TTL_SECONDS, $pdo);
$got = clara_takeover_get($wa, $pdo);
ok(is_array($got) && ($got['wa_id'] ?? '') === $wa, 'start guarda wa canónico');
$aliasLeft = (int) $pdo->query(
    "SELECT COUNT(*) FROM clara_takeover WHERE wa_id = " . $pdo->quote($alias)
)->fetchColumn();
ok($aliasLeft === 0, 'start canónico elimina fila alias');
$wa2 = '5491188' . substr((string) time(), -6);
clara_takeover_start($wa2, 'María', CLARA_TAKEOVER_TTL_SECONDS, $pdo);
$cleared = clara_takeover_end_all($pdo);
ok($cleared >= 1, 'end_all limpia filas');
ok(count(clara_takeover_list_active($pdo)) === 0, 'list vacío tras end_all');

// Expiración: insertar fila vencida y purgar
$past = gmdate('Y-m-d H:i:s', time() - 120);
$pdo->prepare(
    'INSERT INTO clara_takeover (wa_id, paused_at, paused_until, paused_by, updated_at)
     VALUES (:wa, :at, :until, :by, :upd)'
)->execute(['wa' => $wa, 'at' => $past, 'until' => $past, 'by' => 'test', 'upd' => $past]);
$purged = clara_takeover_purge_expired($pdo);
ok($purged >= 1, 'purge_expired elimina vencidos');
ok(!clara_takeover_is_active($wa, $pdo), 'vencido no figura activo');

echo "Resultado: $passed ok, $fails fallos\n";
exit($fails > 0 ? 1 : 0);
