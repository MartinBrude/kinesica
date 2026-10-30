<?php
declare(strict_types=1);

/**
 * Reconciliador de recordatorios: importa desde n8n lo que el push no entregó.
 * Solo corridas NUEVAS tras el primer deploy (baseline_ts); sin backfill histórico.
 * Requiere: n8n_url, n8n_user, n8n_password, n8n_recordatorios_workflow_id.
 */

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/lib_interacciones_n8n_io.php';

const RECORDATORIOS_BUILD_NODES = [
    'Build Sent Reminder Report',
    'Build Failed Reminder Report',
    'Build Skip Reminder Report',
    'Build Missing Phone Reminder Report',
];

function recordatorios_reconcile_config(): ?array
{
    $c = function_exists('cfg') ? cfg() : [];
    $out = [];
    foreach (['n8n_url', 'n8n_user', 'n8n_password', 'n8n_recordatorios_workflow_id'] as $k) {
        $v = trim((string) ($c[$k] ?? ''));
        if ($v === '') {
            return null;
        }
        $out[$k] = $v;
    }
    $out['n8n_url'] = rtrim($out['n8n_url'], '/');
    return $out;
}

function recordatorios_reconcile_state_path(): string
{
    return recordatorios_dir() . '/recordatorios_reconcile_state.json';
}

function recordatorios_reconcile_state(): array
{
    $d = json_decode((string) @file_get_contents(recordatorios_reconcile_state_path()), true);
    return is_array($d) ? $d : [];
}

function recordatorios_reconcile_due(int $minIntervalSeconds): bool
{
    $last = (int) (recordatorios_reconcile_state()['last_run_ts'] ?? 0);
    return time() - $last >= $minIntervalSeconds;
}

function recordatorios_parse_started_at(?string $startedAt): int
{
    if ($startedAt === null || trim($startedAt) === '') {
        return 0;
    }
    try {
        return (new DateTimeImmutable(trim($startedAt)))->getTimestamp();
    } catch (Throwable $e) {
        return 0;
    }
}

/**
 * Extrae items de ingest ya normalizables desde los nodos Build* del árbol flatted.
 *
 * @return list<array> items normalizados (o vacíos si no hay Build parseable)
 */
function recordatorios_events_from_execution(array $tree, string $execId, ?string $startedAt): array
{
    $run = $tree['resultData']['runData'] ?? [];
    if (!is_array($run)) {
        return [];
    }
    $runAt = recordatorios_parse_started_at($startedAt);
    if ($runAt <= 0) {
        $runAt = time();
    }
    $safeExec = $execId !== '' ? $execId : 'na';
    $out = [];
    $seenKeys = [];
    foreach (RECORDATORIOS_BUILD_NODES as $nodeName) {
        $runs = $run[$nodeName] ?? null;
        if (!is_array($runs)) {
            continue;
        }
        foreach ($runs as $nodeRun) {
            $mains = $nodeRun['data']['main'] ?? null;
            if (!is_array($mains)) {
                continue;
            }
            foreach ($mains as $branch) {
                if (!is_array($branch)) {
                    continue;
                }
                foreach ($branch as $item) {
                    $json = $item['json'] ?? null;
                    if (!is_array($json)) {
                        continue;
                    }
                    $batchExec = trim((string) ($json['exec_id'] ?? $json['execution_id'] ?? $safeExec));
                    if ($batchExec === '') {
                        $batchExec = $safeExec;
                    }
                    $batchRunAt = recordatorios_parse_run_at($json['run_at'] ?? null, $runAt);
                    $rawItems = $json['items'] ?? null;
                    if (!is_array($rawItems)) {
                        continue;
                    }
                    foreach ($rawItems as $raw) {
                        if (!is_array($raw)) {
                            continue;
                        }
                        $n = recordatorios_normalize_item($raw, $batchExec, $batchRunAt);
                        if ($n === null) {
                            continue;
                        }
                        $k = $n['event_key'];
                        if (isset($seenKeys[$k])) {
                            continue;
                        }
                        $seenKeys[$k] = true;
                        $out[] = $n;
                    }
                }
            }
        }
    }
    return $out;
}

/**
 * @param callable|null $http fn(string $method, string $url, ?string $body): array{status:int,body:string}
 * @return array{status:string,imported:int,scanned:int,message:string,baseline_ts?:int}
 */
function recordatorios_reconcile(?PDO $pdo = null, int $maxSeconds = 6, ?callable $http = null, ?array $config = null): array
{
    $conf = $config ?? recordatorios_reconcile_config();
    $state = recordatorios_reconcile_state();
    $result = ['status' => 'ok', 'imported' => 0, 'scanned' => 0, 'message' => ''];
    if ($conf === null) {
        $result['status'] = 'not_configured';
        $result['message'] = 'Faltan n8n_url / n8n_user / n8n_password / n8n_recordatorios_workflow_id en config.php';
        recordatorios_reconcile_save($state, $result, false);
        return $result;
    }
    $lock = @fopen(recordatorios_dir() . '/recordatorios_reconcile.lock', 'cb');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        return ['status' => 'busy', 'imported' => 0, 'scanned' => 0, 'message' => 'Ya hay una reconciliación en curso'];
    }

    $baselineTs = (int) ($state['baseline_ts'] ?? 0);
    $baselineComplete = !empty($state['baseline_complete']) && $baselineTs > 0;
    if (!$baselineComplete) {
        $baselineTs = time();
        $state['baseline_ts'] = $baselineTs;
        $state['baseline_complete'] = true;
        $baselineComplete = true;
        $result['message'] = 'Baseline post-deploy fijado; no se importan corridas anteriores';
        $result['baseline_ts'] = $baselineTs;
    }

    $deadline = microtime(true) + max(2, $maxSeconds);
    $http = $http ?? interacciones_n8n_http_client($conf);
    $pdo = recordatorios_pdo($pdo);
    $doneIds = array_flip(array_map('intval', $state['done_ids'] ?? []));
    $finishedScan = false;
    $hadError = false;
    $wfId = $conf['n8n_recordatorios_workflow_id'];

    try {
        $cursor = null;
        for ($page = 0; $page < 60 && microtime(true) < $deadline; $page++) {
            $url = $conf['n8n_url'] . '/rest/executions?limit=50' . ($cursor ? '&cursor=' . rawurlencode($cursor) : '');
            $list = interacciones_n8n_json($http, 'GET', $url, $conf);
            if ($list === null) {
                $hadError = true;
                $result['message'] = 'No se pudo listar ejecuciones de n8n';
                break;
            }
            $data = $list['data'] ?? [];
            $unknownOnPage = 0;
            foreach (($data['results'] ?? []) as $ex) {
                if ((string) ($ex['workflowId'] ?? '') !== $wfId) {
                    continue;
                }
                $id = (int) ($ex['id'] ?? 0);
                $status = (string) ($ex['status'] ?? '');
                if ($id <= 0 || in_array($status, ['running', 'new', 'waiting'], true)) {
                    $hadError = $hadError || $id > 0;
                    continue;
                }
                $started = recordatorios_parse_started_at(isset($ex['startedAt']) ? (string) $ex['startedAt'] : null);
                if ($started < $baselineTs) {
                    continue;
                }
                if (isset($doneIds[$id])) {
                    continue;
                }
                $unknownOnPage++;
                if (microtime(true) >= $deadline) {
                    $hadError = true;
                    break;
                }
                $detail = interacciones_n8n_json($http, 'GET', $conf['n8n_url'] . '/rest/executions/' . $id, $conf);
                $raw = is_array($detail) ? ($detail['data']['data'] ?? null) : null;
                $tree = is_string($raw) ? interacciones_flatted_decode($raw) : null;
                if (!is_array($tree)) {
                    $hadError = true;
                    continue;
                }
                $result['scanned']++;
                $items = recordatorios_events_from_execution($tree, (string) $id, $ex['startedAt'] ?? null);
                $terminalEmpty = $items === [] && in_array($status, ['error', 'crashed', 'canceled'], true);
                if ($items === [] && !$terminalEmpty) {
                    $hadError = true;
                    continue;
                }
                if ($items !== []) {
                    $stored = recordatorios_store_items($items, $pdo);
                    if ($stored['failed'] > 0) {
                        $hadError = true;
                        continue;
                    }
                    $result['imported'] += $stored['stored'];
                }
                $doneIds[$id] = true;
            }
            $cursor = $data['nextCursor'] ?? null;
            if (!$cursor) {
                $finishedScan = true;
                break;
            }
            if ($unknownOnPage === 0 && $baselineComplete && !$hadError) {
                $finishedScan = true;
                break;
            }
        }
    } catch (Throwable $e) {
        $hadError = true;
        $result['message'] = 'Error: ' . $e->getMessage();
    }

    if ($hadError || !$finishedScan) {
        $result['status'] = 'partial';
    }
    $ids = array_keys($doneIds);
    rsort($ids);
    $state['done_ids'] = array_slice($ids, 0, 3000);
    $state['baseline_ts'] = $baselineTs;
    $state['baseline_complete'] = true;
    $result['baseline_ts'] = $baselineTs;
    recordatorios_reconcile_save($state, $result, $result['status'] === 'ok');
    flock($lock, LOCK_UN);
    fclose($lock);
    return $result;
}

function recordatorios_reconcile_save(array $state, array $result, bool $ok): void
{
    $state['last_run'] = gmdate('Y-m-d\TH:i:s\Z');
    $state['last_run_ts'] = time();
    $state['status'] = $result['status'];
    $state['imported_last_run'] = $result['imported'];
    $state['message'] = $result['message'];
    if ($ok) {
        $state['last_ok'] = $state['last_run'];
    }
    recordatorios_write_atomic(recordatorios_reconcile_state_path(), json_encode($state));
}
