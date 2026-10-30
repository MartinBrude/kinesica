<?php
declare(strict_types=1);

/** Trabajador para pruebas de concurrencia: php test-interacciones-worker.php <modo> <n> <id> */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_interacciones_state.php';
require_once $root . '/admin/api/lib_interacciones_view.php';

[, $mode, $n, $id] = $argv + [null, 'store', '10', '0'];
$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', getenv('KT_DB_HOST'), (int) getenv('KT_DB_PORT'), getenv('KT_DB_NAME')),
    (string) getenv('KT_DB_USER'),
    (string) getenv('KT_DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
);

$events = [];
for ($i = 0; $i < (int) $n; $i++) {
    $events[] = interacciones_normalize_event([
        'wa_id' => '5491100000' . str_pad((string) ((int) $id % 5), 3, '0', STR_PAD_LEFT),
        'direction' => $i % 2 ? 'clara' : 'patient',
        'body' => "msg $mode $id $i",
        'message_id' => "W{$mode}{$id}x{$i}",
        'ts' => 1790000000 + $i,
    ], 'test');
}

if ($mode === 'store') {
    foreach ($events as $ev) {
        interacciones_store_events([$ev], $pdo);
    }
} elseif ($mode === 'spool') {
    foreach ($events as $ev) {
        if (!interacciones_spool_append([$ev])) {
            fwrite(STDERR, "spool_append falló\n");
            exit(2);
        }
    }
} elseif ($mode === 'drain') {
    for ($i = 0; $i < (int) $n; $i++) {
        interacciones_spool_drain($pdo, 2);
        usleep(20000);
    }
}
exit(0);
