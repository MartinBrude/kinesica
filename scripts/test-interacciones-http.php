<?php
declare(strict_types=1);

/**
 * Pruebas HTTP del endpoint real admin/api/interacciones.php (php -S + MariaDB):
 * autenticación del bot, solo lectura de Colaborador, el secreto del bot NO sirve para leer.
 */

$root = dirname(__DIR__);
$tmp = getenv('KT_TMP') . '/http-' . bin2hex(random_bytes(3));
mkdir($tmp . '/data', 0755, true);

$fails = 0;
$passed = 0;
function ok(bool $c, string $m): void
{
    global $fails, $passed;
    if ($c) {
        $passed++;
        return;
    }
    $fails++;
    echo "  ✗ FALLÓ: $m\n";
}
function eq($a, $b, string $m): void
{
    ok($a === $b, $m . ' (esperado ' . json_encode($b, JSON_UNESCAPED_UNICODE) . ', obtuvo ' . json_encode($a, JSON_UNESCAPED_UNICODE) . ')');
}

function write_config(string $path, array $extra): void
{
    $cfg = ['db' => ['host' => getenv('KT_DB_HOST'), 'port' => (int) getenv('KT_DB_PORT'), 'name' => getenv('KT_DB_NAME'), 'user' => getenv('KT_DB_USER'), 'pass' => getenv('KT_DB_PASS')]] + $extra;
    file_put_contents($path, '<?php return ' . var_export($cfg, true) . ';');
}

function start_server(string $tmp, string $name, array $cfgExtra, int $port): array
{
    global $root;
    $cfgFile = "$tmp/$name.config.php";
    write_config($cfgFile, $cfgExtra);
    $env = array_merge(getenv(), ['KINESICA_ADMIN_CONFIG' => $cfgFile, 'KINESICA_INTERACCIONES_DIR' => "$tmp/data-$name"]);
    mkdir("$tmp/data-$name", 0755, true);
    $p = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root . '/admin/api'], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/$name.log", 'w']], $pipes, $root, $env);
    for ($i = 0; $i < 50; $i++) {
        $s = @fsockopen('127.0.0.1', $port, $en, $es, 0.2);
        if ($s) {
            fclose($s);
            break;
        }
        usleep(100000);
    }
    return ['proc' => $p, 'base' => "http://127.0.0.1:$port", 'cfg' => $cfgFile, 'env' => $env];
}

function http(string $base, string $method, string $path, ?array $body = null, array $headers = []): array
{
    $h = array_merge(['Content-Type: application/json'], $headers);
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $h), 'content' => $body !== null ? json_encode($body) : '', 'ignore_errors' => true, 'timeout' => 20]]);
    $raw = @file_get_contents($base . $path, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $line, $m)) {
            $status = (int) $m[1];
        }
    }
    return ['status' => $status, 'json' => json_decode((string) $raw, true), 'raw' => (string) $raw];
}

function session_cookie(array $srv, string $role, string $name): array
{
    global $root, $tmp;
    $script = "$tmp/mk-session.php";
    file_put_contents($script, '<?php require ' . var_export($root . '/admin/api/lib.php', true) . '; start_session(); $_SESSION = ["user"=>$argv[2],"name"=>$argv[2],"role"=>$argv[1],"full"=>true]; echo session_id(); session_write_close();');
    $sid = trim((string) shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg($role) . ' ' . escapeshellarg($name) . ' 2>/dev/null'));
    return ['Cookie: kinesica_atm=' . $sid, 'X-Kinesica: 1'];
}

putenv('KINESICA_ADMIN_CONFIG=' . "$tmp/cli.config.php");
write_config("$tmp/cli.config.php", ['webhook_secret' => 'secreto-nuevo']);
putenv('KINESICA_INTERACCIONES_DIR=' . "$tmp/cli-data");
mkdir("$tmp/cli-data", 0755, true);
$pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s', getenv('KT_DB_HOST'), (int) getenv('KT_DB_PORT'), getenv('KT_DB_NAME')), (string) getenv('KT_DB_USER'), (string) getenv('KT_DB_PASS'));
$pdo->exec('DROP TABLE IF EXISTS interaccion_eventos');
$pdo->exec('DROP TABLE IF EXISTS interaccion_estado');

$portA = random_int(40000, 45000);
$portB = $portA + 1;
// A: secreto nuevo + secreto legado aceptado (transición). B: legado desactivado.
$A = start_server($tmp, 'a', ['webhook_secret' => 'secreto-nuevo'], $portA);
$B = start_server($tmp, 'b', ['webhook_secret' => 'secreto-nuevo', 'allow_legacy_bot_secret' => false], $portB);
$bot = ['X-Kinesica-Bot-Secret: secreto-nuevo'];
$legacy = ['X-Kinesica-Bot-Secret: kinesica_webhook_secret_2026'];
$ts = 1793268000;

echo "• Ingesta con secreto del bot\n";
$ev = [['wa_id' => '5491100000007', 'direction' => 'patient', 'body' => 'Hola desde n8n', 'message_id' => 'wamid.H1', 'ts' => $ts, 'patient_name' => 'Paciente Uno'],
       ['wa_id' => '5491100000007', 'direction' => 'clara', 'body' => 'Respuesta', 'message_id' => 'wamid.H1', 'ts' => $ts + 3]];
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => $ev], $bot);
eq([$r['status'], $r['json']['stored'] ?? null], [200, 2], 'ingest guarda 2 eventos');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => $ev], $bot);
eq([$r['status'], $r['json']['duplicates'] ?? null, $r['json']['stored'] ?? null], [200, 2, 0], 'reenviar es idempotente');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => $ev], ['X-Kinesica-Bot-Secret: incorrecto']);
ok($r['status'] === 403 || $r['status'] === 401, 'secreto incorrecto rechazado (' . $r['status'] . ')');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => [['wa_id' => 'x']]], $bot);
eq($r['status'], 400, 'eventos inválidos => 400 (n8n lo verá y reintentará/alertará)');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => array_fill(0, 201, $ev[0])], $bot);
eq($r['status'], 413, 'lote excesivo => 413');
$r = http($A['base'], 'POST', '/interacciones.php', ['wa_id' => '5491100000008', 'patient_message' => 'nodo viejo', 'clara_reply' => 'ok', 'patient_name' => 'Viejo'], $legacy);
eq([$r['status'], $r['json']['stored'] ?? null], [200, 2], 'nodo viejo de n8n (formato legado + secreto legado) sigue funcionando');
$r = http($B['base'], 'POST', '/interacciones.php', ['wa_id' => '5491100000009', 'patient_message' => 'x', 'clara_reply' => 'y'], $legacy);
ok($r['status'] === 403 || $r['status'] === 401, 'con allow_legacy_bot_secret=false el secreto legado se rechaza (' . $r['status'] . ')');
$r = http($B['base'], 'POST', '/interacciones.php', ['wa_id' => '5491100000009', 'patient_message' => 'x', 'clara_reply' => 'y'], $bot);
eq($r['status'], 200, '...y el secreto nuevo funciona');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'sync_all', 'items' => [['wa_id' => '5491100000010', 'date' => '2026-10-29', 'messages' => [['from' => 'patient', 'time' => '10:00', 'text' => 'legacy sync']]]]], $bot);
eq([$r['status'], $r['json']['stored'] ?? null], [200, 1], 'sync_all (script viejo) acepta items');

echo "• Lectura: el secreto del bot NO da acceso\n";
$r = http($A['base'], 'GET', '/interacciones.php', null, $bot);
ok(in_array($r['status'], [401, 403], true) && !isset($r['json']['items']), 'GET con secreto del bot no devuelve conversaciones (' . $r['status'] . ')');
$r = http($A['base'], 'GET', '/interacciones.php', null, array_merge($bot, ['X-Kinesica: 1']));
ok(in_array($r['status'], [401, 403], true) && !isset($r['json']['items']), 'tampoco con cabecera X-Kinesica (' . $r['status'] . ')');

echo "• Sesiones\n";
$admin = session_cookie($A, 'admin', 'martin');
$colab = session_cookie($A, 'colaborador', 'facundo');
$r = http($A['base'], 'GET', '/interacciones.php', null, $admin);
eq($r['status'], 200, 'admin lee');
$items = $r['json']['items'] ?? [];
ok(count($items) >= 3, 'la lista incluye lo ingestado (' . count($items) . ' conversaciones)');
$mine = array_values(array_filter($items, fn($i) => $i['wa_id'] === '5491100000007'))[0] ?? null;
eq([$mine['patient_name'] ?? null, count($mine['messages'] ?? [])], ['Paciente Uno', 2], 'conversación con nombre y 2 mensajes');
eq($r['json']['health']['total_events'] ?? null, 7, 'health.total_events');
ok(isset($r['json']['health']['spool_pending']), 'health incluye spool_pending');
$r = http($A['base'], 'GET', '/interacciones.php', null, $colab);
eq($r['status'], 200, 'colaborador puede LEER');
$id = $mine['id'];
foreach ([['action' => 'archive', 'id' => $id], ['action' => 'unarchive', 'id' => $id], ['action' => 'toggle_answered', 'id' => $id, 'answered' => true],
          ['action' => 'sync_all', 'items' => []], ['action' => 'reconcile'], ['action' => 'ingest', 'events' => $ev],
          ['wa_id' => '5491100000099', 'patient_message' => 'inyectado', 'clara_reply' => ''], []] as $body) {
    $r = http($A['base'], 'POST', '/interacciones.php', $body, $colab);
    eq($r['status'], 403, 'colaborador NO puede escribir: ' . json_encode($body['action'] ?? array_keys($body)));
}
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'ingest', 'events' => $ev], $admin);
ok($r['status'] === 400 && ($r['json']['stored'] ?? null) === null, 'ingest por sesión (sin secreto de bot) no se acepta');
$r = http($A['base'], 'POST', '/interacciones.php', ['wa_id' => '5491100000099', 'patient_message' => 'inyectado', 'clara_reply' => ''], $admin);
eq(in_array($r['status'], [400, 401, 403], true), true, 'ni siquiera admin por sesión puede inyectar mensajes falsos (' . $r['status'] . ')');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'archive', 'id' => $id], $admin);
eq($r['status'], 200, 'admin archiva');
$r = http($A['base'], 'GET', '/interacciones.php', null, $admin);
$mine = array_values(array_filter($r['json']['items'], fn($i) => $i['id'] === $id))[0];
eq([$mine['archived'], count($mine['messages'])], [true, 2], 'archivada y con todos sus mensajes');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'archive', 'id' => 'no-existe'], $admin);
eq($r['status'], 404, 'id inexistente => 404');
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'archive'], $admin);
eq($r['status'], 400, 'sin id => 400');
$r = http($A['base'], 'GET', '/interacciones.php');
ok(in_array($r['status'], [401, 403], true), 'sin sesión no se lee (' . $r['status'] . ')');
$n = (int) $pdo->query('SELECT COUNT(*) FROM interaccion_eventos')->fetchColumn();
eq($n, 7, 'ningún intento rechazado escribió datos (7 eventos esperados)');

echo "• Reconciliación sin configurar\n";
$r = http($A['base'], 'POST', '/interacciones.php', ['action' => 'reconcile'], $bot);
eq([$r['status'], $r['json']['status'] ?? null], [200, 'not_configured'], 'reconcile informa not_configured (no usa credenciales por defecto)');

foreach ([$A, $B] as $s) {
    proc_terminate($s['proc']);
}
echo "\n";
if ($fails > 0) {
    echo "❌ HTTP: $fails comprobaciones fallaron ($passed OK)\n";
    foreach (['a', 'b'] as $n) {
        echo "--- log $n:\n" . @file_get_contents("$tmp/$n.log");
    }
    exit(1);
}
echo "✅ interacciones HTTP (auth del bot, solo-lectura de Colaborador, sin lectura con secreto): $passed comprobaciones OK\n";
