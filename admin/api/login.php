<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}
require_header();
$body = read_json();
$username = strtolower(trim((string) ($body['username'] ?? '')));
$password = (string) ($body['password'] ?? '');
$code = (string) ($body['code'] ?? '');

if (login_is_locked($username)) {
    json_out(429, ['error' => login_block_message()]);
}

$stmt = db()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();
if (!$user || !password_verify($password, $user['password_hash'])) {
    login_register_failure($username);
    if (login_is_locked($username)) {
        json_out(429, ['error' => login_block_message()]);
    }
    json_out(401, ['error' => 'Usuario o contraseña incorrectos']);
}

start_session();
session_regenerate_id(true);
$_SESSION['user'] = $user['username'];
$_SESSION['name'] = $user['display_name'];

$needsCode = $user['username'] !== 'martin';
if ($needsCode && !(int) $user['totp_confirmed']) {
    $_SESSION['full'] = false;
    login_clear_failures($username);
    json_out(200, [
        'enroll' => true,
        'account' => 'Kinésica (' . $user['display_name'] . ')',
        'secret' => $user['totp_secret'],
    ]);
}

if ($needsCode && !totp_valid($user['totp_secret'], $code)) {
    $_SESSION = [];
    login_register_failure($username);
    if (login_is_locked($username)) {
        json_out(429, ['error' => login_block_message()]);
    }
    json_out(401, ['error' => 'El código no coincide', 'needCode' => true]);
}

login_clear_failures($username);
$_SESSION['full'] = true;
json_out(200, ['ok' => true, 'name' => $user['display_name']]);
