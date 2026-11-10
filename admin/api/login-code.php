<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}
require_header();

$body = read_json();
$rawUsername = (string) ($body['username'] ?? '');
$username = resolve_username($rawUsername);
$password = (string) ($body['password'] ?? '');
$code = (string) ($body['code'] ?? '');
$token = (string) ($body['token'] ?? '');
$action = (string) ($body['action'] ?? ($token !== '' ? 'magic' : ($code !== '' ? 'verify' : 'send')));

if ($action === 'magic') {
    $magicUsername = login_magic_token_verify($token);
    if ($magicUsername === null || $magicUsername === '') {
        json_out(401, ['error' => 'El enlace de acceso es inválido o ya expiró. Solicitá un nuevo código.']);
    }
    if (login_is_locked($magicUsername)) {
        json_out(429, ['error' => login_block_message()]);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
    $stmt->execute(['username' => $magicUsername]);
    $user = $stmt->fetch();

    if (!$user) {
        json_out(401, ['error' => 'El enlace de acceso es inválido o ya expiró.']);
    }
    if (isset($user['active']) && (int) $user['active'] === 0) {
        json_out(403, ['error' => 'Cuenta suspendida o inactiva. Comunicate con el administrador.']);
    }

    login_clear_failures($magicUsername);
    login_record_success($magicUsername);
    login_code_clear_attempts($magicUsername);

    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = $user['username'];
    $_SESSION['name'] = $user['display_name'];
    $_SESSION['role'] = (string) ($user['role'] ?? user_role($user['username']));
    mark_full_session();

    json_out(200, [
        'ok' => true,
        'username' => $user['username'],
        'name' => $user['display_name'],
        'role' => $_SESSION['role'],
    ]);
}

if ($username === '') {
    json_out(400, ['error' => 'Ingresá tu usuario o correo electrónico.']);
}

if ($action === 'verify') {
    if (login_is_locked($username)) {
        json_out(429, ['error' => login_block_message()]);
    }

    $cleanCode = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $cleanCode)) {
        json_out(400, ['error' => 'El código debe tener 6 números.']);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if ($user && isset($user['active']) && (int) $user['active'] === 0) {
        json_out(403, ['error' => 'Cuenta suspendida o inactiva. Comunicate con el administrador.']);
    }

    if (!$user || !password_verify($password, (string) ($user['password_hash'] ?? ''))) {
        login_register_failure($username);
        if (login_is_locked($username)) {
            json_out(429, ['error' => login_block_message()]);
        }
        json_out(401, ['error' => 'Contraseña incorrecta']);
    }

    if (!login_code_verify($username, $cleanCode)) {
        login_register_failure($username);
        if (login_is_locked($username)) {
            json_out(429, ['error' => login_block_message()]);
        }
        json_out(401, ['error' => 'El código es incorrecto o ya expiró. Solicitá uno nuevo.']);
    }

    login_clear_failures($username);
    login_record_success($username);
    login_code_clear_attempts($username);

    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = $user['username'];
    $_SESSION['name'] = $user['display_name'];
    $_SESSION['role'] = (string) ($user['role'] ?? user_role($user['username']));
    mark_full_session();

    json_out(200, [
        'ok' => true,
        'username' => $user['username'],
        'name' => $user['display_name'],
        'role' => $_SESSION['role'],
    ]);
}

// Action: send
if (login_code_is_locked($username)) {
    json_out(429, ['error' => login_code_block_message()]);
}

$stmt = db()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();

if ($user && isset($user['active']) && (int) $user['active'] === 0) {
    login_code_register_attempt($username);
    json_out(200, [
        'ok' => true,
        'sent' => true,
        'username' => $username,
        'message' => 'Si el usuario tiene correo, te enviamos un código. Revisá tu bandeja de entrada.',
    ]);
}

$email = user_email($username);
if (!$user || $email === '') {
    login_code_register_attempt($username);
    json_out(200, [
        'ok' => true,
        'sent' => true,
        'username' => $username,
        'message' => 'Si el usuario tiene correo, te enviamos un código. Revisá tu bandeja de entrada.',
    ]);
}

login_code_register_attempt($username);

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
login_code_store($username, $code, 15);
$magicToken = login_magic_token_store($username, 15);

$sent = send_login_code_email($email, (string) ($user['display_name'] ?? $username), $code, $magicToken);
if (!$sent) {
    error_log('login-code: no se pudo enviar el código para ' . $username);
}

json_out(200, [
    'ok' => true,
    'sent' => true,
    'username' => $username,
    'message' => 'Si el usuario tiene correo, te enviamos un código. Revisá tu bandeja de entrada.',
]);
