<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}
require_header();
start_session();
if (empty($_SESSION['user'])) {
    json_out(401, ['login' => true]);
}

$stmt = db()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $_SESSION['user']]);
$user = $stmt->fetch();
$payload = read_json();
$code = (string) ($payload['code'] ?? '');
$password = (string) ($payload['password'] ?? '');
$username = (string) ($user['username'] ?? $_SESSION['user']);
if (login_is_locked($username)) {
    $_SESSION = [];
    json_out(429, ['error' => login_block_message()]);
}
if (!$user || !password_verify($password, (string) ($user['password_hash'] ?? ''))) {
    login_register_failure($username);
    if (login_is_locked($username)) {
        $_SESSION = [];
        json_out(429, ['error' => login_block_message()]);
    }
    json_out(401, ['error' => 'Contraseña incorrecta']);
}
if (!totp_valid($user['totp_secret'], $code)) {
    login_register_failure($username);
    if (login_is_locked($username)) {
        $_SESSION = [];
        json_out(429, ['error' => login_block_message()]);
    }
    json_out(401, ['error' => 'El código no coincide']);
}

login_clear_failures($username);
login_record_success($username);
db()->prepare('UPDATE users SET totp_confirmed = 1 WHERE username = :username')
    ->execute(['username' => $user['username']]);
$_SESSION['role'] = (string) ($user['role'] ?? user_role($user['username']));
$_SESSION['full'] = true;
json_out(200, ['ok' => true, 'name' => $user['display_name'], 'role' => $_SESSION['role']]);
