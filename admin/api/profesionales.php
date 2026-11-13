<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/profesionales_sync.php';
require_once __DIR__ . '/profesionales_invite.php';

require_header();
$auth = require_auth();
$pdo = db();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $stmt = $pdo->query(
            'SELECT username, display_name, first_name, last_name, email, telefono, role, active, totp_confirmed, login_count
             FROM users 
             ORDER BY (role = "admin") DESC, (username = "norberto") DESC, (username = "maria") DESC, (username = "facundo") DESC, display_name ASC'
        );
        $users = $stmt->fetchAll();
    } catch (Throwable $e) {
        ensure_users_role_column(true);
        $stmt = $pdo->query(
            'SELECT username, display_name, first_name, last_name, email, telefono, role, active, totp_confirmed, login_count
             FROM users 
             ORDER BY (role = "admin") DESC, (username = "norberto") DESC, (username = "maria") DESC, (username = "facundo") DESC, display_name ASC'
        );
        $users = $stmt->fetchAll();
    }
    foreach ($users as &$u) {
        $u['name'] = (string) ($u['display_name'] ?: trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')));
        if ($u['name'] === '') $u['name'] = (string) $u['username'];
        $u['active'] = (int) ($u['active'] ?? 1);
        $u['totp_confirmed'] = (int) ($u['totp_confirmed'] ?? 0);
        $u['login_count'] = (int) ($u['login_count'] ?? 0);
    }
    unset($u);

    json_out(200, [
        'status' => 'success',
        'count' => count($users),
        'users' => $users,
        'profesionales' => $users,
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');
require __DIR__ . '/profesionales_post.php';
