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
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        if ($action === 'directory' || $action === 'get_directory') {
            $stmt = $pdo->query('SELECT nombre, apellido, nombre_completo, telefono FROM pacientes WHERE telefono IS NOT NULL AND telefono != ""');
            $directory = [];
            while ($row = $stmt->fetch()) {
                $tel = (string) $row['telefono'];
                $norm = normalize_search_key($row['nombre_completo']);
                if ($norm !== '') $directory[$norm] = $tel;
                if (!empty($row['nombre_completo'])) $directory[$row['nombre_completo']] = $tel;
                $firstLast = trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''));
                if ($firstLast !== '') $directory[$firstLast] = $tel;
                $lastFirst = trim(($row['apellido'] ?? '') . ' ' . ($row['nombre'] ?? ''));
                if ($lastFirst !== '') $directory[$lastFirst] = $tel;
            }
            json_out(200, ['status' => 'success', 'directory' => $directory]);
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
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            $stmt = $pdo->prepare('
                SELECT * FROM pacientes 
                WHERE nombre_completo LIKE :q OR nombre LIKE :q OR apellido LIKE :q OR telefono LIKE :q OR dni LIKE :q OR email LIKE :q OR contacto_nombre LIKE :q OR contacto_telefono LIKE :q
                ORDER BY CASE WHEN apellido != "" THEN apellido ELSE nombre_completo END ASC, nombre ASC LIMIT 100
            ');
            $stmt->execute(['q' => "%$q%"]);
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        $stmt = $pdo->query('SELECT * FROM pacientes ORDER BY CASE WHEN apellido != "" THEN apellido ELSE nombre_completo END ASC, nombre ASC');
        json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        if ($data === null) $data = read_json();
        $action = $data['action'] ?? 'upsert';

        if (is_colaborador($auth) && $action !== 'get_email_by_phone') {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
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

        if ($action === 'upsert' || $action === 'insert') {
            kinesica_pacientes_upsert($pdo, $data);
        }

        if ($action === 'update_name') {
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
            $nombre = trim((string) ($data['nombre'] ?? ''));
            $apellido = trim((string) ($data['apellido'] ?? ''));
            $nombreCompleto = trim((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? ''));
            if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) $nombreCompleto = trim($nombre . ' ' . $apellido);
            elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
                $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $nombre = $parts[0] ?? $nombreCompleto;
                $apellido = $parts[1] ?? '';
            }
            if ($phone === '' || $nombreCompleto === '') json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre requeridos']);
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
