<?php
declare(strict_types=1);

/** CLI diag: conteos de la bandeja (7/30/90 días). */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_view.php';
require_once __DIR__ . '/lib_interacciones_state.php';

$pdo = db();
$out = ['at' => gmdate('c'), 'windows' => []];
foreach ([7, 30, 90] as $days) {
    $view = interacciones_load_view($pdo, $days);
    $items = $view['items'] ?? [];
    $sample = [];
    foreach (array_slice($items, 0, 25) as $it) {
        $sample[] = [
            'id' => $it['id'] ?? '',
            'name' => $it['patient_name'] ?? '',
            'answered' => !empty($it['answered']),
            'archived' => !empty($it['archived']),
            'takeover' => !empty($it['takeover_active']),
            'cat' => $it['category'] ?? '',
        ];
    }
    $out['windows'][(string) $days] = [
        'items' => count($items),
        'answered_count' => $view['answered_count'] ?? null,
        'unanswered_count' => $view['unanswered_count'] ?? null,
        'archived_count' => $view['archived_count'] ?? null,
        'sample' => $sample,
    ];
}

$restoreBy = $pdo->query(
    "SELECT COUNT(*) AS n FROM interaccion_estado WHERE updated_by = 'restore-flags' AND answered = 1"
)->fetch(PDO::FETCH_ASSOC);
$out['estado_restore_flags_answered'] = (int) ($restoreBy['n'] ?? 0);
$by = $pdo->query(
    "SELECT updated_by, answered, COUNT(*) AS n FROM interaccion_estado GROUP BY updated_by, answered ORDER BY n DESC LIMIT 20"
)->fetchAll(PDO::FETCH_ASSOC);
$out['estado_by_updater'] = $by;

$path = __DIR__ . '/data/interacciones_diag.json';
file_put_contents($path, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
fwrite(STDOUT, $path . "\n");
