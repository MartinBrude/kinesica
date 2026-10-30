<?php
declare(strict_types=1);

/**
 * Pruebas del almacén de recordatorios (normalize, idempotencia, vista).
 * Con KT_DB_* + KT_TMP: corrida completa. Sin DB: solo normalización.
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_recordatorios_store.php';
require_once $root . '/admin/api/lib_recordatorios_view.php';

$fails = 0;
$passed = 0;
function ok(bool $cond, string $msg): void
{
    global $fails, $passed;
    if ($cond) {
        $passed++;
        return;
    }
    $fails++;
    echo "  ✗ FALLÓ: $msg\n";
}
function eq($actual, $expected, string $msg): void
{
    ok($actual === $expected, $msg . ' (esperado ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . ', obtuvo ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . ')');
}
function section(string $name): void
{
    echo "• $name\n";
}

section('Normalización');
eq(recordatorios_normalize_item(['status' => 'bogus', 'calendar_event_id' => 'x'], 'e1', 100), null, 'status inválido');
eq(recordatorios_normalize_item(['status' => 'sent'], 'e1', 100), null, 'sin calendar_event_id se rechaza');
$run = recordatorios_normalize_item(['status' => 'run_skipped', 'skip_reason' => 'clara_inactive'], 'exec-99', 1700000000);
eq($run['status'], 'run_skipped', 'run_skipped ok');
eq($run['calendar_event_id'], '_run', 'run_skipped usa _run');
eq($run['event_key'], 'rem:exec-99:_run:run_skipped', 'clave run_skipped');

$sent = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'calABC',
    'patient_name' => 'Lucas',
    'wa_id' => '+54 9 11 4455-6677',
    'appointment_date' => '2026-10-31',
    'appointment_time' => '16:00 hs',
    'event_summary' => '🩺 Lucas',
], 'n8n-1', 1700000000);
eq($sent['wa_id'], '5491144556677', 'wa_id limpio');
eq($sent['event_key'], 'rem:n8n-1:calABC:sent', 'clave sent');

$badSkip = recordatorios_normalize_item([
    'status' => 'skipped',
    'calendar_event_id' => 'c1',
    'skip_reason' => 'weird_reason',
], 'e', 1);
eq($badSkip['skip_reason'], 'other', 'skip_reason desconocido → other');

$host = getenv('KT_DB_HOST');
if (!$host || !getenv('KT_TMP')) {
    echo "• Persistencia omitida (sin KT_DB_HOST / KT_TMP)\n";
    echo $fails === 0 ? "OK recordatorios ($passed assertions)\n" : "FAIL recordatorios ($fails)\n";
    exit($fails === 0 ? 0 : 1);
}

section('Persistencia e idempotencia');
function db_dsn(): string
{
    return sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', getenv('KT_DB_HOST'), (int) getenv('KT_DB_PORT'), getenv('KT_DB_NAME'));
}
function new_pdo(): PDO
{
    return new PDO(db_dsn(), (string) getenv('KT_DB_USER'), (string) getenv('KT_DB_PASS'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

$pdo = new_pdo();
$pdo->exec('DROP TABLE IF EXISTS recordatorio_eventos');
$pdo = new_pdo();
recordatorios_ensure_schema($pdo);

$a = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'evt1',
    'patient_name' => 'Ana',
    'wa_id' => '5491100000001',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'runA', time());
eq(recordatorios_insert_item($pdo, $a), 'stored', 'primer insert');
eq(recordatorios_insert_item($pdo, $a), 'duplicate', 'reintento idempotente');

$fail = recordatorios_normalize_item([
    'status' => 'failed',
    'calendar_event_id' => 'evt1',
    'error_code' => '131047',
    'error_message' => 'ventana 24h',
    'patient_name' => 'Ana',
], 'runA', time());
eq(recordatorios_insert_item($pdo, $fail), 'stored', 'failed es otra clave');

$res = recordatorios_store_items([$a, $fail], $pdo);
eq($res['duplicates'], 2, 'lote re-ingest duplica');
eq($res['stored'], 0, 'nada nuevo en re-lote');

$view = recordatorios_load_view($pdo, 14);
eq($view['total'] >= 2, true, 'vista tiene filas');
eq($view['counts']['sent'] >= 1, true, 'conteo sent');
eq($view['counts']['failed'] >= 1, true, 'conteo failed');

echo $fails === 0 ? "OK recordatorios ($passed assertions)\n" : "FAIL recordatorios ($fails)\n";
exit($fails === 0 ? 0 : 1);
