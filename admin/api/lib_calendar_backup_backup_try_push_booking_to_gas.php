<?php
declare(strict_types=1);


/**
 * Intenta sincronizar inmediatamente desde el servidor una reserva tomada en modo respaldo hacia Google Apps Script.
 *
 * @return array{synced: bool, google_event_id?: string, error?: string}
 */
function kinesica_backup_try_push_booking_to_gas(array $payload): array
{
    $gasUrl = trim((string) (
        getenv('KINESICA_GAS_BOOKING_URL')
        ?: ($_SERVER['KINESICA_GAS_BOOKING_URL'] ?? $_ENV['KINESICA_GAS_BOOKING_URL'] ?? cfg()['gas_booking_url'] ?? KINESICA_BACKUP_DEFAULT_GAS_URL)
    ));
    if ($gasUrl === '' || $gasUrl === 'none' || !function_exists('curl_init')) {
        return ['synced' => false, 'error' => 'GAS URL no disponible'];
    }

    $forwardPayload = array_merge($payload, [
        'action' => 'book',
        'from_backup_server' => true,
    ]);

    $ch = curl_init($gasUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
        CURLOPT_POSTFIELDS => json_encode($forwardPayload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 12,
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);

    if ($err || $httpCode < 200 || $httpCode >= 300 || !is_string($raw)) {
        return ['synced' => false, 'error' => $err ?: ("HTTP {$httpCode}")];
    }
    $decoded = json_decode($raw, true);
    if (is_array($decoded) && ($decoded['status'] ?? '') === 'success') {
        return [
            'synced' => true,
            'google_event_id' => (string) ($decoded['eventId'] ?? 'OK'),
        ];
    }
    return [
        'synced' => false,
        'error' => is_array($decoded) ? (string) ($decoded['message'] ?? 'Error GAS') : 'Respuesta inválida',
    ];
}
