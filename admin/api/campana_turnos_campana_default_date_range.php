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

/**
 * @return array{nombre:string,apellido:string}
 */
function campana_split_name(string $full): array
{
    $full = trim($full);
    if ($full === '') {
        return ['nombre' => '', 'apellido' => ''];
    }
    $parts = preg_split('/\s+/u', $full, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    return [
        'nombre' => $parts[0] ?? $full,
        'apellido' => $parts[1] ?? '',
    ];
}

/**
 * @return array{id:?int,nombre:string,apellido:string,viene_de_campana:bool}|null
 */

/**
 * @return array{id:?int,nombre:string,apellido:string,viene_de_campana:bool}|null
 */
function campana_match_paciente(PDO $pdo, string $phone, string $patientName, string $dni = ''): ?array
{
    $phone = clean_phone_number($phone);
    $dni = clean_patient_dni($dni);
    if (function_exists('find_existing_patient_match')) {
        $existing = find_existing_patient_match(
            $pdo,
            $phone !== '' && !is_placeholder_phone($phone) ? $phone : null,
            $patientName,
            $dni !== '' ? $dni : null
        );
        if ($existing) {
            return campana_paciente_row($existing);
        }
    }

    if ($phone !== '' && !is_placeholder_phone($phone)) {
        $stmt = $pdo->prepare(
            'SELECT id, nombre, apellido, nombre_completo, viene_de_campana
             FROM pacientes
             WHERE telefono = :tel OR telefono LIKE :tel_end
             LIMIT 1'
        );
        $stmt->execute([
            'tel' => $phone,
            'tel_end' => '%' . substr($phone, -8),
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            return campana_paciente_row($row);
        }
    }

    $nameKey = canonical_patient_name_key($patientName);
    if ($nameKey === '') {
        return null;
    }

    $stmt = $pdo->query(
        'SELECT id, nombre, apellido, nombre_completo, viene_de_campana FROM pacientes'
    );
    if (!$stmt) {
        return null;
    }
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cand = canonical_patient_name_key((string) ($row['nombre_completo'] ?? ''));
        if ($cand !== '' && $cand === $nameKey) {
            return campana_paciente_row($row);
        }
        $alt = canonical_patient_name_key(trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? '')));
        if ($alt !== '' && $alt === $nameKey) {
            return campana_paciente_row($row);
        }
    }
    return null;
}

/**
 * @param array<string,mixed> $row
 * @return array{id:int,nombre:string,apellido:string,viene_de_campana:bool}
 */

/**
 * @param array<string,mixed> $row
 * @return array{id:int,nombre:string,apellido:string,viene_de_campana:bool}
 */
function campana_paciente_row(array $row): array
{
    $nombre = trim((string) ($row['nombre'] ?? ''));
    $apellido = trim((string) ($row['apellido'] ?? ''));
    if ($nombre === '' && $apellido === '') {
        $split = campana_split_name((string) ($row['nombre_completo'] ?? ''));
        $nombre = $split['nombre'];
        $apellido = $split['apellido'];
    }
    $flag = array_key_exists('viene_de_campana', $row)
        ? ((int) $row['viene_de_campana'] !== 0)
        : true;

    return [
        'id' => (int) $row['id'],
        'nombre' => $nombre,
        'apellido' => $apellido,
        'viene_de_campana' => $flag,
    ];
}

/**
 * @param list<array<string,mixed>> $appointments
 * @return list<array<string,mixed>>
 */
