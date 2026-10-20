<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_header();
start_session();
if (empty($_SESSION['user'])) {
    json_out(401, ['login' => true]);
}
if (empty($_SESSION['full'])) {
    $stmt = db()->prepare('SELECT totp_secret, display_name, totp_confirmed FROM users WHERE username = :username');
    $stmt->execute(['username' => $_SESSION['user']]);
    $user = $stmt->fetch();
    if (!$user || (int) $user['totp_confirmed']) {
        json_out(401, ['login' => true]);
    }
    json_out(401, [
        'enroll' => true,
        'account' => 'Kinésica (' . $user['display_name'] . ')',
        'secret' => $user['totp_secret'],
    ]);
}
$role = (string) ($_SESSION['role'] ?? ($user['role'] ?? 'professional'));
$payload = [
    'name' => $_SESSION['name'],
    'username' => $_SESSION['user'],
    'role' => $role,
];
if ($role === 'admin') {
    ensure_login_counts();
    $rows = db()->query('SELECT display_name, login_count FROM users ORDER BY display_name')->fetchAll();
    $payload['logins'] = array_map(static function (array $row): array {
        return [
            'name' => (string) $row['display_name'],
            'count' => (int) $row['login_count'],
        ];
    }, $rows);
}
json_out(200, $payload);
