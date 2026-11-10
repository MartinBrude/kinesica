<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
start_session();
$_SESSION = [];
clear_session_cookie();
session_destroy();
json_out(200, ['ok' => true]);
