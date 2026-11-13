<?php
declare(strict_types=1);


/**
 * @return array{scanned:int,updated:int,skipped:int}
 */
function kinesica_rel_backfill_gastos(PDO $pdo, bool $apply): array
{
    $stats = ['scanned' => 0, 'updated' => 0, 'skipped' => 0];
    if (!kinesica_rel_gastos_ready($pdo)) {
        $stats['skipped'] = 1;
        return $stats;
    }
    require_once __DIR__ . '/gastos_io.php';
    $list = kinesica_gastos_load_json_only();
    foreach ($list as $item) {
        if (!is_array($item)) {
            continue;
        }
        $stats['scanned']++;
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            $stats['skipped']++;
            continue;
        }
        $chk = $pdo->prepare('SELECT id FROM gastos WHERE id = :id LIMIT 1');
        $chk->execute(['id' => $id]);
        if ($chk->fetchColumn()) {
            $stats['skipped']++;
            continue;
        }
        if ($apply) {
            if (kinesica_rel_gasto_upsert($pdo, $item, 'backfill')) {
                $stats['updated']++;
            } else {
                $stats['skipped']++;
            }
        } else {
            $stats['updated']++;
        }
    }
    return $stats;
}
