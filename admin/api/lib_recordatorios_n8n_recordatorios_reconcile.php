<?php
declare(strict_types=1);


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


function recordatorios_prevision_state_path(): string
{
    return recordatorios_dir() . '/recordatorios_prevision_state.json';
}


function recordatorios_prevision_due(int $minIntervalSeconds = 300): bool
{
    $d = json_decode((string) @file_get_contents(recordatorios_prevision_state_path()), true);
    $last = (int) ($d['last_run_ts'] ?? 0);
    return time() - $last >= $minIntervalSeconds;
}


function recordatorios_trigger_prevision(?array $config = null): ?array
{
    $conf = $config ?? recordatorios_reconcile_config();
    if (!$conf || empty($conf['n8n_url'])) {
        return null;
    }
    $url = $conf['n8n_url'] . '/webhook/recordatorios-prevision';
    $secret = trim((string) (cfg()['webhook_secret'] ?? ''));
    if (!function_exists('curl_init')) {
        return null;
    }
    $ch = curl_init($url);
    $headers = [
        'Content-Type: application/json',
        'X-Kinesica-Bot-Secret: ' . $secret,
    ];
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['action' => 'preview', 'timestamp' => time()]),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $state = ['last_run_ts' => time(), 'status' => $code];
    @file_put_contents(recordatorios_prevision_state_path(), json_encode($state));
    if ($code >= 200 && $code < 300 && is_string($resp)) {
        return json_decode($resp, true);
    }
    return null;
}
