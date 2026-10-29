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
    if (!$raw) {
        return get_initial_seed_interactions();
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : get_initial_seed_interactions();
}

function save_interactions(string $dataFile, array $items): bool
{
    if (count($items) > 1000) {
        $items = array_slice($items, 0, 1000);
    }
    $dir = dirname($dataFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return (bool) @file_put_contents($dataFile, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $items = load_interactions($dataFile);
    foreach ($items as &$it) {
        $it['answered'] = (bool) ($it['answered'] ?? false);
    }
    unset($it);

    $grouped = [];
    foreach ($items as $item) {
        $dateKey = $item['date'] ?? 'Otras fechas';
        if (!isset($grouped[$dateKey])) {
            $grouped[$dateKey] = [];
        }
        $grouped[$dateKey][] = $item;
    }

    $answeredCount = 0;
    $unansweredCount = 0;
    foreach ($items as $it) {
        if (!empty($it['answered'])) {
            $answeredCount++;
        } else {
            $unansweredCount++;
        }
    }

    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => count($items),
        'answered_count' => $answeredCount,
        'unanswered_count' => $unansweredCount,
        'items' => $items,
        'interactions' => $items,
        'grouped' => $grouped,
    ]);
}

if ($method === 'POST') {
    $input = read_json();
    $action = (string) ($input['action'] ?? '');

    if ($action === 'toggle_answered') {
        $id = trim((string) ($input['id'] ?? ''));
        $answered = (bool) ($input['answered'] ?? false);
        if ($id === '') {
            json_out(400, ['error' => 'id es requerido']);
        }
        $items = load_interactions($dataFile);
        $found = false;
        foreach ($items as &$it) {
            if (($it['id'] ?? '') === $id) {
                $it['answered'] = $answered;
                $it['answered_at'] = $answered
                    ? (new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('c')
                    : null;
                $found = true;
                break;
            }
        }
        unset($it);
        if (!$found) {
            json_out(404, ['error' => 'Conversación no encontrada']);
        }
        save_interactions($dataFile, $items);
        json_out(200, ['ok' => true, 'id' => $id, 'answered' => $answered]);
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
