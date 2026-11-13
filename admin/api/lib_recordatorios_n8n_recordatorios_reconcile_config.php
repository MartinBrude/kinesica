<?php
declare(strict_types=1);


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
