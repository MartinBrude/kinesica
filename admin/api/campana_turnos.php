<?php
declare(strict_types=1);

/**
 * Kinésica Admin — Listado de turnos de campaña (fuente: Google Calendar vía GAS).
 * Solo administradores.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/calendar_event_parse.php';
require_once __DIR__ . '/lib_calendar_backup.php';

require_header();
$auth = require_auth();
if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();
ensure_pacientes_tables($pdo);

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
function campana_build_rows(PDO $pdo, array $appointments): array
{
    $rows = [];
    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $title = trim((string) ($appt['title'] ?? ''));
        $patientName = trim((string) ($appt['patientName'] ?? ''));
        if ($patientName === '' && $title !== '') {
            $patientName = $title;
        }
        if ($patientName === '' || is_tk3_or_blocked_name($patientName) || is_tk3_or_blocked_name($title)) {
            continue;
        }

        $date = trim((string) ($appt['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            continue;
        }

        $description = (string) ($appt['description'] ?? '');
        $parsed = kinesica_extract_calendar_contacts($title . ' ' . $patientName, $description);
        $phone = clean_phone_number((string) ($appt['phone'] ?? ''));
        if ($phone === '' || is_placeholder_phone($phone)) {
            $phone = $parsed['phone'];
        }
        $dni = clean_patient_dni((string) ($appt['dni'] ?? ''));
        if ($dni === '') {
            $dni = $parsed['dni'];
        }
        $matched = campana_match_paciente($pdo, $phone, $patientName, $dni);
        $split = campana_split_name($patientName);

        $rows[] = [
            'paciente_id' => $matched['id'] ?? null,
            'nombre' => $matched['nombre'] ?? $split['nombre'],
            'apellido' => $matched['apellido'] ?? $split['apellido'],
            'fecha' => $date,
            'viene_de_campana' => $matched['viene_de_campana'] ?? true,
            'calendar_event_id' => (string) ($appt['eventId'] ?? ''),
            'telefono' => $phone,
            'dni' => $dni,
            'patient_name_raw' => $patientName,
        ];
    }

    usort($rows, static function (array $a, array $b): int {
        $cmp = strcmp((string) $a['fecha'], (string) $b['fecha']);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strcmp(
            mb_strtolower(trim($a['apellido'] . ' ' . $a['nombre']), 'UTF-8'),
            mb_strtolower(trim($b['apellido'] . ' ' . $b['nombre']), 'UTF-8')
        );
    });

    return $rows;
}

/**
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */
function campana_unique_persons(array $rows): array
{
    $byKey = [];
    foreach ($rows as $row) {
        $pid = $row['paciente_id'] ?? null;
        if ($pid) {
            $key = 'id:' . (int) $pid;
        } else {
            $phone = clean_phone_number((string) ($row['telefono'] ?? ''));
            if ($phone !== '' && !is_placeholder_phone($phone)) {
                $key = 'tel:' . $phone;
            } else {
                $nameKey = canonical_patient_name_key(
                    trim((string) ($row['patient_name_raw'] ?? ($row['nombre'] . ' ' . $row['apellido'])))
                );
                if ($nameKey === '') {
                    $nameKey = 'row:' . md5(json_encode($row) ?: uniqid('', true));
                }
                $key = 'name:' . $nameKey;
            }
        }

        if (!isset($byKey[$key])) {
            $byKey[$key] = $row;
            continue;
        }
        if (strcmp((string) $row['fecha'], (string) $byKey[$key]['fecha']) < 0) {
            $kept = $byKey[$key];
            $kept['fecha'] = $row['fecha'];
            $kept['calendar_event_id'] = $row['calendar_event_id'];
            $byKey[$key] = $kept;
        }
    }

    $out = array_values($byKey);
    usort($out, static function (array $a, array $b): int {
        $cmp = strcmp((string) $a['fecha'], (string) $b['fecha']);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strcmp(
            mb_strtolower(trim($a['apellido'] . ' ' . $a['nombre']), 'UTF-8'),
            mb_strtolower(trim($b['apellido'] . ' ' . $b['nombre']), 'UTF-8')
        );
    });
    return $out;
}

/**
 * Crea o actualiza un paciente mínimo y setea viene_de_campana.
 *
 * @return array{id:int,viene_de_campana:int}
 */
function campana_upsert_flag(
    PDO $pdo,
    ?int $pacienteId,
    string $nombre,
    string $apellido,
    string $phone,
    string $patientNameRaw,
    bool $flag
): array {
    $val = $flag ? 1 : 0;

    if ($pacienteId && $pacienteId > 0) {
        $stmt = $pdo->prepare('UPDATE pacientes SET viene_de_campana = :val WHERE id = :id');
        $stmt->execute(['val' => $val, 'id' => $pacienteId]);
        $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
        $chk->execute(['id' => $pacienteId]);
        if ($chk->fetch()) {
            return ['id' => $pacienteId, 'viene_de_campana' => $val];
        }
    }

    $full = trim($patientNameRaw !== '' ? $patientNameRaw : ($nombre . ' ' . $apellido));
    $full = sanitize_patient_name($full);
    if ($full === '' || is_tk3_or_blocked_name($full)) {
        json_out(422, ['status' => 'error', 'message' => 'Nombre de paciente inválido']);
    }
    $split = campana_split_name($full);
    $nombre = sanitize_patient_name($nombre !== '' ? $nombre : $split['nombre']);
    $apellido = sanitize_patient_name($apellido !== '' ? $apellido : $split['apellido']);
    $pila = extract_first_name($full);

    $matched = campana_match_paciente($pdo, $phone, $full);
    if ($matched) {
        $id = (int) $matched['id'];
        $stmt = $pdo->prepare('UPDATE pacientes SET viene_de_campana = :val WHERE id = :id');
        $stmt->execute(['val' => $val, 'id' => $id]);
        return ['id' => $id, 'viene_de_campana' => $val];
    }

    $tel = clean_phone_number($phone);
    if ($tel === '' || is_placeholder_phone($tel)) {
        $tel = 'sin-tel-camp-' . substr(md5($full), 0, 14);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, origen, viene_de_campana)
         VALUES (:tel, :nombre, :apellido, :full, :pila, :origen, :camp)
         ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            apellido = VALUES(apellido),
            nombre_completo = VALUES(nombre_completo),
            nombre_pila = VALUES(nombre_pila),
            viene_de_campana = VALUES(viene_de_campana)'
    );
    $stmt->execute([
        'tel' => $tel,
        'nombre' => mb_substr($nombre, 0, 60, 'UTF-8'),
        'apellido' => mb_substr($apellido, 0, 60, 'UTF-8'),
        'full' => mb_substr($full, 0, 120, 'UTF-8'),
        'pila' => mb_substr($pila !== '' ? $pila : $nombre, 0, 60, 'UTF-8'),
        'origen' => 'admin',
        'camp' => $val,
    ]);

    $id = (int) $pdo->lastInsertId();
    if ($id <= 0) {
        $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
        $find->execute(['tel' => $tel]);
        $found = $find->fetch(PDO::FETCH_ASSOC);
        $id = $found ? (int) $found['id'] : 0;
    }
    if ($id <= 0) {
        json_out(500, ['status' => 'error', 'message' => 'No se pudo crear el paciente para el flag de campaña']);
    }

    return ['id' => $id, 'viene_de_campana' => $val];
}

try {
    if ($method === 'GET') {
        [$defaultFrom, $defaultTo] = campana_default_date_range();
        $from = trim((string) ($_GET['from'] ?? $defaultFrom));
        $to = trim((string) ($_GET['to'] ?? $defaultTo));
        $unique = isset($_GET['unique']) && in_array((string) $_GET['unique'], ['1', 'true', 'yes'], true);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            json_out(422, ['status' => 'error', 'message' => 'from/to deben ser YYYY-MM-DD']);
        }
        if ($from > $to) {
            json_out(422, ['status' => 'error', 'message' => 'from no puede ser posterior a to']);
        }

        $gas = campana_fetch_appointments_from_gas($from, $to);
        if (!$gas['ok']) {
            json_out(502, [
                'status' => 'error',
                'message' => $gas['error'] ?? 'No se pudo leer el calendario',
                'hint' => 'Verificá que Apps Script tenga action=list_appointments desplegado y gas_api_secret alineado con GAS_API_SECRET.',
            ]);
        }

        $rows = campana_build_rows($pdo, $gas['appointments'] ?? []);
        // REL: espejo local turnos por calendar_event_id (best-effort; no falla la UI).
        try {
            require_once __DIR__ . '/lib_relational_turnos.php';
            // Sync sobre todas las citas del rango (antes de unique) para no perder event ids.
            kinesica_rel_sync_turnos_from_campana_rows($pdo, $rows);
        } catch (Throwable $e) {
            error_log('kinesica campana turnos sync: ' . $e->getMessage());
        }
        if ($unique) {
            $rows = campana_unique_persons($rows);
        }

        // No exponer telefono/raw al cliente salvo lo necesario para toggle.
        $items = array_map(static function (array $r): array {
            return [
                'paciente_id' => $r['paciente_id'],
                'nombre' => $r['nombre'],
                'apellido' => $r['apellido'],
                'fecha' => $r['fecha'],
                'viene_de_campana' => (bool) $r['viene_de_campana'],
                'calendar_event_id' => $r['calendar_event_id'],
                'telefono' => $r['telefono'] ?? '',
                'patient_name_raw' => $r['patient_name_raw'] ?? '',
            ];
        }, $rows);

        json_out(200, [
            'status' => 'success',
            'from' => $from,
            'to' => $to,
            'unique' => $unique,
            'total' => count($items),
            'items' => $items,
        ]);
    }

    if ($method === 'POST') {
        $data = read_json();
        $action = (string) ($data['action'] ?? 'toggle_campana');

        if ($action !== 'toggle_campana') {
            json_out(400, ['status' => 'error', 'message' => 'Acción desconocida']);
        }

        $pacienteId = isset($data['paciente_id']) ? (int) $data['paciente_id'] : 0;
        $flag = array_key_exists('viene_de_campana', $data)
            ? !empty($data['viene_de_campana'])
            : true;
        $nombre = trim((string) ($data['nombre'] ?? ''));
        $apellido = trim((string) ($data['apellido'] ?? ''));
        $phone = trim((string) ($data['telefono'] ?? ''));
        $rawName = trim((string) ($data['patient_name_raw'] ?? ''));

        $result = campana_upsert_flag(
            $pdo,
            $pacienteId > 0 ? $pacienteId : null,
            $nombre,
            $apellido,
            $phone,
            $rawName,
            $flag
        );

        json_out(200, [
            'status' => 'success',
            'paciente_id' => $result['id'],
            'viene_de_campana' => (bool) $result['viene_de_campana'],
        ]);
    }

    json_out(405, ['status' => 'error', 'message' => 'Método HTTP no permitido']);
} catch (Throwable $e) {
    error_log('kinesica admin campana_turnos.php error: ' . $e->getMessage());
    json_out(500, ['status' => 'error', 'message' => 'Error al procesar turnos de campaña: ' . $e->getMessage()]);
}
