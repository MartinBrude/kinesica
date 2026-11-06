<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/pacientes_ops.php';

function authenticate_request(?array &$bodyData = null): array
{
    $config = cfg();
    $expectedSecret = (string) ($config['webhook_secret'] ?? $config['install_token'] ?? '');

    $botTokenOk = static function (string $token): bool {
        if (strlen($token) < 32) return false;
        $hashFile = __DIR__ . '/bot_token.sha256';
        $expectedHash = is_file($hashFile) ? strtolower(trim((string) file_get_contents($hashFile))) : '';
        return strlen($expectedHash) === 64 && hash_equals($expectedHash, hash('sha256', $token));
    };

    $headerToken = (string) ($_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '');
    $authHeaderRaw = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (str_starts_with($authHeaderRaw, 'Bearer ')) {
        $headerToken = $headerToken !== '' ? $headerToken : trim(substr($authHeaderRaw, 7));
    }
    if ($headerToken !== '' && $botTokenOk($headerToken)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($authHeader, 'Bearer ')) {
        $token = trim(substr($authHeader, 7));
        if ($expectedSecret !== '' && hash_equals($expectedSecret, $token)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    $webhookHeader = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '';
    if ($webhookHeader !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $webhookHeader)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'POST' || $method === 'PUT') {
        if ($bodyData === null) $bodyData = read_json();
        $payloadSecret = (string) ($bodyData['secret'] ?? $bodyData['token'] ?? '');
        if ($payloadSecret !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $payloadSecret)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    require_header();
    $user = require_auth();
    return [
        'type' => 'session',
        'user' => $user['username'],
        'name' => $user['name'],
        'role' => $user['role'] ?? 'professional',
    ];
}

try {
    $data = null;
    $auth = authenticate_request($data);
    $pdo = db();
    ensure_pacientes_tables($pdo);
    // Mantenimiento pesado (dedupe/sync/indistintos) NO corre en cada request:
    // está throttled dentro de ensure_pacientes_tables y también vía action=deduplicate.
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        if ($action === 'directory' || $action === 'get_directory') {
            $stmt = $pdo->query("SELECT nombre, apellido, nombre_completo, telefono, email FROM pacientes WHERE LOWER(nombre_completo) NOT LIKE '%tk3%' AND LOWER(nombre_completo) NOT LIKE '%tk 3%' AND LOWER(nombre_completo) NOT LIKE '%no dar%'");
            $directory = [];
            $emails = [];
            while ($row = $stmt->fetch()) {
                $rawTel = trim((string) ($row['telefono'] ?? ''));
                $tel = clean_phone_number($rawTel);
                $email = trim((string) ($row['email'] ?? ''));
                $keys = [];
                $norm = normalize_search_key($row['nombre_completo'] ?? '');
                if ($norm !== '') $keys[] = $norm;
                if (!empty($row['nombre_completo'])) $keys[] = (string) $row['nombre_completo'];
                $firstLast = trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''));
                if ($firstLast !== '') $keys[] = $firstLast;
                $lastFirst = trim(($row['apellido'] ?? '') . ' ' . ($row['nombre'] ?? ''));
                if ($lastFirst !== '') $keys[] = $lastFirst;
                foreach (array_unique($keys) as $k) {
                    if ($tel !== '') $directory[$k] = $tel;
                    if ($email !== '' && is_valid_email_strict($email)) $emails[$k] = strtolower($email);
                }
            }
            json_out(200, ['status' => 'success', 'directory' => $directory, 'emails' => $emails]);
        }

        if ($action === 'get_email_by_phone') {
            $phone = clean_phone_number((string) ($_GET['telefono'] ?? ''));
            if ($phone !== '') {
                $stmt = $pdo->prepare('SELECT email FROM pacientes WHERE telefono = :tel OR telefono LIKE :tel_end LIMIT 1');
                $stmt->execute(['tel' => $phone, 'tel_end' => '%' . substr($phone, -8)]);
                $row = $stmt->fetch();
                if ($row && !empty($row['email'])) json_out(200, ['status' => 'success', 'email' => $row['email']]);
            }
            json_out(200, ['status' => 'not_found', 'email' => '']);
        }

        if ($action === 'waitlist') {
            $stmt = $pdo->query('SELECT * FROM lista_espera WHERE estado = "activa" ORDER BY created_at DESC');
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            try {
                require_once __DIR__ . '/lib_relational_read.php';
                $items = kinesica_rel_map_lista_rows($pdo, $items);
            } catch (Throwable) {
            }
            json_out(200, ['status' => 'success', 'items' => $items]);
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            // Un named param por cláusula: PDO nativo no reutiliza :q.
            $like = '%' . $q . '%';
            $stmt = $pdo->prepare('
                SELECT * FROM pacientes 
                WHERE (nombre_completo LIKE :q1 OR nombre LIKE :q2 OR apellido LIKE :q3 OR telefono LIKE :q4 OR dni LIKE :q5 OR email LIKE :q6 OR contacto_nombre LIKE :q7 OR contacto_telefono LIKE :q8)
                  AND LOWER(nombre_completo) NOT LIKE "%tk3%" AND LOWER(nombre_completo) NOT LIKE "%tk 3%"
                  AND LOWER(nombre_completo) NOT LIKE "%no dar%"
                ORDER BY CASE WHEN apellido != "" THEN apellido ELSE nombre_completo END ASC, nombre ASC LIMIT 100
            ');
            $stmt->execute([
                'q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like,
                'q5' => $like, 'q6' => $like, 'q7' => $like, 'q8' => $like,
            ]);
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        $stmt = $pdo->query('SELECT * FROM pacientes WHERE LOWER(nombre_completo) NOT LIKE "%tk3%" AND LOWER(nombre_completo) NOT LIKE "%tk 3%" AND LOWER(nombre_completo) NOT LIKE "%no dar%" ORDER BY CASE WHEN apellido != "" THEN apellido ELSE nombre_completo END ASC, nombre ASC');
        json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        if ($data === null) $data = read_json();
        $action = $data['action'] ?? 'upsert';

        if (is_colaborador($auth) && $action !== 'get_email_by_phone') {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
        }

        // La invitación dispara un mensaje real a un paciente: no debe quedar
        // disponible para integraciones autenticadas únicamente con el secreto
        // de webhook.
        if ($action === 'send_encuesta_invite' && (($auth['type'] ?? '') !== 'session' || !is_admin($auth))) {
            json_out(403, ['status' => 'error', 'message' => 'Solo un administrador con sesión puede enviar invitaciones de encuesta.']);
        }

        if ($action === 'get_email_by_phone') {
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
            if ($phone !== '') {
                $stmt = $pdo->prepare('SELECT email FROM pacientes WHERE telefono = :tel OR telefono LIKE :tel_end LIMIT 1');
                $stmt->execute(['tel' => $phone, 'tel_end' => '%' . substr($phone, -8)]);
                $row = $stmt->fetch();
                if ($row && !empty($row['email'])) json_out(200, ['status' => 'success', 'email' => $row['email']]);
            }
            json_out(200, ['status' => 'not_found', 'email' => '']);
        }

        if ($action === 'send_fallback_email' || $action === 'send_email') {
            $to = trim((string) ($data['to'] ?? 'norberto1712@gmail.com'));
            $subject = trim((string) ($data['subject'] ?? 'Aviso Kinésica'));
            $html = (string) ($data['html'] ?? $data['body'] ?? '');
            $text = (string) ($data['text'] ?? strip_tags($html));
            $sent = send_html_mail($to, $subject, $html, $text);
            json_out(200, ['status' => $sent ? 'success' : 'error', 'message' => $sent ? 'Correo enviado' : 'Error al enviar correo']);
        }

        if ($action === 'deduplicate' || $action === 'resolve_indistintos') {
            // Solo dedupe/indistintos livianos. El mantenimiento completo (sync fichas)
            // queda para cron / force=true; dispararlo acá tumbaba el listado y el alta.
            $merged = deduplicate_pacientes_table($pdo);
            $resolved = resolve_indistinto_pacientes_from_calendar($pdo);
            $cntStmt = $pdo->query('SELECT COUNT(*) FROM pacientes');
            $total = (int) $cntStmt->fetchColumn();
            json_out(200, ['status' => 'success', 'merged' => $merged, 'resolved' => $resolved, 'total' => $total]);
        }

        if ($action === 'upsert' || $action === 'insert') {
            kinesica_pacientes_upsert($pdo, $data);
        }

        if ($action === 'update_name') {
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
            $nombre = sanitize_patient_name((string) ($data['nombre'] ?? ''));
            $apellido = sanitize_patient_name((string) ($data['apellido'] ?? ''));
            $nombreCompleto = sanitize_patient_name((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? ''));
            if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) $nombreCompleto = trim($nombre . ' ' . $apellido);
            elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
                $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $nombre = $parts[0] ?? $nombreCompleto;
                $apellido = $parts[1] ?? '';
            }
            if ($phone === '' || $nombreCompleto === '') json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre requeridos']);
            if (is_tk3_or_blocked_name($nombreCompleto) || is_tk3_or_blocked_name($nombre)) {
                json_out(422, ['status' => 'error', 'message' => 'El nombre no corresponde a un paciente válido']);
            }
            $stmt = $pdo->prepare('UPDATE pacientes SET nombre = :nombre, apellido = :apellido, nombre_completo = :full, nombre_pila = :pila WHERE telefono = :tel');
            $stmt->execute(['nombre' => $nombre, 'apellido' => $apellido, 'full' => $nombreCompleto, 'pila' => extract_first_name($nombreCompleto), 'tel' => $phone]);
            json_out(200, ['status' => 'success', 'updated' => $stmt->rowCount()]);
        }

        if ($action === 'update_phone') {
            $id = (int) ($data['id'] ?? 0);
            $newPhone = clean_phone_number((string) ($data['nuevo_telefono'] ?? ''));
            if ($id <= 0 || strlen($newPhone) < 6 || strlen($newPhone) > 16 || preg_match('/^(\d)\1+$/', $newPhone)) {
                json_out(422, ['status' => 'error', 'message' => 'ID o teléfono inválido']);
            }
            $check = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel AND id != :id');
            $check->execute(['tel' => $newPhone, 'id' => $id]);
            $existing = $check->fetch();
            if ($existing) json_out(409, ['status' => 'error', 'message' => 'Ese teléfono ya está asignado al paciente ' . $existing['nombre_completo']]);
            $stmt = $pdo->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id');
            $stmt->execute(['tel' => $newPhone, 'id' => $id]);
            json_out(200, ['status' => 'success', 'id' => $id, 'nuevo_telefono' => $newPhone]);
        }

        if ($action === 'toggle_review') {
            $id = (int) ($data['id'] ?? 0);
            if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
            $val = !empty($data['dejo_review']) ? 1 : 0;
            $stmt = $pdo->prepare('UPDATE pacientes SET dejo_review = :val WHERE id = :id');
            $stmt->execute(['val' => $val, 'id' => $id]);
            json_out(200, ['status' => 'success', 'id' => $id, 'dejo_review' => $val]);
        }

        if ($action === 'toggle_campana') {
            $id = (int) ($data['id'] ?? 0);
            if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
            $val = array_key_exists('viene_de_campana', $data)
                ? (!empty($data['viene_de_campana']) ? 1 : 0)
                : 1;
            $stmt = $pdo->prepare('UPDATE pacientes SET viene_de_campana = :val WHERE id = :id');
            $stmt->execute(['val' => $val, 'id' => $id]);
            if ($stmt->rowCount() === 0) {
                $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
                $chk->execute(['id' => $id]);
                if (!$chk->fetch()) {
                    json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
                }
            }
            json_out(200, ['status' => 'success', 'id' => $id, 'viene_de_campana' => $val]);
        }

        if ($action === 'send_encuesta_invite') {
            $id = (int) ($data['id'] ?? 0);
            if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);

            $stmt = $pdo->prepare('SELECT id, telefono, nombre, apellido, nombre_completo, nombre_pila, encuesta_enviada FROM pacientes WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
            $paciente = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$paciente) {
                json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
            }
            if (!empty($paciente['encuesta_enviada'])) {
                json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
            }

            $phone = clean_phone_number((string) ($paciente['telefono'] ?? ''));
            if ($phone === '' || is_placeholder_phone($phone)) {
                json_out(422, ['status' => 'error', 'message' => 'El paciente no tiene un teléfono de WhatsApp válido']);
            }

            // Claim atómico antes del WhatsApp: evita doble envío por doble clic / tabs.
            $claim = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 1 WHERE id = :id AND encuesta_enviada = 0');
            $claim->execute(['id' => $id]);
            if ($claim->rowCount() < 1) {
                json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
            }

            $firstName = trim((string) ($paciente['nombre_pila'] ?? ''));
            if ($firstName === '') {
                $firstName = trim((string) ($paciente['nombre'] ?? ''));
            }
            if ($firstName === '' && !empty($paciente['nombre_completo'])) {
                $parts = preg_split('/\s+/u', trim((string) $paciente['nombre_completo']), 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $firstName = $parts[0] ?? '';
            }
            $saludo = $firstName !== '' ? ('Hola ' . $firstName . '!') : 'Hola!';
            $body = $saludo . "\n"
                . "Te escribo de Kinésica. Nos ayudaría mucho que respondas esta breve encuesta anónima sobre tu experiencia (menos de un minuto):\n"
                . "https://www.kinesica.com.ar/encuesta.html\n"
                . "¡Muchas gracias!";

            $waResult = send_whatsapp_alert_payload([
                'to' => $phone,
                'body' => $body,
                'preview_url' => true,
            ]);
            if (empty($waResult['ok'])) {
                // Liberar el claim para poder reintentar.
                try {
                    $release = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 0 WHERE id = :id AND encuesta_enviada = 1');
                    $release->execute(['id' => $id]);
                } catch (Throwable $e) {
                    error_log('send_encuesta_invite release flag failed: ' . $e->getMessage());
                }
                $err = (string) ($waResult['error'] ?? 'No se pudo enviar el WhatsApp');
                json_out(502, [
                    'status' => 'error',
                    'message' => $err,
                    'wa' => $waResult,
                ]);
            }

            json_out(200, [
                'status' => 'success',
                'id' => $id,
                'encuesta_enviada' => 1,
                'via' => $waResult['via'] ?? null,
            ]);
        }

        if (str_starts_with($action, 'waitlist_') || str_ends_with($action, '_waitlist')) {
            kinesica_pacientes_waitlist_ops($pdo, $action, $data);
        }

        json_out(400, ['status' => 'error', 'message' => 'Acción desconocida']);
    }

    if ($method === 'PUT') {
        if (is_colaborador($auth)) {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
        }
        if ($data === null) $data = read_json();
        kinesica_pacientes_update($pdo, $data);
    }

    if ($method === 'DELETE') {
        if (is_colaborador($auth)) {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador no tienen permiso para eliminar pacientes']);
        }
        $user = $auth['username'] ?? '';
        $allowedUsers = ['martin', 'norberto', 'maria'];
        if (!is_admin($auth) && !in_array($user, $allowedUsers, true)) {
            json_out(403, ['status' => 'error', 'message' => 'No tienes permiso para eliminar pacientes']);
        }
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
        $stmt = $pdo->prepare('DELETE FROM pacientes WHERE id = :id');
        $stmt->execute(['id' => $id]);
        json_out(200, ['status' => 'success', 'message' => 'Paciente eliminado']);
    }

    json_out(405, ['status' => 'error', 'message' => 'Método HTTP no permitido']);
} catch (Throwable $e) {
    error_log('kinesica admin pacientes.php error: ' . $e->getMessage());
    json_out(500, ['status' => 'error', 'message' => 'Error al procesar pacientes: ' . $e->getMessage()]);
}
