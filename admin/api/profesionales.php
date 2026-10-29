<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/profesionales_sync.php';
require_once __DIR__ . '/profesionales_invite.php';

require_header();
$auth = require_auth();
$pdo = db();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

ensure_users_role_column();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT username, display_name, first_name, last_name, email, telefono, role, active, totp_confirmed, login_count
         FROM users 
         ORDER BY (role = "admin") DESC, (username = "norberto") DESC, (username = "maria") DESC, (username = "facundo") DESC, display_name ASC'
    );
    $users = $stmt->fetchAll();
    foreach ($users as &$u) {
        $u['name'] = (string) ($u['display_name'] ?: trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')));
        if ($u['name'] === '') $u['name'] = (string) $u['username'];
        $u['active'] = (int) ($u['active'] ?? 1);
        $u['totp_confirmed'] = (int) ($u['totp_confirmed'] ?? 0);
        $u['login_count'] = (int) ($u['login_count'] ?? 0);
    }
    unset($u);

    json_out(200, [
        'status' => 'success',
        'count' => count($users),
        'users' => $users,
        'profesionales' => $users,
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

if ($action === 'create') {
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $email = trim((string) ($input['email'] ?? ''));
    $telefono = preg_replace('/[^0-9]/', '', (string) ($input['telefono'] ?? '')) ?? '';
    $role = (string) ($input['role'] ?? 'professional');
    $desiredUsername = trim((string) ($input['username'] ?? ''));

    if ($firstName === '' || $lastName === '') {
        json_out(422, ['error' => 'El nombre y el apellido son obligatorios.']);
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_out(422, ['error' => 'El correo electrónico no es válido.']);
    }
    if (!in_array($role, ['admin', 'professional', 'colaborador'], true)) {
        $role = 'professional';
    }

    if ($desiredUsername !== '') {
        $username = mb_strtolower(trim($desiredUsername), 'UTF-8');
        $username = preg_replace('/[^a-z0-9._-]/', '', $username) ?? '';
    } else {
        $cleanFirst = mb_strtolower($firstName, 'UTF-8');
        $cleanFirst = strtr($cleanFirst, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n']);
        $cleanFirst = preg_replace('/[^a-z0-9]/', '', $cleanFirst) ?? 'usuario';
        $username = $cleanFirst;
    }

    if ($username === '' || strlen($username) < 3 || strlen($username) > 32) {
        json_out(422, ['error' => 'El identificador de usuario debe tener entre 3 y 32 caracteres alfanuméricos.']);
    }

    $baseUser = $username;
    $suffix = 1;
    while (true) {
        $chk = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = :u');
        $chk->execute(['u' => $username]);
        if ((int) $chk->fetchColumn() === 0) break;
        $username = $baseUser . $suffix;
        $suffix++;
    }

    $chkMail = $pdo->prepare('SELECT username FROM users WHERE email = :e LIMIT 1');
    $chkMail->execute(['e' => $email]);
    $existingUser = $chkMail->fetchColumn();
    if ($existingUser) {
        json_out(409, ['error' => "El correo {$email} ya está registrado a nombre del usuario {$existingUser}."]);
    }

    $displayName = $firstName . ' ' . $lastName;
    $tempPassHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $totpSecret = bin2hex(random_bytes(10));

    $stmt = $pdo->prepare(
        'INSERT INTO users (username, display_name, first_name, last_name, email, telefono, role, active, password_hash, totp_secret, totp_confirmed, login_count)
         VALUES (:username, :display_name, :first_name, :last_name, :email, :telefono, :role, 1, :hash, :totp, 0, 0)'
    );
    $stmt->execute([
        'username' => $username, 'display_name' => $displayName, 'first_name' => $firstName,
        'last_name' => $lastName, 'email' => $email, 'telefono' => $telefono,
        'role' => $role, 'hash' => $tempPassHash, 'totp' => $totpSecret,
    ]);

    sync_settings_practitioner($username, $email, $telefono, true);
    $mailSent = send_practitioner_invite_email($pdo, $username, $displayName, $email);

    json_out(201, [
        'status' => 'success',
        'message' => 'Profesional creado con éxito. Se envió el enlace de activación a ' . $email,
        'user' => [
            'username' => $username, 'name' => $displayName, 'first_name' => $firstName,
            'last_name' => $lastName, 'email' => $email, 'telefono' => $telefono,
            'role' => $role, 'active' => 1, 'mail_sent' => $mailSent,
        ],
    ]);
}

if ($action === 'update') {
    $username = trim((string) ($input['username'] ?? ''));
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $email = trim((string) ($input['email'] ?? ''));
    $telefono = preg_replace('/[^0-9]/', '', (string) ($input['telefono'] ?? '')) ?? '';
    $role = (string) ($input['role'] ?? 'professional');

    if ($username === '') json_out(422, ['error' => 'Usuario no especificado.']);
    if ($firstName === '' || $lastName === '') json_out(422, ['error' => 'El nombre y el apellido son obligatorios.']);
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(422, ['error' => 'El correo electrónico no es válido.']);
    if (!in_array($role, ['admin', 'professional', 'colaborador'], true)) $role = 'professional';
    if ($username === 'martin') $role = 'admin';

    $chkMail = $pdo->prepare('SELECT username FROM users WHERE email = :e AND username != :u LIMIT 1');
    $chkMail->execute(['e' => $email, 'u' => $username]);
    $duplicate = $chkMail->fetchColumn();
    if ($duplicate) json_out(409, ['error' => "El correo {$email} ya pertenece al usuario {$duplicate}."]);

    $displayName = $firstName . ' ' . $lastName;
    $stmt = $pdo->prepare(
        'UPDATE users 
         SET display_name = :display_name, first_name = :first_name, last_name = :last_name, email = :email, telefono = :telefono, role = :role 
         WHERE username = :username'
    );
    $stmt->execute([
        'display_name' => $displayName, 'first_name' => $firstName, 'last_name' => $lastName,
        'email' => $email, 'telefono' => $telefono, 'role' => $role, 'username' => $username,
    ]);

    $activeChk = $pdo->prepare('SELECT active FROM users WHERE username = :u LIMIT 1');
    $activeChk->execute(['u' => $username]);
    $isActive = (bool) (int) ($activeChk->fetchColumn() ?: 1);

    sync_settings_practitioner($username, $email, $telefono, $isActive);

    json_out(200, [
        'status' => 'success',
        'message' => 'Profesional actualizado correctamente.',
        'user' => [
            'username' => $username, 'name' => $displayName, 'first_name' => $firstName,
            'last_name' => $lastName, 'email' => $email, 'telefono' => $telefono,
            'role' => $role, 'active' => $isActive ? 1 : 0,
        ],
    ]);
}

if ($action === 'toggle_active') {
    $username = trim((string) ($input['username'] ?? ''));
    $active = !empty($input['active']) ? 1 : 0;

    if ($username === '') json_out(422, ['error' => 'Usuario no especificado.']);
    if ($username === 'martin') {
        json_out(400, ['error' => 'No es posible desactivar la cuenta del administrador principal.']);
    }

    $stmt = $pdo->prepare('UPDATE users SET active = :active WHERE username = :username');
    $stmt->execute(['active' => $active, 'username' => $username]);

    $uStmt = $pdo->prepare('SELECT email, telefono FROM users WHERE username = :u LIMIT 1');
    $uStmt->execute(['u' => $username]);
    $uRow = $uStmt->fetch();
    sync_settings_practitioner($username, (string) ($uRow['email'] ?? ''), (string) ($uRow['telefono'] ?? ''), (bool) $active);

    json_out(200, [
        'status' => 'success',
        'message' => $active ? 'Cuenta reactivada exitosamente.' : 'Cuenta suspendida temporalmente.',
        'username' => $username,
        'active' => $active,
    ]);
}

if ($action === 'resend_invite') {
    $username = trim((string) ($input['username'] ?? ''));
    if ($username === '') json_out(422, ['error' => 'Usuario no especificado.']);

    $stmt = $pdo->prepare('SELECT display_name, email FROM users WHERE username = :u LIMIT 1');
    $stmt->execute(['u' => $username]);
    $row = $stmt->fetch();
    if (!$row || empty($row['email'])) json_out(404, ['error' => 'El profesional no tiene un correo configurado para enviar la invitación.']);

    $sent = send_practitioner_invite_email($pdo, $username, (string) ($row['display_name'] ?? $username), (string) $row['email']);
    if ($sent) {
        json_out(200, ['status' => 'success', 'message' => 'Se reenvió el correo de activación a ' . $row['email']]);
    } else {
        json_out(500, ['error' => 'No se pudo enviar el correo de activación. Revisá la configuración SMTP / mail.']);
    }
}

json_out(400, ['error' => 'Acción no válida.']);
