<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
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
json_out(200, ['name' => $_SESSION['name'], 'username' => $_SESSION['user']]);
