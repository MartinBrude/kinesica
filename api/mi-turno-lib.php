<?php
declare(strict_types=1);

/**
 * Helpers públicos para /api/mi-turno.php (lookup / cancel).
 */

function kinesica_mi_turno_cors(): void
{
    $allowedOrigins = [
        'https://www.kinesica.com.ar',
        'https://kinesica.com.ar',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

function kinesica_mi_turno_json(int $code, array $payload): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function kinesica_mi_turno_rate_ok(string $key, int $max, int $windowSec): bool
{
    try {
        $dir = rtrim(sys_get_temp_dir(), '/') . '/kinesica_mi_turno_rl';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        $file = $dir . '/' . hash('sha256', $key) . '.json';
        $now = time();
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return true;
        }
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $hits = json_decode($raw ?: '[]', true);
        if (!is_array($hits)) {
            $hits = [];
        }
        $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $windowSec));
        $ok = count($hits) < $max;
        if ($ok) {
            $hits[] = $now;
        }
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($hits));
        flock($fh, LOCK_UN);
        fclose($fh);
        return $ok;
    } catch (Throwable) {
        return true;
    }
}

/** @param array<string,mixed> $turno */
function kinesica_mi_turno_public_view(array $turno): array
{
    $starts = (string) ($turno['starts_at'] ?? '');
    $date = '';
    $time = '';
    if (preg_match('/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/', $starts, $m)) {
        $date = $m[1];
        $time = $m[2];
    }
    $policy = kinesica_rel_manage_cancel_allowed($turno);
    return [
        'paciente' => (string) (($turno['patient_name_snapshot'] ?? '') ?: ($turno['summary'] ?? '')),
        'fecha' => $date,
        'hora' => $time,
        'starts_at' => $starts,
        'status' => (string) ($turno['status'] ?? ''),
        'can_cancel' => !empty($policy['allowed']),
        'cancel_blocked_reason' => $policy['allowed'] ? null : ($policy['reason'] ?? 'policy'),
    ];
}

/**
 * Cancela en Calendar vía GAS (mismo calendario que Clara) y avisa webhook n8n si está configurado.
 *
 * @return array{ok:bool,via?:string,error?:string}
 */
function kinesica_mi_turno_cancel_calendar(string $calendarEventId, array $meta = []): array
{
    require_once __DIR__ . '/../admin/api/lib.php';
    require_once __DIR__ . '/../admin/api/lib_calendar_backup.php';

    $cfg = function_exists('cfg') ? cfg() : [];
    $secret = trim((string) (
        $cfg['gas_api_secret']
        ?? $cfg['webhook_secret']
        ?? $cfg['install_token']
        ?? ''
    ));
    $gasUrl = trim((string) (
        getenv('KINESICA_GAS_BOOKING_URL')
        ?: ($_SERVER['KINESICA_GAS_BOOKING_URL'] ?? $_ENV['KINESICA_GAS_BOOKING_URL'] ?? $cfg['gas_booking_url'] ?? KINESICA_BACKUP_DEFAULT_GAS_URL)
    ));

    $gasOk = false;
    $gasErr = '';
    if ($gasUrl !== '' && $gasUrl !== 'none' && $secret !== '' && function_exists('curl_init')) {
        $payload = [
            'action' => 'cancel',
            'secret' => $secret,
            'eventId' => $calendarEventId,
            'source' => 'web_mi_turno',
            'paciente' => (string) ($meta['paciente'] ?? ''),
            'fecha' => (string) ($meta['fecha'] ?? ''),
            'hora' => (string) ($meta['hora'] ?? ''),
        ];
        $ch = curl_init($gasUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 15,
        ]);
        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        if (!$err && $httpCode >= 200 && $httpCode < 300 && is_string($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && ($decoded['status'] ?? '') === 'success') {
                $gasOk = true;
            } else {
                $gasErr = is_array($decoded)
                    ? (string) ($decoded['message'] ?? 'GAS cancel failed')
                    : 'GAS respuesta inválida';
            }
        } else {
            $gasErr = $err ?: ("HTTP {$httpCode}");
        }
    } else {
        $gasErr = 'GAS no configurado';
    }

    // Camino Clara (2A): webhook n8n para avisos / lista de espera (best-effort).
    $n8nUrl = trim((string) ($cfg['clara_web_cancel_webhook_url'] ?? $cfg['n8n_web_cancel_url'] ?? ''));
    if ($n8nUrl !== '' && function_exists('curl_init')) {
        $n8nSecret = trim((string) ($cfg['webhook_secret'] ?? $secret));
        $ch2 = curl_init($n8nUrl);
        curl_setopt_array($ch2, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Webhook-Secret: ' . $n8nSecret,
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'action' => 'web_cancel',
                'calendar_event_id' => $calendarEventId,
                'eventId' => $calendarEventId,
                'secret' => $n8nSecret,
                'source' => 'web_mi_turno',
                'paciente' => (string) ($meta['paciente'] ?? ''),
                'fecha' => (string) ($meta['fecha'] ?? ''),
                'hora' => (string) ($meta['hora'] ?? ''),
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($ch2);
    }

    if ($gasOk) {
        return ['ok' => true, 'via' => 'gas'];
    }
    return ['ok' => false, 'error' => $gasErr ?: 'cancel_failed'];
}
