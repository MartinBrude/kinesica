<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/interacciones_seed.php';

$dataFile = __DIR__ . '/data/interacciones.json';

$isBotAuth = false;
$headers = function_exists('getallheaders') ? getallheaders() : [];
$botSecret = $headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($botSecret === '' && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
    $botSecret = trim($matches[1]);
}
$cfgSecret = (string) (cfg()['webhook_secret'] ?? cfg()['bot_token'] ?? 'kinesica_webhook_secret_2026');
if ($botSecret !== '' && hash_equals($cfgSecret, $botSecret)) {
    $isBotAuth = true;
}

if (!$isBotAuth) {
    require_header();
    $auth = require_auth();
}

function load_interactions(string $dataFile): array
{
    if (!is_file($dataFile)) {
        $seed = get_initial_seed_interactions();
        @file_put_contents($dataFile, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $seed;
    }
    $raw = @file_get_contents($dataFile);
    $decoded = $raw ? json_decode($raw, true) : null;
    return is_array($decoded) ? $decoded : get_initial_seed_interactions();
}

function save_interactions(string $dataFile, array $items): bool
{
    if (count($items) > 1000) $items = array_slice($items, 0, 1000);
    $dir = dirname($dataFile);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return (bool) @file_put_contents($dataFile, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function is_martin_brude_phone(?string $phone): bool
{
    if (!$phone) return false;
    $clean = preg_replace('/\D/', '', $phone);
    return $clean === '34658444935' || $clean === '658444935' || str_ends_with($clean, '34658444935') || str_ends_with($clean, '658444935');
}

function sync_interactions_from_n8n(string $dataFile, bool $force = false): void
{
    $dir = dirname($dataFile);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $lockFile = $dir . '/last_n8n_sync.json';
    $now = time();
    if (!$force && is_file($lockFile)) {
        $meta = json_decode(@file_get_contents($lockFile) ?: '', true);
        $lastSync = (int) ($meta['last_sync'] ?? 0);
        if ($now - $lastSync < 20) {
            return;
        }
    }

    $n8nUrl = rtrim((string) (cfg()['n8n_url'] ?? 'https://n8n.kinesica.com.ar'), '/');
    $n8nUser = (string) (cfg()['n8n_user'] ?? 'martin.brude@gmail.com');
    $n8nPass = (string) (cfg()['n8n_password'] ?? 'Bigote27!');
    $wfId = (string) (cfg()['n8n_workflow_id'] ?? 'gYaJzuyftZKz6wWb');
    $cookieFile = $dir . '/n8n_cookie.txt';
    $browserId = 'kinesica-admin-sync';

    $n8nReq = function (string $url, string $method = 'GET', ?string $body = null) use ($cookieFile, $browserId) {
        if (!function_exists('curl_init')) return ['status' => 0, 'body' => ''];
        $ch = curl_init($url);
        $headers = [
            'browser-id: ' . $browserId,
            'Accept: application/json',
        ];
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
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
        return ['status' => $code, 'body' => is_string($resp) ? $resp : ''];
    };

    try {
        $execRes = $n8nReq($n8nUrl . '/rest/executions?limit=25');
        if ($execRes['status'] === 401 || !is_file($cookieFile) || empty($execRes['body'])) {
            $loginRes = $n8nReq($n8nUrl . '/rest/login', 'POST', json_encode([
                'emailOrLdapLoginId' => $n8nUser,
                'password' => $n8nPass,
            ]));
            if ($loginRes['status'] !== 200) {
                return;
            }
            $execRes = $n8nReq($n8nUrl . '/rest/executions?limit=25');
        }

        $execData = json_decode($execRes['body'], true);
        $results = $execData['data']['results'] ?? [];
        if (!is_array($results) || empty($results)) {
            @file_put_contents($lockFile, json_encode(['last_sync' => $now]), LOCK_EX);
            return;
        }

        $relevant = [];
        foreach ($results as $item) {
            $wId = $item['workflowId'] ?? '';
            $size = (int) ($item['jsonSizeBytes'] ?? 0);
            if ($wId === $wfId && $size > 400000) {
                $relevant[] = $item;
            }
        }

        if (empty($relevant)) {
            @file_put_contents($lockFile, json_encode(['last_sync' => $now]), LOCK_EX);
            return;
        }

        $existing = load_interactions($dataFile);
        $existingMap = [];
        foreach ($existing as $ex) {
            $k = ($ex['wa_id'] ?? '') . '_' . ($ex['date'] ?? '');
            if ($k !== '_') {
                $existingMap[$k] = $ex;
            }
        }

        $hasUpdates = false;
        $relevant = array_reverse($relevant);
        foreach ($relevant as $item) {
            $eid = (string) ($item['id'] ?? '');
            $started = (string) ($item['startedAt'] ?? '');
            if ($eid === '') continue;

            $detRes = $n8nReq($n8nUrl . '/rest/executions/' . $eid);
            if ($detRes['status'] !== 200 || empty($detRes['body'])) continue;

            $det = json_decode($detRes['body'], true);
            $runData = $det['resultData']['runData'] ?? ($det['data']['resultData']['runData'] ?? []);

            $fpRun = $runData['Filter & Parse Message'] ?? [];
            $waId = '';
            $patientName = '';
            $patientMsg = '';
            if (!empty($fpRun[0]['data']['main'][0][0]['json'])) {
                $j = $fpRun[0]['data']['main'][0][0]['json'];
                $waId = trim((string) ($j['wa_id'] ?? ''));
                $patientName = trim((string) ($j['patient_name'] ?? ''));
                $patientMsg = trim((string) ($j['patient_message'] ?? ''));
            }

            if ($waId === '' || $patientMsg === '') continue;

            $claraReply = '';
            $valRun = $runData['Format Validated Message'] ?? [];
            if (!empty($valRun[0]['data']['main'][0][0]['json']['final_message'])) {
                $claraReply = trim((string) $valRun[0]['data']['main'][0][0]['json']['final_message']);
            }

            $datePart = '2026-10-29';
            $timePart = '00:00';
            if ($started !== '') {
                try {
                    $dt = new DateTime($started);
                    $dt->setTimezone(new DateTimeZone('America/Argentina/Buenos_Aires'));
                    $datePart = $dt->format('Y-m-d');
                    $timePart = $dt->format('H:i');
                } catch (\Exception $e) {}
            }

            $key = $waId . '_' . $datePart;

            $cleanDigits = preg_replace('/[^\d]/', '', $waId);
            if (is_martin_brude_phone($cleanDigits)) {
                $patientName = 'Martín Brude';
            }
            $phoneFormatted = '+' . $cleanDigits;
            if (str_starts_with($cleanDigits, '54911') && strlen($cleanDigits) === 13) {
                $phoneFormatted = '+54 9 11 ' . substr($cleanDigits, 5, 4) . '-' . substr($cleanDigits, 9);
            } elseif (str_starts_with($cleanDigits, '549') && strlen($cleanDigits) >= 12) {
                $phoneFormatted = '+' . $cleanDigits;
            } elseif (str_starts_with($cleanDigits, '34') && strlen($cleanDigits) === 11) {
                $phoneFormatted = '+34 ' . substr($cleanDigits, 2, 3) . ' ' . substr($cleanDigits, 5, 2) . ' ' . substr($cleanDigits, 7, 2) . ' ' . substr($cleanDigits, 9);
            }

            $cat = 'consulta_general';
            $catLabel = 'Consulta WhatsApp';
            $lower = mb_strtolower($patientMsg);
            if (str_contains($lower, 'osde') || str_contains($lower, 'obra social')) {
                $cat = 'cobertura';
                $catLabel = '💳 Cobertura OSDE / Prepaga';
            } elseif (str_contains($lower, 'precio') || str_contains($lower, 'honorario') || $lower === 'c') {
                $cat = 'honorarios';
                $catLabel = '💰 Honorarios y Aranceles';
            } elseif ($waId === '34658444935' || $waId === '5492236807252') {
                $cat = 'prueba_admin';
                $catLabel = '🧪 Prueba Técnica';
            }

            if (!isset($existingMap[$key])) {
                $existingMap[$key] = [
                    'id' => 'exec_' . $eid,
                    'wa_id' => $waId,
                    'phone_formatted' => $phoneFormatted,
                    'patient_name' => is_martin_brude_phone($cleanDigits) ? 'Martín Brude' : $patientName,
                    'date' => $datePart,
                    'time' => $timePart,
                    'timestamp' => $started,
                    'answered' => false,
                    'answered_at' => null,
                    'archived' => false,
                    'archived_at' => null,
                    'category' => $cat,
                    'category_label' => $catLabel,
                    'summary' => mb_substr($patientMsg, 0, 120),
                    'messages' => [],
                ];
                $hasUpdates = true;
            }

            if (is_martin_brude_phone($cleanDigits)) {
                if (($existingMap[$key]['patient_name'] ?? '') !== 'Martín Brude') {
                    $existingMap[$key]['patient_name'] = 'Martín Brude';
                    $hasUpdates = true;
                }
            } elseif ($patientName !== '' && empty($existingMap[$key]['patient_name'])) {
                $existingMap[$key]['patient_name'] = $patientName;
                $hasUpdates = true;
            }

            $existingMap[$key]['time'] = $timePart;
            $existingMap[$key]['timestamp'] = $started;

            $currMsgs = &$existingMap[$key]['messages'];
            $lastMsg = end($currMsgs);
            if (!$lastMsg || ($lastMsg['text'] ?? '') !== $patientMsg || ($lastMsg['from'] ?? '') !== 'patient') {
                $currMsgs[] = [
                    'from' => 'patient',
                    'time' => $timePart,
                    'text' => $patientMsg,
                ];
                $hasUpdates = true;
            }
            if ($claraReply !== '') {
                $lastMsg = end($currMsgs);
                if (!$lastMsg || ($lastMsg['text'] ?? '') !== $claraReply || ($lastMsg['from'] ?? '') !== 'clara') {
                    $currMsgs[] = [
                        'from' => 'clara',
                        'time' => $timePart,
                        'text' => $claraReply,
                    ];
                    $hasUpdates = true;
                }
            }
            unset($currMsgs);
        }

        if ($hasUpdates) {
            $finalItems = array_values($existingMap);
            usort($finalItems, fn($a, $b) => strcmp((string)($b['timestamp'] ?? ''), (string)($a['timestamp'] ?? '')));
            save_interactions($dataFile, $finalItems);
        }

        @file_put_contents($lockFile, json_encode(['last_sync' => $now]), LOCK_EX);
    } catch (\Throwable $e) {
        // Silencioso para garantizar que la API continúe respondiendo
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $forceSync = !empty($_GET['sync']);
    sync_interactions_from_n8n($dataFile, $forceSync);

    $rawItems = load_interactions($dataFile);
    $items = [];
    $answeredCount = 0;
    $unansweredCount = 0;
    $archivedCount = 0;
    $grouped = [];
    $hasFixes = false;

    foreach ($rawItems as &$it) {
        if (is_martin_brude_phone($it['wa_id'] ?? '') || is_martin_brude_phone($it['phone_formatted'] ?? '')) {
            if (($it['patient_name'] ?? '') !== 'Martín Brude') {
                $it['patient_name'] = 'Martín Brude';
                $hasFixes = true;
            }
        }
        $it['answered'] = !empty($it['answered']);
        $it['archived'] = !empty($it['archived']);
        $items[] = $it;
        if ($it['archived']) {
            $archivedCount++;
        } elseif ($it['answered']) {
            $answeredCount++;
        } else {
            $unansweredCount++;
        }
        $grouped[$it['date'] ?? 'Otras fechas'][] = $it;
    }
    unset($it);

    if ($hasFixes) {
        save_interactions($dataFile, $rawItems);
    }

    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => count($items),
        'answered_count' => $answeredCount,
        'unanswered_count' => $unansweredCount,
        'archived_count' => $archivedCount,
        'items' => $items,
        'interactions' => $items,
        'grouped' => $grouped,
    ]);
}

if ($method === 'POST') {
    $input = read_json();
    $action = (string) ($input['action'] ?? '');

    if (!$isBotAuth && is_colaborador($auth ?? null) && ($action === 'archive' || $action === 'unarchive' || $action === 'sync_all' || $action === 'toggle_answered')) {
        json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura y no pueden modificar ni archivar conversaciones.']);
    }

    if ($action === 'archive' || $action === 'unarchive' || $action === 'toggle_answered') {
        $id = trim((string) ($input['id'] ?? ''));
        if ($id === '') {
            json_out(400, ['error' => 'id es requerido']);
        }
        $items = load_interactions($dataFile);
        $found = false;
        $nowIso = (new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('c');
        foreach ($items as &$it) {
            if (($it['id'] ?? '') === $id) {
                if ($action === 'archive') {
                    $it['archived'] = true;
                    $it['archived_at'] = $nowIso;
                } elseif ($action === 'unarchive') {
                    $it['archived'] = false;
                    $it['archived_at'] = null;
                } else {
                    $answered = (bool) ($input['answered'] ?? false);
                    $it['answered'] = $answered;
                    $it['answered_at'] = $answered ? $nowIso : null;
                }
                $found = true;
                break;
            }
        }
        unset($it);
        if (!$found) {
            json_out(404, ['error' => 'Conversación no encontrada']);
        }
        save_interactions($dataFile, $items);
        json_out(200, ['ok' => true, 'id' => $id, 'action' => $action]);
    }

    if ($action === 'sync_all') {
        $incoming = $input['items'] ?? [];
        if (!is_array($incoming)) {
            json_out(400, ['error' => 'items debe ser un arreglo']);
        }
        $current = load_interactions($dataFile);
        $mergedMap = [];
        foreach ($current as $c) {
            $k = (!empty($c['wa_id']) && !empty($c['date'])) ? ($c['wa_id'] . '_' . $c['date']) : ($c['id'] ?? '');
            if ($k !== '') $mergedMap[$k] = $c;
        }
        foreach ($incoming as $in) {
            $k = (!empty($in['wa_id']) && !empty($in['date'])) ? ($in['wa_id'] . '_' . $in['date']) : ($in['id'] ?? '');
            if ($k === '') continue;
            if (is_martin_brude_phone($in['wa_id'] ?? '') || is_martin_brude_phone($in['phone_formatted'] ?? '')) {
                $in['patient_name'] = 'Martín Brude';
            }
            if (isset($mergedMap[$k])) {
                $exist = $mergedMap[$k];
                if (!empty($exist['answered']) && empty($in['answered'])) {
                    $in['answered'] = true;
                    $in['answered_at'] = $exist['answered_at'] ?? null;
                }
                if (!empty($exist['archived']) && empty($in['archived'])) {
                    $in['archived'] = true;
                    $in['archived_at'] = $exist['archived_at'] ?? null;
                }
                $mergedMap[$k] = array_merge($exist, $in);
            } else {
                $mergedMap[$k] = $in;
            }
        }
        $finalItems = array_values($mergedMap);
        usort($finalItems, fn($a, $b) => strcmp((string)($b['timestamp'] ?? ''), (string)($a['timestamp'] ?? '')));
        save_interactions($dataFile, $finalItems);
        json_out(200, ['ok' => true, 'total' => count($finalItems), 'message' => 'Sincronizado']);
    }

    $waId = trim((string) ($input['wa_id'] ?? ''));
    $patientMessage = trim((string) ($input['patient_message'] ?? ''));
    $claraReply = trim((string) ($input['clara_reply'] ?? ''));
    $patientName = trim((string) ($input['patient_name'] ?? ''));
    $category = trim((string) ($input['category'] ?? 'consulta_general'));

    if (is_martin_brude_phone($waId)) {
        $patientName = 'Martín Brude';
    }

    if ($waId === '' || $patientMessage === '') {
        json_out(400, ['error' => 'wa_id y patient_message son requeridos']);
    }

    $items = load_interactions($dataFile);
    $now = new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires'));
    $dateStr = $now->format('Y-m-d');
    $timeStr = $now->format('H:i');
    $isoTimestamp = $now->format('c');

    $phoneDigits = preg_replace('/[^0-9]/', '', $waId);
    $phoneFormatted = '+' . $phoneDigits;
    if (str_starts_with($phoneDigits, '54911') && strlen($phoneDigits) === 13) {
        $phoneFormatted = '+54 9 11 ' . substr($phoneDigits, 5, 4) . '-' . substr($phoneDigits, 9);
    }

    $foundIdx = -1;
    foreach ($items as $idx => $it) {
        if (($it['wa_id'] ?? '') === $waId && ($it['date'] ?? '') === $dateStr) {
            $foundIdx = $idx;
            break;
        }
    }

    if ($foundIdx >= 0) {
        if (is_martin_brude_phone($waId)) {
            $items[$foundIdx]['patient_name'] = 'Martín Brude';
        } elseif ($patientName !== '' && empty($items[$foundIdx]['patient_name'])) {
            $items[$foundIdx]['patient_name'] = $patientName;
        }
        $items[$foundIdx]['time'] = $timeStr;
        $items[$foundIdx]['timestamp'] = $isoTimestamp;
        $items[$foundIdx]['messages'][] = [
            'from' => 'patient',
            'time' => $timeStr,
            'text' => $patientMessage,
        ];
        if ($claraReply !== '') {
            $items[$foundIdx]['messages'][] = [
                'from' => 'clara',
                'time' => $timeStr,
                'text' => $claraReply,
            ];
        }
    } else {
        $newConv = [
            'id' => 'conv_' . time() . '_' . substr($phoneDigits, -4),
            'wa_id' => $waId,
            'phone_formatted' => $phoneFormatted,
            'patient_name' => $patientName,
            'date' => $dateStr,
            'time' => $timeStr,
            'timestamp' => $isoTimestamp,
            'category' => $category,
            'category_label' => 'Consulta WhatsApp',
            'answered' => false,
            'answered_at' => null,
            'summary' => mb_substr($patientMessage, 0, 120),
            'messages' => [
                [
                    'from' => 'patient',
                    'time' => $timeStr,
                    'text' => $patientMessage,
                ],
            ],
        ];
        if ($claraReply !== '') {
            $newConv['messages'][] = [
                'from' => 'clara',
                'time' => $timeStr,
                'text' => $claraReply,
            ];
        }
        array_unshift($items, $newConv);
    }

    save_interactions($dataFile, $items);
    json_out(200, ['ok' => true, 'message' => 'Interacción guardada exitosamente']);
}

json_out(405, ['error' => 'Método no permitido']);
