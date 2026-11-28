<?php
declare(strict_types=1);

/**
 * Pruebas del almacén de recordatorios (normalize, idempotencia, vista, reconcile).
 * Con KT_DB_* + KT_TMP: persistencia + reconciliador + check_sent_map.
 * Sin DB: normalización, parse de árbol y contratos estáticos (incl. check_sent).
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
eq($run, null, 'run_skipped / Clara inactiva no se persiste en el historial');
eq(recordatorios_normalize_item(['status' => 'skipped', 'skip_reason' => 'clara_inactive', 'calendar_event_id' => 'x'], 'e1', 100), null, 'clara_inactive se rechaza');

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
eq(recordatorios_clean_wa_id('541161607595'), '5491161607595', '5411… se normaliza a 54911…');
eq(recordatorios_clean_wa_id('+54 9 11 6160-7595'), '5491161607595', 'formato visual AR → 54911…');
eq($sent['event_key'], 'rem:n8n-1:calABC:sent', 'clave sent');
$sentMail = recordatorios_normalize_item([
    'status' => 'sent_email',
    'calendar_event_id' => 'calMail',
    'patient_name' => 'Ana',
    'error_message' => 'ana@example.com',
], 'n8n-1b', 1700000001);
eq($sentMail['status'] ?? '', 'sent_email', 'status sent_email aceptado');
eq($sentMail['event_key'], 'rem:n8n-1b:calMail:sent_email', 'clave sent_email');

$pending = recordatorios_normalize_item([
    'status' => 'pending',
    'calendar_event_id' => 'calPending',
    'patient_name' => 'Valeria',
    'wa_id' => '5491122334455',
    'appointment_date' => '2026-11-01',
    'appointment_time' => '11:00 hs',
], 'n8n-1c', 1700000002);
eq($pending['status'] ?? '', 'pending', 'status pending aceptado');
eq($pending['event_key'], 'rem:n8n-1c:calPending:pending', 'clave pending');
eq(recordatorios_status_label('pending'), 'A enviar', 'label a enviar');

$badSkip = recordatorios_normalize_item([
    'status' => 'skipped',
    'calendar_event_id' => 'c1',
    'skip_reason' => 'weird_reason',
], 'e', 1);
eq($badSkip['skip_reason'], 'other', 'skip_reason desconocido → other');

eq(recordatorios_normalize_item([
    'status' => 'skipped',
    'calendar_event_id' => 'c_no_dar',
    'skip_reason' => 'blocked',
    'patient_name' => 'No dar',
], 'e', 1), null, 'skip_reason blocked se descarta por completo');

eq(recordatorios_normalize_item([
    'status' => 'pending',
    'calendar_event_id' => 'c_no_dar_2',
    'patient_name' => 'No dar turno',
], 'e', 1), null, 'patient_name No dar turno se descarta');

eq(recordatorios_is_blocked_event(['patient_name' => 'No dar', 'event_summary' => '']), true, 'recordatorios_is_blocked_event detecta No dar');
eq(recordatorios_is_blocked_event(['patient_name' => 'Augusto Oviedo', 'event_summary' => '']), false, 'recordatorios_is_blocked_event permite paciente real');

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

section('Contrato anti-pending-tras-sent + sync placeholder');
$storeSrc = file_get_contents($root . '/admin/api/lib_recordatorios_store_recordatorios_store_items.php') ?: '';
ok(str_contains($storeSrc, 'recordatorios_was_sent_for_event'), 'store consulta was_sent antes de pending');
ok(str_contains($storeSrc, 'recordatorios_sync_paciente_from_event'), 'store sincroniza pacientes');
ok(is_file($root . '/admin/api/lib_recordatorios_store_recordatorios_sync_paciente.php'), 'existe sync_paciente');
$syncSrc = file_get_contents($root . '/admin/api/lib_recordatorios_store_recordatorios_sync_paciente.php') ?: '';
ok(str_contains($syncSrc, 'sin-tel-cal-'), 'placeholder sin-tel-cal para nombre sin teléfono');
$viewSrc = (file_get_contents($root . '/admin/api/lib_recordatorios_view_recordatorios_load_view.php') ?: '')
    . "\n"
    . (file_get_contents($root . '/admin/api/lib_recordatorios_view_cleanup.php') ?: '');
ok(str_contains($viewSrc, "pend.status IN ('pending', 'missing_phone')") || str_contains($viewSrc, "pend.status = 'pending'"), 'vista borra pending si ya hay sent');

section('Contrato check_sent (bot anti-reenvío)');
$routesSrc = file_get_contents($root . '/admin/api/recordatorios_routes.php') ?: '';
ok(str_contains($routesSrc, "'check_sent'"), 'ruta acepta action check_sent');
ok(str_contains($routesSrc, 'recordatorios_check_sent_map'), 'ruta responde con check_sent_map');
ok(str_contains($routesSrc, 'sent_phones'), 'ruta expone sent_phones');
ok(str_contains($routesSrc, 'sent_phone_people'), 'ruta expone sent_phone_people');
ok(str_contains($routesSrc, 'patient_name'), 'ruta acepta patient_name en items');
$wasSentSrc = file_get_contents($root . '/admin/api/lib_recordatorios_store_recordatorios_was_sent_for_event.php') ?: '';
ok(str_contains($wasSentSrc, 'function recordatorios_check_sent_map'), 'existe check_sent_map');
ok(str_contains($wasSentSrc, 'IN ($placeholders)'), 'check_sent_map usa IN batch');
ok(str_contains($wasSentSrc, 'foreach ($ids as $cal)'), 'check_sent_map fail-closed itera ids');
ok(
    preg_match('/catch\s*\(Throwable[^\)]*\)\s*\{[^}]*\$out\[\$cal\]\s*=\s*true/s', $wasSentSrc) === 1,
    'check_sent_map catch marca todos true (fail-closed)'
);
ok(
    preg_match('/catch\s*\(Throwable[^\)]*\)\s*\{[^}]*return true/s', $wasSentSrc) === 1,
    'was_sent_for_event catch retorna true (fail-closed)'
);
eq(recordatorios_check_sent_map([]), [], 'check_sent_map vacío => []');
eq(recordatorios_check_sent_map(['', '_run']), [], 'ignora ids vacíos y _run');
$phonesSrc = file_get_contents($root . '/admin/api/lib_recordatorios_store_recordatorios_check_sent_phones.php') ?: '';
ok(str_contains($phonesSrc, 'function recordatorios_check_sent_phones_map'), 'existe check_sent_phones_map');
ok(str_contains($phonesSrc, 'kinesica_names_compatible'), 'phones map respeta nombres compatibles');
eq(recordatorios_check_sent_phones_map([]), [], 'check_sent_phones_map vacío => []');

section('Contrato check_alive (TC-50 Calendar vivo)');
require_once $root . '/admin/api/lib_recordatorios_calendar_verify.php';
ok(str_contains($routesSrc, "'check_alive'"), 'ruta acepta action check_alive');
ok(str_contains($routesSrc, 'recordatorios_check_alive_map'), 'ruta responde con check_alive_map');
ok(function_exists('recordatorios_calendar_event_is_sendable'), 'existe is_sendable');
$testAlive = recordatorios_calendar_event_is_sendable('test:unit-1');
eq($testAlive['ok'] ?? null, true, 'casos test:… se consideran sendable');
eq($testAlive['reason'] ?? null, 'test', 'reason test');
$missing = recordatorios_calendar_event_is_sendable('');
eq($missing['ok'] ?? null, false, 'sin event id => no sendable');
eq($missing['reason'] ?? null, 'missing_event_id', 'reason missing_event_id');
$aliveEmpty = recordatorios_check_alive_map([]);
eq($aliveEmpty['ok'] ?? null, true, 'check_alive_map vacío ok');
eq($aliveEmpty['alive'] ?? null, [], 'check_alive_map vacío alive=[]');
$aliveTest = recordatorios_check_alive_map(['test:a', 'test:a', '']);
eq($aliveTest['alive']['test:a'] ?? null, true, 'check_alive_map test id alive');
eq($aliveTest['reasons']['test:a'] ?? null, 'test', 'check_alive_map test reason');
$samedaySrc = file_get_contents($root . '/admin/api/lib_recordatorios_sameday_recordatorios_sameday_process_appointment.php') ?: '';
ok(str_contains($samedaySrc, 'recordatorios_calendar_event_is_sendable'), 'sameday revalida Calendar pre-send');
$manualSrc = file_get_contents($root . '/admin/api/recordatorios_dispatch_manual_recordatorios_dispatch_manual.php') ?: '';
ok(str_contains($manualSrc, 'recordatorios_calendar_event_is_sendable'), 'dispatch manual revalida Calendar');

section('check_sent_map / was_sent fail-closed ante PDO roto');
final class RemThrowingPreparePdo extends PDO
{
    public function __construct()
    {
        parent::__construct('sqlite::memory:');
        $this->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    #[\ReturnTypeWillChange]
    public function prepare($query, $options = [])
    {
        throw new RuntimeException('forced db failure for fail-closed test');
    }
}
$brokenPdo = new RemThrowingPreparePdo();
$failMap = recordatorios_check_sent_map(['cal-fail-a', 'cal-fail-b'], $brokenPdo);
eq($failMap['cal-fail-a'] ?? null, true, 'check_sent_map DB error => true (a)');
eq($failMap['cal-fail-b'] ?? null, true, 'check_sent_map DB error => true (b)');
ok(recordatorios_was_sent_for_event('cal-fail-a', $brokenPdo), 'was_sent DB error => true');
$failPhones = recordatorios_check_sent_phones_map(['5491100000099'], $brokenPdo);
eq($failPhones['5491100000099'] ?? null, true, 'check_sent_phones_map DB error => true');
ok(recordatorios_was_sent_for_phone('5491100000099', $brokenPdo), 'was_sent_for_phone DB error => true');

section('phone_matches_sent_people (exacto / sufijo / compartido)');
$peopleJuan = [[
    'digits' => '5491164813623',
    'suffix' => '64813623',
    'name' => 'Juan Perez',
]];
ok(
    recordatorios_phone_matches_sent_people('5491164813623', '', $peopleJuan),
    'match exacto sin nombre candidato => true'
);
ok(
    recordatorios_phone_matches_sent_people('1164813623', 'Juan Perez', $peopleJuan),
    'match sufijo 8 + mismo nombre => true'
);
ok(
    recordatorios_phone_matches_sent_people('5491164813623', 'Juan Perez', $peopleJuan),
    'match exacto + mismo nombre => true'
);
ok(
    !recordatorios_phone_matches_sent_people('5491164813623', 'Maria Lopez', $peopleJuan),
    'teléfono compartido nombre distinto => false'
);
ok(
    !recordatorios_phone_matches_sent_people('5491100000000', 'Juan Perez', $peopleJuan),
    'otro teléfono => false'
);

section('Frase amigable de cuándo (BA)');
require_once $root . '/admin/api/pacientes_helpers_search_key.php';
$tz = recordatorios_tz();
$today = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
$tomorrow = (new DateTimeImmutable('now', $tz))->modify('+1 day')->format('Y-m-d');
$later = (new DateTimeImmutable('now', $tz))->modify('+3 day')->format('Y-m-d');
$hoyPhrase = recordatorios_format_when_phrase($today, '16:00');
ok(str_starts_with($hoyPhrase, 'hoy '), 'hoy + fecha amigable: ' . $hoyPhrase);
ok(str_contains($hoyPhrase, 'a las 16:00 hs'), 'incluye hora con hs');
$mananaPhrase = recordatorios_format_when_phrase($tomorrow, '10:30 hs');
ok(str_starts_with($mananaPhrase, 'mañana '), 'mañana + fecha: ' . $mananaPhrase);
$elPhrase = recordatorios_format_when_phrase($later, '09:00');
ok(str_starts_with($elPhrase, 'el '), 'día no relativo usa "el": ' . $elPhrase);
$convenir = recordatorios_format_when_phrase($today, 'a convenir');
ok(str_contains($convenir, 'horario a convenir'), 'all-day / a convenir');
eq(recordatorios_format_when_phrase('', '16:00'), 'mañana a las 16:00 hs', 'sin fecha asume mañana');

section('Limpieza de teléfonos sucios');
eq(clean_phone_number('WhatsApp: 11 1234-5678'), '5491112345678', 'prefijo WhatsApp');
eq(clean_phone_number('1155551212 / 1144443333'), '5491155551212', 'toma el primero de varios');
eq(clean_phone_number('11 5555-1212 (celular)'), '5491155551212', 'quita aclaración entre paréntesis');
eq(clean_phone_number('fijo 4711-2233'), '5491147112233', 'descarta palabra fijo');
eq(clean_phone_number('tel: +54 9 11 5555-1212'), '5491155551212', 'prefijo tel + intl');

section('Compatibilidad de nombres e inversión Leiro / Benamo');
ok(!kinesica_names_compatible('Andrea Leiro', 'Elías Benamo'), 'Andrea Leiro y Elías Benamo son nombres incompatibles');
ok(kinesica_names_compatible('Andrea Leiro', 'Leiro Andrea'), 'Andrea Leiro y Leiro Andrea son nombres compatibles');
ok(kinesica_names_compatible('Daniel Eduardo Martirena', 'Daniel Martirena'), 'Daniel Eduardo Martirena y Daniel Martirena son compatibles');
$rowFormatted = recordatorios_format_item([
    'id' => 99,
    'patient_name' => 'Leiro Andrea',
    'status' => 'sent',
    'wa_id' => '5491144756562',
    'appointment_date' => '2026-11-27',
    'appointment_time' => '13:00 hs',
]);
eq($rowFormatted['patient_name'], 'Andrea Leiro', 'Leiro Andrea se formatea canónicamente a Andrea Leiro');

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

section('Pending tras sent se ignora; missing_phone crea paciente placeholder');
$pdo = rem_fresh('sent-pending');
ensure_pacientes_tables($pdo);
$pdo->exec("DELETE FROM pacientes WHERE telefono LIKE 'sin-tel-cal-%' OR telefono = '5491100000099'");
$sentEv = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'cal-sent-1',
    'patient_name' => 'Ana Enviada',
    'wa_id' => '5491100000099',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'fix-sent', time());
eq(recordatorios_store_items([$sentEv], $pdo)['stored'], 1, 'guarda sent');
$pendingEv = recordatorios_normalize_item([
    'status' => 'pending',
    'calendar_event_id' => 'cal-sent-1',
    'patient_name' => 'Ana Enviada',
    'wa_id' => '5491100000099',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'fix-prev', time() + 60);
$pendRes = recordatorios_store_items([$pendingEv], $pdo);
eq($pendRes['duplicates'], 1, 'pending tras sent = duplicate');
eq($pendRes['stored'], 0, 'no inserta pending tras sent');
eq((int) $pdo->query("SELECT COUNT(*) FROM recordatorio_eventos WHERE calendar_event_id='cal-sent-1' AND status='pending'")->fetchColumn(), 0, 'sin filas pending');

$missEv = recordatorios_normalize_item([
    'status' => 'missing_phone',
    'calendar_event_id' => 'cal-miss-walter',
    'patient_name' => 'Mira Walter',
    'wa_id' => '',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'fix-miss', time());
eq(recordatorios_store_items([$missEv], $pdo)['stored'], 1, 'guarda missing_phone');
$ph = (string) $pdo->query("SELECT telefono FROM pacientes WHERE nombre_completo = 'Mira Walter' LIMIT 1")->fetchColumn();
ok(str_starts_with($ph, 'sin-tel-cal-'), 'paciente placeholder sin-tel-cal-*');
$viewMiss = recordatorios_load_view($pdo, 14);
$pendingAfterSent = array_filter(
    $viewMiss['items'],
    static fn($i) => ($i['calendar_event_id'] ?? '') === 'cal-sent-1' && ($i['status'] ?? '') === 'pending'
);
eq(count($pendingAfterSent), 0, 'vista no muestra pending si hay sent');

section('check_sent_map refleja sent/sent_email');
$pdo = rem_fresh('check-sent');
$sentA = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'cal-check-a',
    'patient_name' => 'Check A',
    'wa_id' => '5491100000011',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'cs-a', time());
$sentB = recordatorios_normalize_item([
    'status' => 'sent_email',
    'calendar_event_id' => 'cal-check-b',
    'patient_name' => 'Check B',
    'wa_id' => '',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'cs-b', time());
$pendC = recordatorios_normalize_item([
    'status' => 'pending',
    'calendar_event_id' => 'cal-check-c',
    'patient_name' => 'Check C',
    'wa_id' => '5491100000013',
    'appointment_date' => date('Y-m-d', strtotime('+1 day')),
], 'cs-c', time());
recordatorios_store_items([$sentA, $sentB, $pendC], $pdo);
$map = recordatorios_check_sent_map(['cal-check-a', 'cal-check-b', 'cal-check-c', 'cal-check-missing'], $pdo);
eq($map['cal-check-a'] ?? null, true, 'sent => true');
eq($map['cal-check-b'] ?? null, true, 'sent_email => true');
eq($map['cal-check-c'] ?? null, false, 'pending => false');
eq($map['cal-check-missing'] ?? null, false, 'ausente => false');
ok(recordatorios_was_sent_for_event('cal-check-a', $pdo), 'was_sent alineado con mapa');
ok(!recordatorios_was_sent_for_event('cal-check-c', $pdo), 'pending no cuenta como sent');

$tomorrow = date('Y-m-d', strtotime('+1 day'));
$futureDate = date('Y-m-d', strtotime('+5 days'));
$mapDateOk = recordatorios_check_sent_map(['cal-check-a'], $tomorrow, $pdo);
eq($mapDateOk['cal-check-a'] ?? null, true, 'sent con fecha coincidente => true');
$mapDateRescheduled = recordatorios_check_sent_map(['cal-check-a'], $futureDate, $pdo);
eq($mapDateRescheduled['cal-check-a'] ?? null, false, 'sent con fecha distinta (reagendado) => false');
ok(recordatorios_was_sent_for_event('cal-check-a', $tomorrow, $pdo), 'was_sent con fecha coincidente => true');
ok(!recordatorios_was_sent_for_event('cal-check-a', $futureDate, $pdo), 'was_sent con fecha reagendada => false');

section('check_sent_phones_map match exacto / sufijo / teléfono compartido');
$pdo = rem_fresh('check-phones');
$juanSent = recordatorios_normalize_item([
    'status' => 'sent',
    'calendar_event_id' => 'cal-phone-juan',
    'patient_name' => 'Juan Perez',
    'wa_id' => '5491164813623',
    'appointment_date' => $tomorrow,
], 'ph-juan', time());
recordatorios_store_items([$juanSent], $pdo);

$exact = recordatorios_check_sent_phones_map(['5491164813623'], $tomorrow, $pdo);
eq($exact['5491164813623'] ?? null, true, 'match exacto de teléfono => true');

$suffix = recordatorios_check_sent_phones_map(['1164813623'], $tomorrow, $pdo);
eq($suffix['1164813623'] ?? null, true, 'match por sufijo 8 dígitos => true');

$samePerson = recordatorios_check_sent_phones_map(
    ['5491164813623'],
    $tomorrow,
    $pdo,
    ['5491164813623' => 'Juan Perez']
);
eq($samePerson['5491164813623'] ?? null, true, 'mismo nombre compatible => true');

$sharedSpouse = recordatorios_check_sent_phones_map(
    ['5491164813623'],
    $tomorrow,
    $pdo,
    ['5491164813623' => 'Maria Lopez']
);
eq($sharedSpouse['5491164813623'] ?? null, false, 'teléfono compartido nombre distinto => false');

ok(
    recordatorios_was_sent_for_phone('5491164813623', $tomorrow, $pdo, 'Juan Perez'),
    'was_sent_for_phone mismo paciente => true'
);
ok(
    !recordatorios_was_sent_for_phone('5491164813623', $tomorrow, $pdo, 'Maria Lopez'),
    'was_sent_for_phone cónyuge distinto => false'
);

$mapByPhone = recordatorios_check_sent_map(
    ['cal-phone-maria-new', 'cal-phone-juan-new'],
    $tomorrow,
    $pdo,
    [
        'cal-phone-maria-new' => '5491164813623',
        'cal-phone-juan-new' => '5491164813623',
    ],
    [
        'cal-phone-maria-new' => 'Maria Lopez',
        'cal-phone-juan-new' => 'Juan Perez',
    ]
);
eq($mapByPhone['cal-phone-maria-new'] ?? null, false, 'check_sent_map no suprime cónyuge por teléfono');
eq($mapByPhone['cal-phone-juan-new'] ?? null, true, 'check_sent_map suprime mismo paciente por teléfono');

echo $fails === 0 ? "OK recordatorios ($passed assertions)\n" : "FAIL recordatorios ($fails)\n";
exit($fails === 0 ? 0 : 1);
