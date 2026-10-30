<?php
declare(strict_types=1);

/**
 * Pruebas del almacén de recordatorios (normalize, idempotencia, vista, reconcile).
 * Con KT_DB_* + KT_TMP: persistencia + reconciliador. Sin DB: normalización + parse de árbol.
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_recordatorios_store.php';
require_once $root . '/admin/api/lib_recordatorios_view.php';
require_once $root . '/admin/api/lib_recordatorios_n8n.php';

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
$sentMail = recordatorios_normalize_item([
    'status' => 'sent_email',
    'calendar_event_id' => 'calMail',
    'patient_name' => 'Ana',
    'error_message' => 'ana@example.com',
], 'n8n-1b', 1700000001);
eq($sentMail['status'] ?? '', 'sent_email', 'status sent_email aceptado');
eq($sentMail['event_key'], 'rem:n8n-1b:calMail:sent_email', 'clave sent_email');

$badSkip = recordatorios_normalize_item([
    'status' => 'skipped',
    'calendar_event_id' => 'c1',
    'skip_reason' => 'weird_reason',
], 'e', 1);
eq($badSkip['skip_reason'], 'other', 'skip_reason desconocido → other');

section('Parse árbol Build*');
function rem_tree(array $batches): array
{
    $runData = [];
    foreach ($batches as $node => $payload) {
        $runData[$node] = [['data' => ['main' => [[['json' => $payload]]]]]];
    }
    return ['resultData' => ['runData' => $runData]];
}
$tree = rem_tree([
    'Build Sent Reminder Report' => [
        'action' => 'ingest',
        'exec_id' => '42',
        'run_at' => '2026-10-30T13:00:00Z',
        'items' => [[
            'status' => 'sent',
            'calendar_event_id' => 'evtSent',
            'patient_name' => 'Ana',
            'wa_id' => '5491100000001',
            'appointment_date' => '2026-10-31',
            'appointment_time' => '10:00 hs',
        ]],
    ],
    'Build Missing Phone Reminder Report' => [
        'action' => 'ingest',
        'exec_id' => '42',
        'items' => [[
            'status' => 'missing_phone',
            'calendar_event_id' => 'evtMiss',
            'patient_name' => 'Bob',
        ]],
    ],
]);
$parsed = recordatorios_events_from_execution($tree, '42', '2026-10-30T13:00:00Z');
eq(count($parsed), 2, 'parsea sent + missing_phone');
$statuses = array_column($parsed, 'status');
sort($statuses);
eq($statuses, ['missing_phone', 'sent'], 'statuses del árbol');
eq(recordatorios_events_from_execution(['resultData' => ['runData' => []]], '1', null), [], 'sin Build => vacío');

eq(recordatorios_reconcile(null, 2, null, null)['status'], 'not_configured', 'sin credenciales => not_configured');

$host = getenv('KT_DB_HOST');
if (!$host || !getenv('KT_TMP')) {
    echo "• Persistencia/reconcile omitidos (sin KT_DB_HOST / KT_TMP)\n";
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
function rem_fresh(string $name): PDO
{
    $dir = getenv('KT_TMP') . '/rem-' . $name . '-' . bin2hex(random_bytes(3));
    mkdir($dir, 0755, true);
    putenv('KINESICA_RECORDATORIOS_DIR=' . $dir);
    $pdo = new_pdo();
    $pdo->exec('DROP TABLE IF EXISTS recordatorio_eventos');
    $pdo = new_pdo();
    recordatorios_ensure_schema($pdo);
    return $pdo;
}
function count_rem(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM recordatorio_eventos')->fetchColumn();
}
function flat_encode($root): string
{
    $arr = [];
    $add = function ($v) use (&$add, &$arr) {
        $idx = count($arr);
        $arr[] = null;
        if (is_array($v)) {
            $out = [];
            foreach ($v as $k => $x) {
                $out[$k] = (is_array($x) || is_string($x)) ? (string) $add($x) : $x;
            }
            $arr[$idx] = $out;
        } else {
            $arr[$idx] = $v;
        }
        return $idx;
    };
    $add($root);
    return json_encode($arr);
}
function fake_n8n_rem(array $execs, int $pageSize, array &$log, bool $needLogin = true): callable
{
    $loggedIn = !$needLogin;
    return function (string $method, string $url) use (&$execs, $pageSize, &$log, &$loggedIn): array {
        $log[] = "$method $url";
        if ($method === 'POST' && str_ends_with($url, '/rest/login')) {
            $loggedIn = true;
            return ['status' => 200, 'body' => '{}'];
        }
        if (!$loggedIn) {
            return ['status' => 401, 'body' => ''];
        }
        if (preg_match('#/rest/executions/(\d+)$#', $url, $m)) {
            $id = (int) $m[1];
            if (!isset($execs[$id])) {
                return ['status' => 500, 'body' => ''];
            }
            return ['status' => 200, 'body' => json_encode(['data' => ['data' => flat_encode($execs[$id]['tree'])]])];
        }
        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $ids = array_keys($execs);
        rsort($ids);
        $offset = isset($q['cursor']) ? (int) $q['cursor'] : 0;
        $slice = array_slice($ids, $offset, $pageSize);
        $results = array_map(fn($id) => [
            'id' => (string) $id,
            'workflowId' => $execs[$id]['wf'],
            'status' => $execs[$id]['status'] ?? 'success',
            'startedAt' => $execs[$id]['startedAt'] ?? '2026-01-01T10:00:00.000Z',
            'stoppedAt' => '2026-01-01T10:00:05.000Z',
        ], $slice);
        $next = $offset + $pageSize < count($ids) ? (string) ($offset + $pageSize) : null;
        return ['status' => 200, 'body' => json_encode(['data' => ['results' => $results, 'nextCursor' => $next]])];
    };
}

$pdo = rem_fresh('store');
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

section('Reconcile baseline + import');
$conf = [
    'n8n_url' => 'https://n8n.test',
    'n8n_user' => 'u',
    'n8n_password' => 'p',
    'n8n_recordatorios_workflow_id' => 'WF-REM',
];
$oldTree = rem_tree([
    'Build Sent Reminder Report' => [
        'action' => 'ingest',
        'exec_id' => '10',
        'items' => [[
            'status' => 'sent',
            'calendar_event_id' => 'oldEvt',
            'patient_name' => 'Viejo',
            'wa_id' => '5491199999999',
        ]],
    ],
]);
$newTree = rem_tree([
    'Build Sent Reminder Report' => [
        'action' => 'ingest',
        'exec_id' => '20',
        'items' => [[
            'status' => 'sent',
            'calendar_event_id' => 'newEvt',
            'patient_name' => 'Nuevo',
            'wa_id' => '5491188888888',
        ]],
    ],
    'Build Skip Reminder Report' => [
        'action' => 'ingest',
        'exec_id' => '20',
        'items' => [[
            'status' => 'skipped',
            'calendar_event_id' => 'skipEvt',
            'skip_reason' => 'cancelled',
            'patient_name' => 'Omitido',
        ]],
    ],
]);

$pdo = rem_fresh('rec1');
$execs = [
    10 => ['wf' => 'WF-REM', 'startedAt' => '2020-01-01T10:00:00.000Z', 'tree' => $oldTree],
];
$log = [];
$r = recordatorios_reconcile($pdo, 6, fake_n8n_rem($execs, 50, $log), $conf);
eq($r['status'], 'ok', 'primera corrida fija baseline');
eq($r['imported'], 0, 'baseline no importa corridas viejas');
eq(count_rem($pdo), 0, 'DB vacía tras baseline');
$st = recordatorios_reconcile_state();
ok(!empty($st['baseline_complete']), 'baseline_complete');
ok((int) ($st['baseline_ts'] ?? 0) > 0, 'baseline_ts seteado');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'oldEvt'")->fetchColumn(), 0, 'oldEvt no importado');

// Forzar baseline al pasado y agregar ejecución nueva
$st['baseline_ts'] = strtotime('2025-01-01T00:00:00Z');
recordatorios_write_atomic(recordatorios_reconcile_state_path(), json_encode($st));
$execs[20] = ['wf' => 'WF-REM', 'startedAt' => '2026-10-30T12:00:00.000Z', 'tree' => $newTree];
$execs[21] = ['wf' => 'OTRO', 'startedAt' => '2026-10-30T12:00:00.000Z', 'tree' => $newTree];
$log2 = [];
$r2 = recordatorios_reconcile($pdo, 6, fake_n8n_rem($execs, 50, $log2, false), $conf);
eq($r2['status'], 'ok', 'segunda corrida ok');
eq($r2['imported'], 2, 'importa sent + skipped de exec 20');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'oldEvt'")->fetchColumn(), 0, 'vieja sigue fuera');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'newEvt'")->fetchColumn(), 1, 'newEvt importado');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id = 'skipEvt'")->fetchColumn(), 1, 'skipEvt importado');

$r3 = recordatorios_reconcile($pdo, 6, fake_n8n_rem($execs, 50, $log2, false), $conf);
eq([$r3['status'], $r3['imported']], ['ok', 0], 're-reconcile no duplica');
eq(count(array_filter($log2, fn($l) => preg_match('#/rest/executions/20$#', $l))), 1, 'no re-fetch de done');

// push + pull misma clave
$pdo = rem_fresh('rec2');
$stPath = recordatorios_reconcile_state_path();
@unlink($stPath);
recordatorios_write_atomic($stPath, json_encode([
    'baseline_ts' => strtotime('2025-01-01T00:00:00Z'),
    'baseline_complete' => true,
    'done_ids' => [],
]));
$pushItem = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'newEvt',
    'patient_name' => 'Nuevo',
    'wa_id' => '5491188888888',
], '20', strtotime('2026-10-30T12:00:00Z'));
recordatorios_store_items([$pushItem], $pdo);
$only = [20 => $execs[20]];
$log3 = [];
recordatorios_reconcile($pdo, 6, fake_n8n_rem($only, 50, $log3, false), $conf);
eq(count_rem($pdo), 2, 'push sent + pull skipped = 2 (sent duplicado 0)');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE status = 'sent'")->fetchColumn(), 1, 'sent no duplicado');

// success vacío no se marca done; error vacío sí
$pdo = rem_fresh('rec3');
recordatorios_write_atomic(recordatorios_reconcile_state_path(), json_encode([
    'baseline_ts' => strtotime('2025-01-01T00:00:00Z'),
    'baseline_complete' => true,
    'done_ids' => [],
]));
$emptyTree = ['resultData' => ['runData' => []]];
$execsEmpty = [
    30 => ['wf' => 'WF-REM', 'status' => 'success', 'startedAt' => '2026-10-30T12:00:00.000Z', 'tree' => $emptyTree],
    31 => ['wf' => 'WF-REM', 'status' => 'error', 'startedAt' => '2026-10-30T12:00:00.000Z', 'tree' => $emptyTree],
];
$log4 = [];
$r4 = recordatorios_reconcile($pdo, 6, fake_n8n_rem($execsEmpty, 50, $log4, false), $conf);
eq($r4['status'], 'partial', 'success vacío => parcial');
$st4 = recordatorios_reconcile_state();
ok(!in_array(30, array_map('intval', $st4['done_ids'] ?? []), true), 'success vacío NO en done_ids');
ok(in_array(31, array_map('intval', $st4['done_ids'] ?? []), true), 'error vacío SÍ en done_ids');

echo $fails === 0 ? "OK recordatorios ($passed assertions)\n" : "FAIL recordatorios ($fails)\n";
exit($fails === 0 ? 0 : 1);
