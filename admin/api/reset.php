<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}
require_header();
$body = read_json();
$token = (string) ($body['token'] ?? '');
$password = (string) ($body['password'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    json_out(400, ['error' => 'El enlace no sirve. Pedí uno nuevo.']);
}
if (strlen($password) < 10) {
    json_out(400, ['error' => 'La contraseña tiene que tener al menos 10 caracteres.']);
}

ensure_password_resets();
$stmt = db()->prepare('SELECT username, expires_at FROM password_resets WHERE token_hash = :hash LIMIT 1');
$stmt->execute(['hash' => hash('sha256', $token)]);
$row = $stmt->fetch();
if (!$row || strtotime($row['expires_at'] . ' UTC') <= time()) {
    json_out(400, ['error' => 'El enlace venció. Pedí uno nuevo.']);
}

db()->prepare('UPDATE users SET password_hash = :hash WHERE username = :username')
    ->execute([
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'username' => $row['username'],
    ]);
db()->prepare('DELETE FROM password_resets WHERE username = :username')
    ->execute(['username' => $row['username']]);
login_clear_failures($row['username']);

json_out(200, ['ok' => true]);
