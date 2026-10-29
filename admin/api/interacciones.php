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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $rawItems = load_interactions($dataFile);
    $items = [];
    $answeredCount = 0;
    $unansweredCount = 0;
    $archivedCount = 0;
    $grouped = [];

    foreach ($rawItems as &$it) {
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
        if ($patientName !== '' && empty($items[$foundIdx]['patient_name'])) {
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
