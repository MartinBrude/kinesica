<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}
require_header();
$username = strtolower(trim((string) (read_json()['username'] ?? '')));
$generic = 'Si el usuario tiene correo, te llega un enlace en unos minutos.';

$stmt = db()->prepare('SELECT username FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();
if ($username === '' || !isset((cfg()['user_emails'] ?? [])[$username])) {
    foreach (cfg()['user_emails'] ?? [] as $name => $address) {
        if (strcasecmp((string) $address, $username) === 0) {
            $username = (string) $name;
            $stmt = db()->prepare('SELECT username FROM users WHERE username = :username LIMIT 1');
            $stmt->execute(['username' => $username]);
            $user = $stmt->fetch();
            break;
        }
    }
}
$email = $user ? user_email($username) : '';
$from = (string) (cfg()['mail_from'] ?? '');
if ($from === '') {
    json_out(503, ['error' => 'El correo del consultorio no está configurado.']);
}
if (!$user || $email === '') {
    json_out(200, ['ok' => true, 'message' => $generic]);
}

ensure_password_resets();
$token = bin2hex(random_bytes(32));
db()->prepare('DELETE FROM password_resets WHERE username = :username')->execute(['username' => $username]);
db()->prepare(
    'INSERT INTO password_resets (token_hash, username, expires_at) VALUES (:hash, :username, :expires)'
)->execute([
    'hash' => hash('sha256', $token),
    'username' => $username,
    'expires' => gmdate('Y-m-d H:i:s', time() + 30 * 60),
]);

$base = rtrim((string) (cfg()['admin_url'] ?? 'https://www.kinesica.com.ar/admin/'), '/') . '/';
$link = $base . '?reset=' . $token;
$body = "Para elegir una contraseña nueva de Kinésica, abrí este enlace en los próximos 30 minutos:\n\n{$link}\n\nSi no pediste el cambio, ignorá este mensaje.";
if (!send_mail($email, 'Contraseña de Kinésica', $body)) {
    db()->prepare('DELETE FROM password_resets WHERE username = :username')->execute(['username' => $username]);
    json_out(502, ['error' => 'No se pudo enviar el correo.']);
}

json_out(200, ['ok' => true, 'message' => $generic]);
