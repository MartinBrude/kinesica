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
$code = (string) ($body['code'] ?? '');
$action = (string) ($body['action'] ?? ($code !== '' ? 'verify' : 'send'));

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

    if (!$user || !login_code_verify($username, $cleanCode)) {
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
    $_SESSION['full'] = true;

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
    json_out(403, ['error' => 'Cuenta suspendida o inactiva. Comunicate con el administrador.']);
}

$email = user_email($username);
if (!$user || $email === '') {
    login_code_register_attempt($username);
    json_out(404, [
        'error' => 'Usuario o correo no reconocido. Verificá los datos e intentá de nuevo.',
    ]);
}

login_code_register_attempt($username);

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
login_code_store($username, $code, 15);

$sent = send_login_code_email($email, (string) ($user['display_name'] ?? $username), $code);
if (!$sent) {
    json_out(502, ['error' => 'No se pudo enviar el correo con el código. Intentá de nuevo en unos instantes.']);
}

json_out(200, [
    'ok' => true,
    'sent' => true,
    'username' => $username,
    'emailMasked' => mask_email($email),
    'message' => 'Te enviamos un código de 6 dígitos a ' . mask_email($email) . '. Ingresalo a continuación.',
]);
