<?php
declare(strict_types=1);


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
