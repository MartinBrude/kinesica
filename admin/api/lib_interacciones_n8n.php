<?php
declare(strict_types=1);

/**
 * Reconciliador: red de seguridad que importa desde n8n lo que el push no haya entregado.
 * Idempotente (clave = id de mensaje de WhatsApp), con presupuesto de tiempo y estado reanudable.
 * Requiere en config.php: n8n_url, n8n_user, n8n_password, n8n_workflow_id (sin valores por defecto).
 */

require_once __DIR__ . '/lib_interacciones_migrate.php';
require_once __DIR__ . '/lib_interacciones_n8n_io.php';

/** Decodifica el formato "flatted" que usa n8n en data.data (equivalente a logs.unflatten del bot). */
/**
 * Extrae eventos (mensaje del paciente + respuesta de Clara) del árbol de una ejecución.
 *
 * @return list<array>
 */
function interacciones_reconcile_config(): ?array
{
    $c = function_exists('cfg') ? cfg() : [];
    $out = [];
    foreach (['n8n_url', 'n8n_user', 'n8n_password', 'n8n_workflow_id'] as $k) {
        $v = trim((string) ($c[$k] ?? ''));
        if ($v === '') {
            return null;
        }
        $out[$k] = $v;
    }
    $out['n8n_url'] = rtrim($out['n8n_url'], '/');
    return $out;
}

function interacciones_reconcile_state_path(): string
{
    return interacciones_dir() . '/reconcile_state.json';
}

function interacciones_reconcile_state(): array
{
    $d = json_decode((string) @file_get_contents(interacciones_reconcile_state_path()), true);
    return is_array($d) ? $d : [];
}

/** ¿Pasó el intervalo mínimo desde la última corrida? */
function interacciones_reconcile_due(int $minIntervalSeconds): bool
{
    $last = (int) (interacciones_reconcile_state()['last_run_ts'] ?? 0);
    return time() - $last >= $minIntervalSeconds;
}

/**
 * @param callable|null $http fn(string $method, string $url, ?string $body): array{status:int,body:string} (inyectable en tests)
 * @return array{status:string,imported:int,scanned:int,message:string}
 */
function interacciones_reconcile(?PDO $pdo = null, int $maxSeconds = 6, ?callable $http = null, ?array $config = null): array
{
    $conf = $config ?? interacciones_reconcile_config();
    $state = interacciones_reconcile_state();
    $result = ['status' => 'ok', 'imported' => 0, 'scanned' => 0, 'message' => ''];
    if ($conf === null) {
        $result['status'] = 'not_configured';
        $result['message'] = 'Faltan n8n_url / n8n_user / n8n_password / n8n_workflow_id en config.php';
        interacciones_reconcile_save($state, $result, false);
        return $result;
    }
    $lock = @fopen(interacciones_dir() . '/reconcile.lock', 'cb');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        return ['status' => 'busy', 'imported' => 0, 'scanned' => 0, 'message' => 'Ya hay una reconciliación en curso'];
    }
    $deadline = microtime(true) + max(2, $maxSeconds);
    $http = $http ?? interacciones_n8n_http_client($conf);
    $pdo = interacciones_pdo($pdo);
    $doneIds = array_flip(array_map('intval', $state['done_ids'] ?? []));
    $backfillComplete = !empty($state['backfill_complete']);
    $finishedScan = false;
    $hadError = false;
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
                if (($ex['workflowId'] ?? '') !== $conf['n8n_workflow_id']) {
                    continue;
                }
                $id = (int) ($ex['id'] ?? 0);
                $status = (string) ($ex['status'] ?? '');
                if ($id <= 0 || in_array($status, ['running', 'new', 'waiting'], true)) {
                    $hadError = $hadError || $id > 0;
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
                $raw = $detail['data']['data'] ?? null;
                $tree = is_string($raw) ? interacciones_flatted_decode($raw) : null;
                if (!is_array($tree)) {
                    $hadError = true;
                    continue;
                }
                $result['scanned']++;
                $events = interacciones_events_from_execution($tree, (string) $id, $ex['startedAt'] ?? null, $ex['stoppedAt'] ?? null);
                // Success sin eventos parseables: no marcar done (nodo renombrado / flatted raro).
                // Errores terminales de n8n sin payload sí se cierran para no re-fetch infinito.
                $terminalEmpty = $events === [] && in_array($status, ['error', 'crashed', 'canceled'], true);
                if ($events === [] && !$terminalEmpty) {
                    $hadError = true;
                    continue;
                }
                $stored = interacciones_store_events($events, $pdo);
                if ($stored['failed'] > 0) {
                    $hadError = true;
                    continue;
                }
                $result['imported'] += $stored['stored'];
                $doneIds[$id] = true;
            }
            $cursor = $data['nextCursor'] ?? null;
            if (!$cursor) {
                $finishedScan = true;
                break;
            }
            if ($unknownOnPage === 0 && $backfillComplete && !$hadError) {
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
    if ($finishedScan && !$hadError) {
        $backfillComplete = true;
    }
    $ids = array_keys($doneIds);
    rsort($ids);
    $state['done_ids'] = array_slice($ids, 0, 3000);
    $state['backfill_complete'] = $backfillComplete;
    interacciones_reconcile_save($state, $result, $result['status'] === 'ok');
    flock($lock, LOCK_UN);
    fclose($lock);
    return $result;
}

function interacciones_reconcile_save(array $state, array $result, bool $ok): void
{
    $state['last_run'] = gmdate('Y-m-d\TH:i:s\Z');
    $state['last_run_ts'] = time();
    $state['status'] = $result['status'];
    $state['imported_last_run'] = $result['imported'];
    $state['message'] = $result['message'];
    if ($ok) {
        $state['last_ok'] = $state['last_run'];
    }
    interacciones_write_atomic(interacciones_reconcile_state_path(), json_encode($state));
}
