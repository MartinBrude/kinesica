<?php
declare(strict_types=1);


/**
 * @return array{0:string,1:string} [from, to] YYYY-MM-DD
 */
function campana_default_date_range(): array
{
    $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    $to = new DateTimeImmutable('today', $tz);
    $from = $to->modify('-2 months');
    return [$from->format('Y-m-d'), $to->format('Y-m-d')];
}


function campana_gas_url(): string
{
    return trim((string) (
        getenv('KINESICA_GAS_BOOKING_URL')
        ?: ($_SERVER['KINESICA_GAS_BOOKING_URL'] ?? $_ENV['KINESICA_GAS_BOOKING_URL'] ?? cfg()['gas_booking_url'] ?? KINESICA_BACKUP_DEFAULT_GAS_URL)
    ));
}


function campana_gas_secret(): string
{
    $c = cfg();
    $secret = trim((string) ($c['gas_api_secret'] ?? ''));
    if ($secret !== '') {
        return $secret;
    }
    return trim((string) ($c['webhook_secret'] ?? $c['install_token'] ?? ''));
}

/**
 * @return array{ok:bool,appointments?:list<array>,error?:string,http_code?:int}
 */

/**
 * @return array{ok:bool,appointments?:list<array>,error?:string,http_code?:int}
 */
function campana_fetch_appointments_from_gas(string $from, string $to): array
{
    $gasUrl = campana_gas_url();
    $secret = campana_gas_secret();
    if ($gasUrl === '' || $gasUrl === 'none') {
        return ['ok' => false, 'error' => 'GAS URL no disponible'];
    }
    if ($secret === '') {
        return ['ok' => false, 'error' => 'Falta gas_api_secret / webhook_secret para consultar el calendario'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'cURL no disponible'];
    }

    $payload = [
        'action' => 'list_appointments',
        'dateFrom' => $from,
        'dateTo' => $to,
        'secret' => $secret,
    ];

    $ch = curl_init($gasUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 45,
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);

    if ($err || !is_string($raw)) {
        return ['ok' => false, 'error' => $err ?: 'Sin respuesta de GAS', 'http_code' => $httpCode];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Respuesta inválida de GAS', 'http_code' => $httpCode];
    }
    if (($decoded['status'] ?? '') !== 'success') {
        $msg = (string) ($decoded['message'] ?? 'Error GAS list_appointments');
        if (stripos($msg, 'no reconocida') !== false) {
            $msg = 'El Apps Script en producción todavía no tiene list_appointments. '
                . 'Pegá booking/google-apps-script.js en el editor de GAS y hacé Deploy → Manage deployments → Edit → New version. '
                . 'El ping debe devolver code_version v23-dni-not-phone.';
        } elseif (stripos($msg, 'unauthorized') !== false) {
            $msg = 'Secret no autorizado contra Apps Script. '
                . 'En Script properties de GAS, GAS_API_SECRET (o WEBHOOK_SECRET) debe coincidir con webhook_secret de config.php '
                . '(o definí gas_api_secret en config.php con el valor de GAS_API_SECRET). '
                . 'Después redeploy si cambiaste el código a v21.';
        }
        return [
            'ok' => false,
            'error' => $msg,
            'http_code' => $httpCode,
        ];
    }

    $list = $decoded['appointments'] ?? [];
    if (!is_array($list)) {
        $list = [];
    }

    return ['ok' => true, 'appointments' => $list, 'http_code' => $httpCode];
}

/**
 * @return array{nombre:string,apellido:string}
 */

function campana_clean_name_string(string $full): string
{
    $s = trim($full);
    // Quitar números telefónicos o dígitos largos
    $s = preg_replace('/\b\d{6,14}\b/', ' ', $s) ?? $s;
    // Quitar palabras de ruido de turnos
    $s = preg_replace('/\b(?:turno|aca|acá)\b/iu', ' ', $s) ?? $s;
    $s = preg_replace('/\s+/u', ' ', trim($s)) ?? '';
    return trim($s, " ,-");
}

/**
 * @return array{nombre:string,apellido:string}
 */
function campana_split_name(string $full): array
{
    $cleaned = campana_clean_name_string($full);
    if ($cleaned === '') {
        $cleaned = trim($full);
    }
    if ($cleaned === '') {
        return ['nombre' => '', 'apellido' => ''];
    }
    if (str_contains($cleaned, ',')) {
        $parts = explode(',', $cleaned, 2);
        $ape = trim($parts[0]);
        $nom = trim($parts[1]);
        return ['nombre' => $nom !== '' ? $nom : $ape, 'apellido' => $nom !== '' ? $ape : ''];
    }
    $parts = preg_split('/\s+/u', $cleaned, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    return [
        'nombre' => $parts[0] ?? $cleaned,
        'apellido' => $parts[1] ?? '',
    ];
}

require_once __DIR__ . '/campana_turnos_campana_match_paciente.php';

/**
 * @param list<array<string,mixed>> $appointments
 * @return list<array<string,mixed>>
 */
