<?php
declare(strict_types=1);

/**
 * Integración de anulación en Google Calendar (vía GAS) y notificación n8n para /api/mi-turno.php.
 */

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
            'practitionerId' => (string) ($meta['practitionerId'] ?? ''),
        ];
        $query = http_build_query($payload, '', '&', PHP_QUERY_RFC3986);
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
