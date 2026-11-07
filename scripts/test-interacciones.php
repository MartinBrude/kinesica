<?php
declare(strict_types=1);

/**
 * Pruebas REALES (PHP + MariaDB/MySQL) del almacén durable de interacciones.
 * Ejecutar con: node scripts/verify-interacciones-store.mjs
 */

$root = dirname(__DIR__);
foreach (['state', 'view', 'migrate', 'n8n', 'n8n_io', 'spool', 'store', 'sla'] as $lib) {
    require_once $root . "/admin/api/lib_interacciones_$lib.php";
}

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

function db_dsn(): string
{
    return sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', getenv('KT_DB_HOST'), (int) getenv('KT_DB_PORT'), getenv('KT_DB_NAME'));
}
function new_pdo(): PDO
{
    return new PDO(db_dsn(), (string) getenv('KT_DB_USER'), (string) getenv('KT_DB_PASS'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
}
function fresh(string $name): PDO
{
    $dir = getenv('KT_TMP') . '/' . $name . '-' . bin2hex(random_bytes(3));
    mkdir($dir, 0755, true);
    putenv('KINESICA_INTERACCIONES_DIR=' . $dir);
    $pdo = new_pdo();
    $pdo->exec('DROP TABLE IF EXISTS interaccion_eventos');
    $pdo->exec('DROP TABLE IF EXISTS interaccion_estado');
    $pdo = new_pdo();
    interacciones_ensure_schema($pdo);
    return $pdo;
}
function count_events(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM interaccion_eventos')->fetchColumn();
}
function ev(string $wa, string $dir, string $body, int $ts, string $mid = ''): array
{
    $e = interacciones_normalize_event(['wa_id' => $wa, 'direction' => $dir, 'body' => $body, 'ts' => $ts, 'message_id' => $mid], 'test');
    if ($e === null) {
        throw new RuntimeException('evento de prueba inválido');
    }
    return $e;
}

// ---------------------------------------------------------------- normalización
section('Normalización de eventos');
eq(interacciones_normalize_event(['wa_id' => '123', 'direction' => 'patient', 'body' => 'x']), null, 'wa_id corto se rechaza');
eq(interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'bot', 'body' => 'x']), null, 'dirección inválida se rechaza');
eq(interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'patient', 'body' => '   ']), null, 'cuerpo vacío se rechaza');
$n = interacciones_normalize_event(['wa_id' => '+54 9 11 0000-0001', 'direction' => 'patient', 'body' => ' hola ', 'message_id' => 'wamid.ABC=', 'ts' => '1790000000'], 'push', 1);
eq($n['wa_id'], '5491100000001', 'wa_id se reduce a dígitos');
eq($n['event_key'], 'wa:wamid.ABC=', 'clave por id de mensaje');
eq($n['body'], 'hola', 'cuerpo recortado');
eq($n['ts'], 1790000000, 'ts epoch en string');
$c = interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'clara', 'body' => 'r', 'message_id' => 'wamid.ABC='], 'push', 1);
eq($c['event_key'], 'wa:wamid.ABC=:r', 'clave de respuesta distinta de la del paciente');
$x = interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'patient', 'body' => 'x', 'exec_id' => '77']);
eq($x['event_key'], 'ex:77:patient', 'clave por ejecución');
$iso = interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'patient', 'body' => 'x', 'ts' => '2026-10-29T10:00:00Z']);
eq($iso['ts'], 1793268000, 'ts ISO-8601');
$long = interacciones_normalize_event(['wa_id' => '5491100000001', 'direction' => 'patient', 'body' => str_repeat('á', 20000)]);
eq(mb_strlen($long['body'], 'UTF-8'), INTERACCIONES_MAX_BODY, 'cuerpo gigante se acota sin romper UTF-8');

// ---------------------------------------------------------------- idempotencia
section('Inserción idempotente y sin pérdida');
$pdo = fresh('idem');
$a = ev('5491100000001', 'patient', 'hola', 1790000000, 'M1');
eq(interacciones_insert_event($pdo, $a), 'stored', 'primer insert');
eq(interacciones_insert_event($pdo, $a), 'duplicate', 'reintento idéntico = duplicado');
$a2 = $a;
$a2['body'] = 'otro texto con la misma clave';
eq(interacciones_insert_event($pdo, $a2), 'stored', 'misma clave con texto distinto NO se descarta');
eq(count_events($pdo), 2, 'quedan 2 eventos');
$res = interacciones_store_events([$a, ev('5491100000001', 'clara', 'resp', 1790000001, 'M1'), $a], $pdo);
eq([$res['stored'], $res['duplicates']], [1, 2], 'lote con duplicados');
$rep = interacciones_store_events([ev('5491100000001', 'clara', 'Menú', 1790000100), ev('5491100000001', 'clara', 'Menú', 1790000101)], $pdo);
eq($rep['stored'], 2, 'dos respuestas idénticas en segundos distintos se conservan ambas');

// ---------------------------------------------------------------- spool
section('BD caída => spool => drenaje');
$pdo = fresh('spool');
$broken = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$batch = [ev('5491100000002', 'patient', 'uno', 1790000000, 'S1'), ev('5491100000002', 'clara', 'dos', 1790000001, 'S1')];
$r = interacciones_store_events($batch, $broken);
eq([$r['stored'], $r['spooled'], $r['failed']], [0, 2, 0], 'con BD rota los eventos van al spool');
eq(interacciones_spool_pending_count(), 2, 'spool tiene 2 líneas');
$d = interacciones_spool_drain($broken, 2);
eq($d['remaining'], 2, 'drenar con BD rota no pierde nada');
ok(count(glob(interacciones_spool_dir() . '/*.jsonl')) >= 1, 'el archivo del spool se conserva');
$d = interacciones_spool_drain($pdo, 2);
eq([count_events($pdo), $d['remaining']], [2, 0], 'drenar con BD sana guarda todo y vacía el spool');
interacciones_spool_append($batch);
interacciones_spool_drain($pdo, 2);
eq(count_events($pdo), 2, 'reprocesar lote ya guardado no duplica');
eq(interacciones_spool_append([]), true, 'append vacío es no-op');
// Fallo a mitad del drenaje (la tabla desaparece): el lote rotado se conserva y luego se recupera.
$pdo = fresh('spool2');
interacciones_spool_append([ev('5491100000002', 'patient', 'persistente', 1790000500, 'S2')]);
$pdo->exec('RENAME TABLE interaccion_eventos TO interaccion_eventos_off');
$d = interacciones_spool_drain($pdo, 2);
eq($d['remaining'], 1, 'si el insert falla, el lote rotado sigue pendiente');
$pdo->exec('RENAME TABLE interaccion_eventos_off TO interaccion_eventos');
$d = interacciones_spool_drain($pdo, 2);
eq([count_events($pdo), $d['remaining']], [1, 0], 'se recupera cuando la BD vuelve');
// Líneas JSON corruptas: se cuarentenan, no se pierden al borrar el batch.
$pdo = fresh('spool3');
$spoolDir = interacciones_spool_dir();
file_put_contents($spoolDir . '/pending.jsonl', "{no-json\n" . json_encode(ev('5491100000003', 'patient', 'ok-tras-corrupto', 1790000600, 'S3')) . "\n");
$d = interacciones_spool_drain($pdo, 2);
eq([count_events($pdo), $d['remaining']], [1, 0], 'línea válida se guarda y el spool queda vacío');
$corruptFiles = glob($spoolDir . '/corrupt-*.jsonl') ?: [];
eq(count($corruptFiles), 1, 'línea corrupta queda en corrupt-*.jsonl');
ok(str_contains((string) file_get_contents($corruptFiles[0]), '{no-json'), 'el contenido corrupto se conserva');

// ---------------------------------------------------------------- concurrencia
section('Concurrencia (procesos reales en paralelo)');
$pdo = fresh('conc');
$dir = (string) getenv('KINESICA_INTERACCIONES_DIR');
$procs = [];
$spawn = function (string $mode, int $n, int $id) use (&$procs, $root, $dir) {
    $env = array_merge(getenv(), ['KINESICA_INTERACCIONES_DIR' => $dir]);
    $p = proc_open([PHP_BINARY, $root . '/scripts/test-interacciones-worker.php', $mode, (string) $n, (string) $id], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root, $env);
    $procs[] = [$p, $pipes];
};
for ($i = 0; $i < 6; $i++) {
    $spawn('store', 40, $i);
    $spawn('spool', 40, 10 + $i);
}
$spawn('drain', 60, 0);
$spawn('drain', 60, 1);
$bad = 0;
foreach ($procs as [$p, $pipes]) {
    stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    if (proc_close($p) !== 0 || trim($err) !== '') {
        $bad++;
        echo "    worker error: $err\n";
    }
}
eq($bad, 0, 'ningún trabajador falló');
for ($i = 0; $i < 10 && interacciones_spool_pending_count() > 0; $i++) {
    interacciones_spool_drain($pdo, 3);
}
eq(interacciones_spool_pending_count(), 0, 'spool vacío al final');
eq(count_events($pdo), 12 * 40, '480 eventos, ninguno perdido ni duplicado');
eq((int) $pdo->query('SELECT COUNT(DISTINCT event_key) FROM interaccion_eventos')->fetchColumn(), 480, 'claves únicas');

// ---------------------------------------------------------------- vista
section('Vista: agrupación, orden, gemelos, nombre conocido');
$pdo = fresh('view');
$base = (new DateTimeImmutable('2026-10-29 12:00:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->getTimestamp();
interacciones_store_events([
    ev('5491100000003', 'patient', 'Hola, quiero turno', $base, 'V1'),
    ev('5491100000003', 'clara', 'Bienvenido', $base + 5, 'V1'),
    ev('5491100000003', 'patient', 'Hola, quiero turno', $base + 20),
    ev('5491100000003', 'patient', 'C', $base + 3600),
    ev('5491100000003', 'clara', 'Honorarios', $base + 3601),
    ev('5491100000003', 'clara', 'Honorarios', $base + 3700),
    ev('34658444935', 'patient', 'prueba', $base + 100),
    ev('5493410658444935', 'patient', 'otro numero que termina igual', $base + 200),
    ev('5491100000003', 'patient', 'Al día siguiente', $base + 86400 + 1000),
], $pdo);
$view = interacciones_load_view($pdo);
eq(count($view['items']), 4, '4 conversaciones (teléfono + día local)');
$byId = [];
foreach ($view['items'] as $it) {
    $byId[$it['id']] = $it;
}
$c1 = $byId['5491100000003_2026-10-29'];
$texts = array_map(fn($m) => $m['from'] . ':' . $m['text'], $c1['messages']);
eq($texts, ['patient:Hola, quiero turno', 'clara:Bienvenido', 'patient:C', 'clara:Honorarios', 'clara:Honorarios'], 'gemelo sin id oculto; respuestas repetidas legítimas conservadas');
eq($byId['34658444935_2026-10-29']['patient_name'], 'Martín Brude', 'número exacto identificado');
eq($byId['5493410658444935_2026-10-29']['patient_name'], '', 'número que solo termina igual NO se identifica');
eq($c1['category'], 'consulta_general', 'categoría por primer mensaje');
eq($view['unanswered_count'], 4, 'contadores');
eq($view['items'][0]['id'], '5491100000003_2026-10-30', 'orden: más reciente primero');
eq(count_events($pdo), 9, 'la vista no borra eventos (el gemelo sigue guardado)');

// ---------------------------------------------------------------- estado
section('Estado archivar / respondida');
$id = '5491100000003_2026-10-29';
eq(interacciones_set_state($pdo, $id, 'archive', 'Tester'), true, 'archivar');
eq(interacciones_set_state($pdo, $id, 'toggle_answered', 'Tester', true), true, 'marcar respondida');
$view = interacciones_load_view($pdo);
$it = array_values(array_filter($view['items'], fn($i) => $i['id'] === $id))[0];
eq([$it['archived'], $it['answered'], count($it['messages'])], [true, true, 5], 'flags aplicados y mensajes intactos');
eq($view['archived_count'], 1, 'contador archivadas');
interacciones_set_state($pdo, $id, 'unarchive', 'Tester');
eq(interacciones_set_state($pdo, 'no-existe', 'archive', 'T'), false, 'id inexistente => false');
eq(interacciones_set_state($pdo, '5499999999999_2026-10-29', 'archive', 'T'), false, 'conversación inexistente => false');
eq(count_events($pdo), 9, 'cambiar estado no toca eventos');

// ---------------------------------------------------------------- migración
section('Migración desde JSON legado');
$pdo = fresh('mig');
$legacy = [
    ['id' => 'exec_100', 'wa_id' => '5491100000004', 'patient_name' => 'Ana Prueba', 'date' => '2026-10-27', 'time' => '16:25', 'answered' => true,
        'answered_at' => '2026-10-27T17:00:00-03:00', 'archived' => false, 'category' => 'cobertura', 'category_label' => 'Cobertura', 'summary' => 'consulta OSDE',
        'messages' => [['from' => 'patient', 'time' => '16:24', 'text' => 'Hola'], ['from' => 'clara', 'time' => '16:24', 'text' => 'Menú'],
            ['from' => 'patient', 'time' => '16:25', 'text' => 'C'], ['from' => 'clara', 'time' => '16:25', 'text' => 'Menú']]],
    ['id' => 'exec_101', 'wa_id' => '34600111222', 'date' => '2026-10-28', 'time' => '10:00', 'archived' => true, 'archived_at' => '2026-10-28T12:00:00-03:00', 'summary' => 'solo resumen', 'messages' => []],
];
$legacyFile = interacciones_dir() . '/interacciones.json';
file_put_contents($legacyFile, json_encode($legacy));
$before = sha1_file($legacyFile);
$m = interacciones_migrate_legacy($pdo);
eq([$m['migrated'], $m['events'], $m['conversations']], [true, 5, 2], 'migra 5 eventos y 2 conversaciones');
eq(sha1_file($legacyFile), $before, 'el JSON legado no se modifica');
ok(count(glob(interacciones_backup_dir() . '/legacy-interacciones-*.json')) === 1, 'backup del legado creado');
eq(interacciones_migrate_legacy($pdo)['reason'] ?? '', 'already_migrated', 'segunda corrida no hace nada');
unlink(interacciones_dir() . '/interacciones.migrated.json');
interacciones_migrate_legacy($pdo);
eq(count_events($pdo), 5, 'repetir sin marcador no duplica (idempotente)');
$view = interacciones_load_view($pdo);
$a = array_values(array_filter($view['items'], fn($i) => $i['wa_id'] === '5491100000004'))[0];
eq([$a['answered'], $a['patient_name'], $a['category'], count($a['messages']), $a['messages'][0]['time']], [true, 'Ana Prueba', 'cobertura', 4, '16:24'], 'estado, nombre y horas preservados');
eq(interacciones_set_state($pdo, 'exec_100', 'archive', 'T'), true, 'id legado (pestaña vieja) sigue funcionando');
$sync = interacciones_legacy_items_to_events($legacy, 'sync_all');
interacciones_store_events($sync, $pdo);
eq(count_events($pdo), 5, 're-sincronizar con sync_all no duplica');
$pdo = fresh('mig2');
file_put_contents(interacciones_dir() . '/interacciones.json', '{corrupto');
$m = interacciones_migrate_legacy($pdo);
eq([$m['migrated'], $m['reason']], [false, 'unreadable_legacy'], 'JSON corrupto: no migra');
eq(file_get_contents(interacciones_dir() . '/interacciones.json'), '{corrupto', 'y el archivo se conserva');

// ---------------------------------------------------------------- backup / restore
section('Backup diario y restauración');
$pdo = fresh('bak');
interacciones_store_events([ev('5491100000005', 'patient', 'a', 1790000000, 'B1'), ev('5491100000005', 'clara', 'b', 1790000001, 'B1')], $pdo);
interacciones_set_state($pdo, '5491100000005_' . (new DateTimeImmutable('@1790000000'))->setTimezone(interacciones_tz())->format('Y-m-d'), 'archive', 'T');
$file = interacciones_backup_daily($pdo);
ok($file !== null && is_file($file), 'backup creado');
eq(interacciones_backup_daily($pdo), null, 'solo uno por día');
$pdo2 = fresh('bak-restore');
$rs = interacciones_restore_from_backup($file, $pdo2);
eq($rs['stored'], 2, 'restaura eventos en BD vacía');
eq(interacciones_load_view($pdo2)['archived_count'], 1, 'restaura estado');
eq(interacciones_restore_from_backup($file, $pdo2)['stored'], 0, 'restaurar dos veces no duplica');

// ---------------------------------------------------------------- flatted + reconciliador
section('Decodificador flatted y reconciliador n8n');
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
eq(interacciones_flatted_decode('[{"a":"1","b":"1","n":5},"compartido"]'), ['a' => 'compartido', 'b' => 'compartido', 'n' => 5], 'referencias compartidas y primitivos');
eq(interacciones_flatted_decode('no-json'), null, 'entrada inválida => null');
eq(interacciones_flatted_decode('[{"self":"0"}]') !== null, true, 'ciclos no cuelgan');

function tree(string $wa, string $msg, string $mid, int $ts, ?string $reply, string $name = ''): array
{
    $t = ['resultData' => ['runData' => ['Filter & Parse Message' => [['data' => ['main' => [[['json' => [
        'wa_id' => $wa, 'patient_message' => $msg, 'message_id' => $mid, 'timestamp' => (string) $ts, 'patient_name' => $name]]]]]]]]]];
    if ($reply !== null) {
        $t['resultData']['runData']['Format Validated Message'] = [['data' => ['main' => [[['json' => ['final_message' => $reply]]]]]]];
    }
    return $t;
}
function fake_n8n(array $execs, int $pageSize, array &$log, bool $needLogin = true, array $failDetail = []): callable
{
    $loggedIn = !$needLogin;
    return function (string $method, string $url) use (&$execs, $pageSize, &$log, &$loggedIn, $failDetail): array {
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
            if (in_array($id, $failDetail, true) || !isset($execs[$id])) {
                return ['status' => 500, 'body' => ''];
            }
            return ['status' => 200, 'body' => json_encode(['data' => ['data' => flat_encode($execs[$id]['tree'])]])];
        }
        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $ids = array_keys($execs);
        rsort($ids);
        $offset = isset($q['cursor']) ? (int) $q['cursor'] : 0;
        $slice = array_slice($ids, $offset, $pageSize);
        $results = array_map(fn($id) => ['id' => (string) $id, 'workflowId' => $execs[$id]['wf'], 'status' => $execs[$id]['status'] ?? 'success',
            'startedAt' => $execs[$id]['startedAt'] ?? '2026-10-29T10:00:00.000Z', 'stoppedAt' => '2026-10-29T10:00:05.000Z'], $slice);
        $next = $offset + $pageSize < count($ids) ? (string) ($offset + $pageSize) : null;
        return ['status' => 200, 'body' => json_encode(['data' => ['results' => $results, 'nextCursor' => $next]])];
    };
}
$conf = ['n8n_url' => 'https://n8n.test', 'n8n_user' => 'u', 'n8n_password' => 'p', 'n8n_workflow_id' => 'WF'];
$pdo = fresh('rec');
$execs = [];
for ($i = 1; $i <= 12; $i++) {
    $execs[$i] = ['wf' => 'WF', 'tree' => tree('549110000100' . ($i % 3), "mensaje $i", "wamid.R$i", 1790000000 + $i * 60, $i % 4 === 0 ? null : "respuesta $i")];
}
$execs[13] = ['wf' => 'OTRO', 'tree' => tree('5491100009999', 'ajeno', 'wamid.X', 1790000900, 'x')];
// Success sin payload: no se marca done (reintento). Error terminal vacío sí se cierra.
$execs[14] = ['wf' => 'WF', 'status' => 'success', 'tree' => ['resultData' => ['runData' => []]]];
$execs[16] = ['wf' => 'WF', 'status' => 'error', 'tree' => ['resultData' => ['runData' => []]]];
$log = [];
$r = interacciones_reconcile($pdo, 6, fake_n8n($execs, 5, $log), $conf);
eq($r['status'], 'partial', 'success vacío deja la corrida parcial (no cierra el id)');
ok(in_array('POST https://n8n.test/rest/login', $log, true), 'hizo login');
eq(count_events($pdo), 12 + 9, '12 mensajes de paciente + 9 respuestas (3 ejecuciones sin respuesta de Clara igual se guardan)');
eq((int) $pdo->query("SELECT COUNT(*) FROM interaccion_eventos WHERE body = 'ajeno'")->fetchColumn(), 0, 'workflow ajeno ignorado');
$stateAfter = interacciones_reconcile_state();
ok(!in_array(14, array_map('intval', $stateAfter['done_ids'] ?? []), true), 'exec success vacía NO está en done_ids');
ok(in_array(16, array_map('intval', $stateAfter['done_ids'] ?? []), true), 'exec error vacía SÍ se marca done');
// Quitar el success vacío para poder verificar idempotencia de lo ya importado
unset($execs[14]);
$log2 = [];
$r2 = interacciones_reconcile($pdo, 6, fake_n8n($execs, 5, $log2, false), $conf);
eq([$r2['status'], $r2['imported']], ['ok', 0], 'segunda corrida: nada nuevo');
eq(count(array_filter($log2, fn($l) => preg_match('#/rest/executions/\d+$#', $l))), 0, 'no vuelve a pedir detalle de lo ya importado');
$execs[15] = ['wf' => 'WF', 'tree' => tree('5491100001000', 'mensaje nuevo', 'wamid.R15', 1790001000, 'resp nueva')];
$r3 = interacciones_reconcile($pdo, 6, fake_n8n($execs, 5, $log2, false), $conf);
eq($r3['imported'], 2, 'importa solo la ejecución nueva');
// fallo transitorio: se reintenta
$pdo = fresh('rec2');
@unlink(interacciones_reconcile_state_path());
$log = [];
$r = interacciones_reconcile($pdo, 6, fake_n8n($execs, 50, $log, false, [3]), $conf);
eq($r['status'], 'partial', 'detalle fallido => parcial');
$ev3 = (int) $pdo->query("SELECT COUNT(*) FROM interaccion_eventos WHERE body = 'mensaje 3'")->fetchColumn();
eq($ev3, 0, 'la ejecución fallida aún no está');
$r = interacciones_reconcile($pdo, 6, fake_n8n($execs, 50, $log, false), $conf);
eq($r['status'], 'ok', 'siguiente corrida completa');
eq((int) $pdo->query("SELECT COUNT(*) FROM interaccion_eventos WHERE body = 'mensaje 3'")->fetchColumn(), 1, 'la ejecución fallida se recuperó');
eq(interacciones_reconcile($pdo, 6, null, null)['status'], 'not_configured', 'sin credenciales => not_configured (sin valores por defecto)');
// el reconciliador coexiste con el push (misma clave de WhatsApp => sin duplicados)
$pdo = fresh('rec3');
interacciones_store_events([ev('5491100001000', 'patient', 'mensaje nuevo', 1790001000, 'wamid.R15')], $pdo);
$only = [15 => $execs[15]];
interacciones_reconcile($pdo, 6, fake_n8n($only, 50, $log, false), $conf);
eq(count_events($pdo), 2, 'push + pull del mismo mensaje no duplican');

// ---------------------------------------------------------------- ventana por días
section('Vista: ventana por días (no tira de todo el historial)');
$pdo = fresh('days');
$now = time();
interacciones_store_events([
    ev('5491100002001', 'patient', 'viejo', $now - (40 * 86400), 'wamid.OLD'),
    ev('5491100002002', 'patient', 'reciente', $now - 3600, 'wamid.NEW'),
], $pdo);
$full = interacciones_load_view($pdo);
eq(count($full['items']), 2, 'sin days = historial completo');
eq($full['days'], null, 'days null sin filtro');
$win = interacciones_load_view($pdo, 7);
eq(count($win['items']), 1, '7 días excluye el de hace 40');
eq($win['items'][0]['wa_id'], '5491100002002', 'queda el reciente');
eq($win['days'], 7, 'days reflejado');
ok(is_string($win['since_utc']) && $win['since_utc'] !== '', 'since_utc presente');
eq($win['events_capped'], false, 'pocos eventos no capean');
$clamped = interacciones_load_view($pdo, 999);
eq($clamped['days'], INTERACCIONES_MAX_DAYS, 'days se acota al máximo');

// ---------------------------------------------------------------- directorio de pacientes
section('Vista: asocia teléfono al nombre del directorio de pacientes');
require_once $root . '/admin/api/pacientes_helpers.php';
eq(interacciones_phone_match_key('5491167406801'), '1167406801', 'match key WA AR');
eq(interacciones_phone_match_key('+54 9 11 6740-6801'), '1167406801', 'match key formateado');
eq(interacciones_phone_match_key('15 6740 6801'), '1167406801', 'match key 15… → 11…');
eq(interacciones_phone_format('5491167406801'), '(+54) 9 11 6740 6801', 'formato display Alejandro');
eq(interacciones_clean_wa_id('541167406801'), '5491167406801', '54 11… sin 9 → 549 11…');
eq(interacciones_clean_wa_id('34658444935'), '34658444935', 'número ES no se fuerza a 549');

$pdo = fresh('dir-names');
ensure_pacientes_tables($pdo);
$pdo->exec('DELETE FROM pacientes WHERE telefono LIKE "%67406801%" OR telefono LIKE "%00009988%"');
$ins = $pdo->prepare(
    'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, origen)
     VALUES (:tel, :nom, :ape, :full, :pila, :origen)
     ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo), nombre = VALUES(nombre), apellido = VALUES(apellido)'
);
$ins->execute([
    'tel' => '5491167406801',
    'nom' => 'Alejandro',
    'ape' => 'Rosenfeld',
    'full' => 'Alejandro Rosenfeld',
    'pila' => 'Alejandro',
    'origen' => 'admin',
]);
$ins->execute([
    'tel' => '15 4555-9988',
    'nom' => 'Lucia',
    'ape' => 'Test',
    'full' => 'Lucía Test',
    'pila' => 'Lucía',
    'origen' => 'admin',
]);
$baseDir = (new DateTimeImmutable('2026-11-02 10:00:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->getTimestamp();
interacciones_store_events([
    ev('5491167406801', 'patient', 'Me hice un bloqueo radicular', $baseDir, 'DIR1'),
    ev('5491167406801', 'clara', '¿Querés hablar con un profesional?', $baseDir + 2, 'DIR1'),
    ev('5491145559988', 'patient', 'Hola', $baseDir + 10, 'DIR2'),
], $pdo);
$viewDir = interacciones_load_view($pdo);
$byDir = [];
foreach ($viewDir['items'] as $it) {
    $byDir[$it['wa_id']] = $it;
}
eq($byDir['5491167406801']['patient_name'], 'Alejandro Rosenfeld', 'Alejandro Rosenfeld asociado por teléfono');
eq($byDir['5491167406801']['phone_formatted'], '(+54) 9 11 6740 6801', 'teléfono formateado');
eq($byDir['5491145559988']['patient_name'], 'Lucía Test', 'asocia aunque el directorio tenga 15…');
// Sin fila en directorio → sigue vacío
interacciones_store_events([ev('5491199990001', 'patient', 'sin ficha', $baseDir + 20, 'DIR3')], $pdo);
$viewDir2 = interacciones_load_view($pdo);
$orphan = array_values(array_filter($viewDir2['items'], fn($i) => $i['wa_id'] === '5491199990001'))[0] ?? null;
eq($orphan['patient_name'] ?? 'missing', '', 'sin directorio no inventa nombre');
$pdo->exec('DELETE FROM pacientes WHERE telefono LIKE "%67406801%" OR telefono LIKE "%45559988%" OR telefono LIKE "%00009988%"');

section('Vista: ruido de prueba no queda pendiente');
$pdo = fresh('diag-noise');
$dBase = (new DateTimeImmutable('2026-11-02 13:30:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->getTimestamp();
interacciones_store_events([
    ev('5491100998877', 'patient', 'test de diagnostico', $dBase, 'DIAG1'),
    ev('5491100998877', 'clara', 'respuesta de prueba', $dBase + 1, 'DIAG1'),
], $pdo);
// Forzar nombre "Test" como en el panel
$pdo->prepare('UPDATE interaccion_eventos SET patient_name = :n WHERE wa_id = :wa')->execute(['n' => 'Test', 'wa' => '5491100998877']);
$dView = interacciones_load_view($pdo);
eq($dView['items'][0]['answered'], true, 'hilo de prueba marcado respondido');
eq($dView['items'][0]['category'], 'prueba_admin', 'categoría prueba técnica');
eq($dView['unanswered_count'], 0, 'no ensucia pendientes');

section('Vista: confirmación de turno ya figura respondida');
ok(interacciones_is_turn_confirmation('Confirmo'), 'Confirmo');
ok(interacciones_is_turn_confirmation('✅ Confirmo'), 'emoji + Confirmo');
ok(interacciones_is_turn_confirmation('Confirmo 👍'), 'Confirmo + thumb');
ok(interacciones_is_turn_confirmation('confirmar_turno:evt123'), 'payload confirmar_turno');
ok(!interacciones_is_turn_confirmation('Hola, confirmo que voy y además quiero mover el turno'), 'texto largo no es solo confirmación');
$pdo = fresh('confirm-answered');
$cBase = (new DateTimeImmutable('2026-11-01 21:10:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->getTimestamp();
interacciones_store_events([
    ev('5491167406801', 'patient', 'Confirmo', $cBase, 'CONF1'),
    ev('5491167406801', 'clara', 'Gracias por confirmar tu turno 🙌', $cBase + 2, 'CONF1'),
], $pdo);
$cView = interacciones_load_view($pdo);
eq(count($cView['items']), 1, 'un hilo de confirmación');
eq($cView['items'][0]['answered'], true, 'confirmación marcada respondida');
eq($cView['items'][0]['category'], 'confirmacion_turno', 'categoría confirmación');
eq($cView['answered_count'], 1, 'contador answered');
eq($cView['unanswered_count'], 0, 'no queda pendiente');

section('Vista: fusiona hilos 54 11… y 549 11… del mismo día');
$pdo = fresh('merge-wa');
$mergeTs = (new DateTimeImmutable('2026-11-01 21:10:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
$pdo->prepare(
    'INSERT INTO interaccion_eventos (event_key, wa_id, direction, body, ts_utc, patient_name, source, received_at)
     VALUES (:k, :wa, :dir, :body, :ts, :name, :src, UTC_TIMESTAMP())'
)->execute(['k' => 'hist:54', 'wa' => '541167406801', 'dir' => 'patient', 'body' => 'Confirmo', 'ts' => $mergeTs, 'name' => '', 'src' => 'test']);
$pdo->prepare(
    'INSERT INTO interaccion_eventos (event_key, wa_id, direction, body, ts_utc, patient_name, source, received_at)
     VALUES (:k, :wa, :dir, :body, :ts, :name, :src, UTC_TIMESTAMP())'
)->execute(['k' => 'hist:549', 'wa' => '5491167406801', 'dir' => 'clara', 'body' => 'Gracias por confirmar', 'ts' => $mergeTs, 'name' => '', 'src' => 'test']);
ensure_pacientes_tables($pdo);
$pdo->prepare(
    'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, origen)
     VALUES (:tel, :nom, :ape, :full, :pila, :origen)
     ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo)'
)->execute([
    'tel' => '5491167406801', 'nom' => 'Alejandro', 'ape' => 'Rosenfeld',
    'full' => 'Alejandro Rosenfeld', 'pila' => 'Alejandro', 'origen' => 'admin',
]);
$mergeView = interacciones_load_view($pdo);
eq(count($mergeView['items']), 1, 'un solo contacto (fusiona formatos de teléfono)');
eq($mergeView['items'][0]['wa_id'], '5491167406801', 'wa_id canónico 549…');
eq($mergeView['items'][0]['phone_formatted'], '(+54) 9 11 6740 6801', 'un solo formato en UI');
eq(count($mergeView['items'][0]['messages']), 2, 'mensajes de ambos wa_id en el mismo hilo');
eq($mergeView['items'][0]['patient_name'], 'Alejandro Rosenfeld', 'nombre desde directorio tras fusionar');
$pdo->exec('DELETE FROM pacientes WHERE telefono LIKE "%67406801%"');

section('Archivos adjuntos (media_id, persistencia binaria y vista)');
$pdo = fresh('attachments');
$attTs = (new DateTimeImmutable('2026-11-04 14:30:00', new DateTimeZone('America/Argentina/Buenos_Aires')))->getTimestamp();
$attEv = interacciones_normalize_event([
    'wa_id' => '5491155667788',
    'direction' => 'patient',
    'body' => '[Envío de documento PDF / archivo adjunto: "orden_medica.pdf"]',
    'ts' => $attTs,
    'message_id' => 'wamid.ATT1',
    'patient_name' => 'Lucía Gómez',
    'media_id' => 'meta_doc_987654',
    'media_type' => 'documento',
    'media_mime' => 'application/pdf',
    'media_filename' => 'orden_medica.pdf',
], 'push');
$attReply = ev('5491155667788', 'clara', '¡Recibido! Ya le avisé al profesional.', $attTs + 2, 'wamid.ATT1');
interacciones_store_events([$attEv, $attReply], $pdo);

// Antes de subir el binario, la vista ya expone la metadata del adjunto con available=false
$attView1 = interacciones_load_view($pdo);
$msgAtt1 = $attView1['items'][0]['messages'][0]['attachment'] ?? null;
eq($attView1['items'][0]['has_attachment'] ?? false, true, 'conversación marca has_attachment=true');
eq($msgAtt1['media_id'] ?? null, 'meta_doc_987654', 'media_id en mensaje');
eq($msgAtt1['filename'] ?? null, 'orden_medica.pdf', 'filename en mensaje');
eq($msgAtt1['available'] ?? null, false, 'available=false antes de subir el binario');

// Subir binario PDF válido
$fakePdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n";
$saveRes = interacciones_media_save([
    'media_id' => 'meta_doc_987654',
    'data_base64' => base64_encode($fakePdf),
    'mime_type' => 'application/pdf',
    'filename' => 'orden_medica.pdf',
    'media_type' => 'documento',
    'wa_id' => '5491155667788',
    'message_id' => 'wamid.ATT1',
], $pdo);
eq($saveRes['ok'] ?? false, true, 'interacciones_media_save guarda PDF válido');

// Rechazar archivo ejecutable/HTML malicioso
$badSave = interacciones_media_save([
    'media_id' => 'meta_bad_111',
    'data_base64' => base64_encode('<!DOCTYPE html><script>alert(1)</script>'),
    'mime_type' => 'text/html',
    'filename' => 'exploit.html',
], $pdo);
eq($badSave['ok'] ?? true, false, 'interacciones_media_save rechaza text/html');

$resolved = interacciones_media_resolve('meta_doc_987654');
ok($resolved !== null && is_file($resolved['path']), 'interacciones_media_resolve encuentra el archivo en disco');
eq($resolved['mime_type'] ?? null, 'application/pdf', 'MIME resuelto es application/pdf');

$attView2 = interacciones_load_view($pdo);
$msgAtt2 = $attView2['items'][0]['messages'][0]['attachment'] ?? null;
eq($msgAtt2['available'] ?? false, true, 'available=true luego de guardar el binario');
eq($msgAtt2['url'] ?? '', '/admin/api/interacciones_media.php?media_id=meta_doc_987654', 'URL de visualización');
eq($msgAtt2['download_url'] ?? '', '/admin/api/interacciones_media.php?media_id=meta_doc_987654&download=1', 'URL de descarga');

// ---------------------------------------------------------------- SLA >3h → Norberto (1× por mensaje)
section('SLA sin respuesta (>3 h)');
$pdo = fresh('sla');
$arTz = new DateTimeZone('America/Argentina/Buenos_Aires');
$now = (new DateTimeImmutable('today 12:00:00', $arTz))->getTimestamp(); // dentro de 10–20 AR
$night = (new DateTimeImmutable('today 22:00:00', $arTz))->getTimestamp();
$oldTs = $now - (INTERACCIONES_SLA_SECONDS + 120);
$freshTs = $now - 600; // 10 min: aún no vence
eq(interacciones_sla_in_notify_window($now), true, '12:00 AR está en ventana de envío');
eq(interacciones_sla_in_notify_window($night), false, '22:00 AR está fuera de ventana');
eq(interacciones_sla_in_notify_window((new DateTimeImmutable('today 20:00:00', $arTz))->getTimestamp()), false, '20:00 AR ya no envía');
eq(interacciones_sla_in_notify_window((new DateTimeImmutable('today 10:00:00', $arTz))->getTimestamp()), true, '10:00 AR sí envía');
// Marcar bootstrap hecho para probar el envío real (en prod la 1ª corrida solo silencia backlog).
interacciones_sla_write_state(['bootstrapped' => true, 'bootstrapped_at' => gmdate('c'), 'last_run' => null]);
interacciones_store_events([
    ev('5491100000091', 'patient', 'Necesito que me contacten por un dolor de rodilla', $oldTs, 'sla-old-1'),
    ev('5491100000091', 'clara', 'Ya le avisamos al profesional', $oldTs + 5, 'sla-old-1r'),
    ev('5491100000092', 'patient', 'Consulta reciente', $freshTs, 'sla-fresh-1'),
], $pdo);

$sent = [];
$sender = static function (array $payload) use (&$sent): array {
    $sent[] = $payload;
    return ['ok' => true, 'via' => 'test'];
};
$sla1 = interacciones_sla_check($pdo, true, $sender, $now);
eq($sla1['due'] >= 1, true, 'detecta al menos un mensaje vencido');
eq($sla1['notified'], 1, 'notifica exactamente un hilo vencido');
eq(count($sent), 1, 'un solo envío WhatsApp');
ok(str_contains((string) ($sent[0]['body'] ?? ''), 'SIN RESPUESTA'), 'cuerpo de alerta SLA');
ok(str_contains((string) ($sent[0]['tpl_motivo'] ?? ''), 'SLA'), 'motivo de plantilla SLA');

$sent = [];
$sla2 = interacciones_sla_check($pdo, true, $sender, $now);
eq($sla2['notified'], 0, 'segunda pasada no reenvía');
eq($sla2['skipped'] >= 1, true, 'omite el mensaje ya notificado');
eq(count($sent), 0, 'cero envíos en la segunda pasada');

$row = $pdo->query("SELECT sla_notified_event_key FROM interaccion_estado WHERE conversation_key LIKE '5491100000091_%'")->fetch(PDO::FETCH_ASSOC);
ok(is_array($row) && str_contains((string) ($row['sla_notified_event_key'] ?? ''), 'sla-old-1'), 'persiste event_key notificado');

// Fuera de 10–20 AR: no envía ni reclama (el aviso espera a las 10).
$pdo = fresh('sla-night');
interacciones_sla_write_state(['bootstrapped' => true, 'bootstrapped_at' => gmdate('c'), 'last_run' => null]);
$nightOld = $night - (INTERACCIONES_SLA_SECONDS + 120);
interacciones_store_events([
    ev('5491100000094', 'patient', 'Pendiente de noche', $nightOld, 'sla-night-1'),
], $pdo);
$sent = [];
$slaNight = interacciones_sla_check($pdo, true, $sender, $night);
eq(!empty($slaNight['outside_hours']), true, 'marca outside_hours de noche');
eq($slaNight['notified'], 0, 'de noche no notifica');
eq(count($sent), 0, 'de noche: cero WhatsApp');
$nightRow = $pdo->query("SELECT sla_notified_event_key FROM interaccion_estado WHERE conversation_key LIKE '5491100000094_%'")->fetch(PDO::FETCH_ASSOC);
ok($nightRow === false || empty($nightRow['sla_notified_event_key']), 'de noche no reclama el mensaje');

// Bootstrap: la primera corrida no dispara WhatsApp sobre backlog histórico.
$pdo = fresh('sla-boot');
interacciones_sla_write_state([]); // sin bootstrapped
interacciones_store_events([
    ev('5491100000093', 'patient', 'Backlog viejo pendiente', $oldTs, 'sla-boot-1'),
], $pdo);
$sent = [];
$slaBoot = interacciones_sla_check($pdo, true, $sender, $now);
eq($slaBoot['notified'], 0, 'bootstrap no notifica backlog');
eq($slaBoot['skipped'] >= 1, true, 'bootstrap marca vencidos como omitidos');
eq(count($sent), 0, 'bootstrap: cero WhatsApp');
$bootState = interacciones_sla_read_state();
eq(!empty($bootState['bootstrapped']), true, 'queda bootstrapped=true');

echo "\n";
if ($fails > 0) {
    echo "❌ $fails comprobaciones fallaron ($passed OK)\n";
    exit(1);
}
echo "✅ interacciones (almacén durable, spool, concurrencia, migración, backup, reconciliador, SLA): $passed comprobaciones OK\n";
