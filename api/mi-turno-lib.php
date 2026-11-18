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

/**
 * @param array<string,mixed> $turno
 * @param array{id?:string,name?:string,whatsappDigits?:string,waMe?:string}|null $practitioner
 */
function kinesica_mi_turno_public_view(array $turno, ?array $practitioner = null): array
{
    $starts = (string) ($turno['starts_at'] ?? '');
    $date = '';
    $time = '';
    if (preg_match('/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/', $starts, $m)) {
        $date = $m[1];
        $time = $m[2];
    }
    $policy = kinesica_rel_manage_cancel_allowed($turno);
    $out = [
        'paciente' => (string) (($turno['patient_name_snapshot'] ?? '') ?: ($turno['summary'] ?? '')),
        'fecha' => $date,
        'hora' => $time,
        'starts_at' => $starts,
        'status' => (string) ($turno['status'] ?? ''),
        'can_cancel' => !empty($policy['allowed']),
        'cancel_blocked_reason' => $policy['allowed'] ? null : ($policy['reason'] ?? 'policy'),
    ];
    if (is_array($practitioner) && !empty($practitioner['id'])) {
        $out['profesional'] = [
            'id' => (string) $practitioner['id'],
            'name' => (string) ($practitioner['name'] ?? ''),
            'whatsappDigits' => (string) ($practitioner['whatsappDigits'] ?? ''),
            'whatsapp' => (string) ($practitioner['waMe'] ?? ''),
        ];
    }
    return $out;
}

/**
 * Contacto WhatsApp del profesional del turno (fallback: Norberto).
 *
 * @param array<string,mixed> $turno
 * @return array{id:string,name:string,whatsappDigits:string,waMe:string}
 */
function kinesica_mi_turno_practitioner_contact(PDO $pdo, array $turno): array
{
    $catalog = [
        'norberto' => ['id' => 'norberto', 'name' => 'Norberto', 'whatsapp' => '5491161564311'],
        'maria' => ['id' => 'maria', 'name' => 'María', 'whatsapp' => '5491128531224'],
    ];

    $slug = '';
    $profId = isset($turno['profesional_id']) ? (int) $turno['profesional_id'] : 0;
    if ($profId > 0 && function_exists('kinesica_rel_profesionales_ready') && kinesica_rel_profesionales_ready($pdo)) {
        try {
            $st = $pdo->prepare('SELECT slug, display_name, phone FROM profesionales WHERE id = :id LIMIT 1');
            $st->execute(['id' => $profId]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
            $slug = strtolower(trim((string) ($row['slug'] ?? '')));
            if ($slug !== '' && isset($catalog[$slug])) {
                $phone = preg_replace('/\D+/', '', (string) ($row['phone'] ?? '')) ?: $catalog[$slug]['whatsapp'];
                $name = trim((string) ($row['display_name'] ?? '')) ?: $catalog[$slug]['name'];
                if ($phone !== '' && !str_starts_with($phone, '54')) {
                    $phone = '54' . $phone;
                }
                return [
                    'id' => $slug,
                    'name' => $name,
                    'whatsappDigits' => $phone,
                    'waMe' => 'https://wa.me/' . $phone,
                ];
            }
        } catch (Throwable) {
            // continue fallbacks
        }
    }

    $hay = strtoupper(
        (string) (($turno['summary'] ?? '') . ' ' . ($turno['patient_name_snapshot'] ?? ''))
    );
    if (str_contains($hay, '[MARIA]') || str_contains($hay, '[MARÍA]')) {
        $slug = 'maria';
    } elseif (str_contains($hay, '[NORBERTO]')) {
        $slug = 'norberto';
    }

    if ($slug === '' || !isset($catalog[$slug])) {
        $slug = 'norberto';
    }

    // Override phones from admin settings if present.
    try {
        $settingsFile = dirname(__DIR__) . '/admin/api/settings.json';
        if (is_file($settingsFile)) {
            $rawSettings = json_decode((string) file_get_contents($settingsFile), true);
            $phones = is_array($rawSettings['practitioner_phones'] ?? null)
                ? $rawSettings['practitioner_phones']
                : [];
            $override = preg_replace('/\D+/', '', (string) ($phones[$slug] ?? ''));
            if ($override !== '') {
                if (!str_starts_with($override, '54')) {
                    $override = '54' . $override;
                }
                $catalog[$slug]['whatsapp'] = $override;
            }
        }
    } catch (Throwable) {
    }

    $p = $catalog[$slug];
    return [
        'id' => $p['id'],
        'name' => $p['name'],
        'whatsappDigits' => $p['whatsapp'],
        'waMe' => 'https://wa.me/' . $p['whatsapp'],
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
        $query = http_build_query([
            'action' => 'cancel',
            'secret' => $secret,
            'eventId' => $calendarEventId,
            'source' => 'web_mi_turno',
            'paciente' => (string) ($meta['paciente'] ?? ''),
            'fecha' => (string) ($meta['fecha'] ?? ''),
            'hora' => (string) ($meta['hora'] ?? ''),
            'practitionerId' => (string) ($meta['practitionerId'] ?? ''),
        ], '', '&', PHP_QUERY_RFC3986);
        // Preferir GET (como /agendar book): el deploy público a veces responde 405 a POST.
        $ch = curl_init($gasUrl . (str_contains($gasUrl, '?') ? '&' : '?') . $query);
        curl_setopt_array($ch, [
            CURLOPT_HTTPGET => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);

        if (!$err && $httpCode >= 200 && $httpCode < 300 && is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && ($decoded['status'] ?? '') === 'success') {
                $gasOk = true;
            } else {
                $gasErr = is_array($decoded)
                    ? (string) ($decoded['message'] ?? 'GAS cancel failed')
                    : 'GAS respuesta inválida';
            }
        } else {
            // Fallback POST text/plain (mismo estilo que booking-api-client).
            $payload = [
                'action' => 'cancel',
                'secret' => $secret,
                'eventId' => $calendarEventId,
                'source' => 'web_mi_turno',
                'paciente' => (string) ($meta['paciente'] ?? ''),
                'fecha' => (string) ($meta['fecha'] ?? ''),
                'hora' => (string) ($meta['hora'] ?? ''),
                'practitionerId' => (string) ($meta['practitionerId'] ?? ''),
            ];
            $ch2 = curl_init($gasUrl);
            curl_setopt_array($ch2, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_TIMEOUT => 20,
            ]);
            $raw2 = curl_exec($ch2);
            $http2 = (int) curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            $err2 = curl_error($ch2);
            if (!$err2 && $http2 >= 200 && $http2 < 300 && is_string($raw2)) {
                $decoded2 = json_decode($raw2, true);
                if (is_array($decoded2) && ($decoded2['status'] ?? '') === 'success') {
                    $gasOk = true;
                } else {
                    $gasErr = is_array($decoded2)
                        ? (string) ($decoded2['message'] ?? 'GAS cancel failed')
                        : 'GAS respuesta inválida';
                }
            } else {
                $gasErr = $err ?: $err2 ?: ("HTTP {$httpCode}/{$http2}");
            }
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
