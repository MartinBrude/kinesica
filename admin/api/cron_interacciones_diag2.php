<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';

$pdo = db();
$keys = [
    '41762169069_2026-11-27',
    '5491154215460_2026-11-27',
    '5492216129672_2026-11-27',
    '5491138217650_2026-11-27',
    '34658444935_2026-11-27',
];
$st = $pdo->prepare('SELECT conversation_key, answered, answered_at, updated_at, updated_by, archived FROM interaccion_estado WHERE conversation_key = :k');
$rows = [];
foreach ($keys as $k) {
    $st->execute(['k' => $k]);
    $rows[$k] = $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

// Conversaciones 7d con answered=1 y updated_by restore-flags
$q = $pdo->query(
    "SELECT conversation_key, answered, updated_at, updated_by
     FROM interaccion_estado
     WHERE answered = 1 AND updated_by = 'restore-flags'
       AND conversation_key LIKE '%_2026-11-2%'
     ORDER BY conversation_key"
);
$restoredRecent = $q->fetchAll(PDO::FETCH_ASSOC) ?: [];

$out = [
    'keys' => $rows,
    'restore_flags_nov2x' => $restoredRecent,
    'restore_flags_nov2x_count' => count($restoredRecent),
];
file_put_contents(__DIR__ . '/data/interacciones_diag2.json', json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo "ok\n";
