<?php
declare(strict_types=1);

/** E/S con n8n: decodificación flatted, extracción de eventos y cliente HTTP. */

require_once __DIR__ . '/lib_interacciones_migrate.php';

function interacciones_flatted_decode(string $json, int $maxDepth = 60)
{
    $parsed = json_decode($json, true);
    if (!is_array($parsed) || $parsed === []) {
        return null;
    }
    $count = count($parsed);
    $seen = [];
    $resolve = function (int $idx, int $depth) use (&$resolve, &$seen, $parsed, $count, $maxDepth) {
        if ($depth > $maxDepth || $idx < 0 || $idx >= $count) {
            return null;
        }
        if (array_key_exists($idx, $seen)) {
            return $seen[$idx];
        }
        $val = $parsed[$idx];
        if (!is_array($val)) {
            return $val;
        }
        $res = [];
        $seen[$idx] = &$res;
        foreach ($val as $k => $v) {
            $res[$k] = (is_string($v) && ctype_digit($v) && (int) $v < $count) ? $resolve((int) $v, $depth + 1) : $v;
        }
        unset($seen[$idx]);
        $seen[$idx] = $res;
        return $res;
    };
    return $resolve(0, 0);
}

function interacciones_events_from_execution(array $tree, string $execId, ?string $startedAt, ?string $stoppedAt): array
{
    $run = $tree['resultData']['runData'] ?? [];
    $j = $run['Filter & Parse Message'][0]['data']['main'][0][0]['json'] ?? null;
    if (!is_array($j)) {
        return [];
    }
    $wa = trim((string) ($j['wa_id'] ?? ''));
    $msg = trim((string) ($j['patient_message'] ?? ''));
    if ($wa === '' || $msg === '') {
        return [];
    }
    $ts = interacciones_parse_ts($j['timestamp'] ?? null, interacciones_parse_ts($startedAt, time()));
    $msgId = trim((string) ($j['message_id'] ?? ''));
    $events = [];
    $base = ['wa_id' => $wa, 'exec_id' => $execId, 'message_id' => $msgId];
    $patient = interacciones_normalize_event($base + [
        'direction' => 'patient', 'body' => $msg, 'ts' => $ts, 'patient_name' => (string) ($j['patient_name'] ?? ''),
    ], 'n8n-pull');
    if ($patient !== null) {
        $events[] = $patient;
    }
    $reply = trim((string) ($run['Format Validated Message'][0]['data']['main'][0][0]['json']['final_message'] ?? ''));
    if ($reply !== '') {
        $replyTs = max($ts, interacciones_parse_ts($stoppedAt, $ts));
        $clara = interacciones_normalize_event($base + ['direction' => 'clara', 'body' => $reply, 'ts' => $replyTs], 'n8n-pull');
        if ($clara !== null) {
            $events[] = $clara;
        }
    }
    return $events;
}

function interacciones_n8n_json(callable $http, string $method, string $url, array $conf): ?array
{
    $res = $http($method, $url, null);
    if ($res['status'] === 401) {
        $login = $http('POST', $conf['n8n_url'] . '/rest/login', json_encode([
            'emailOrLdapLoginId' => $conf['n8n_user'], 'password' => $conf['n8n_password'],
        ]));
        if ($login['status'] !== 200) {
            return null;
        }
        $res = $http($method, $url, null);
    }
    if ($res['status'] !== 200) {
        return null;
    }
    $decoded = json_decode($res['body'], true);
    return is_array($decoded) ? $decoded : null;
}

function interacciones_n8n_http_client(array $conf): callable
{
    $cookie = interacciones_dir() . '/n8n_cookie.txt';
    return static function (string $method, string $url, ?string $body) use ($cookie): array {
        if (!function_exists('curl_init')) {
            return ['status' => 0, 'body' => ''];
        }
        $ch = curl_init($url);
        $headers = ['browser-id: kinesica-admin-sync', 'Accept: application/json'];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_COOKIEJAR => $cookie, CURLOPT_COOKIEFILE => $cookie, CURLOPT_SSL_VERIFYPEER => true,
        ]);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                $headers[] = 'Content-Type: application/json';
            }
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        @chmod($cookie, 0600);
        return ['status' => $code, 'body' => is_string($resp) ? $resp : ''];
    };
}
