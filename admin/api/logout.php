<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
start_session();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', true, true);
}
session_destroy();
json_out(200, ['ok' => true]);
