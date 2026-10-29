<?php
declare(strict_types=1);

function require_auth(): array
{
    start_session();
    if (empty($_SESSION['user']) || empty($_SESSION['full'])) {
        json_out(401, ['login' => true]);
    }
    $username = (string) $_SESSION['user'];
    $role = (string) ($_SESSION['role'] ?? 'professional');
    try {
        ensure_users_role_column();
        $stmt = db()->prepare('SELECT display_name, role, active FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $row = $stmt->fetch();
        if ($row) {
            if (isset($row['active']) && (int) $row['active'] === 0) {
                $_SESSION = [];
                json_out(401, ['login' => true]);
            }
            if (!empty($row['role'])) {
                $role = (string) $row['role'];
                $_SESSION['role'] = $role;
            }
            if (!empty($row['display_name'])) {
                $_SESSION['name'] = (string) $row['display_name'];
            }
        }
    } catch (Throwable $e) {
    }
    return [
        'username' => $username,
        'name' => $_SESSION['name'] ?? $username,
        'role' => $role,
    ];
}

function is_admin(?array $auth = null): bool
{
    if ($auth !== null && isset($auth['role'])) {
        return $auth['role'] === 'admin';
    }
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['role'])) {
        return $_SESSION['role'] === 'admin';
    }
    return false;
}

function is_colaborador(?array $auth = null): bool
{
    if ($auth !== null && isset($auth['role'])) {
        return $auth['role'] === 'colaborador';
    }
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['role'])) {
        return $_SESSION['role'] === 'colaborador';
    }
    return false;
}

function base32_decode(string $value): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $value = strtoupper(preg_replace('/[^A-Z2-7]/', '', $value) ?? '');
    $bits = '';
    $length = strlen($value);
    for ($i = 0; $i < $length; $i++) {
        $pos = strpos($alphabet, $value[$i]);
        if ($pos === false) {
            continue;
        }
        $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr(bindec($byte));
        }
    }
    return $out;
}

function totp_code(string $secret, int $timestamp): string
{
    $counter = intdiv($timestamp, 30);
    $bin = pack('N*', 0) . pack('N*', $counter);
    $hash = hash_hmac('sha1', $bin, base32_decode($secret), true);
    if (!is_string($hash) || strlen($hash) < 20) {
        return '000000';
    }
    $offset = ord($hash[19]) & 0x0f;
    $code = (
        ((ord($hash[$offset]) & 0x7f) << 24) |
        ((ord($hash[$offset + 1]) & 0xff) << 16) |
        ((ord($hash[$offset + 2]) & 0xff) << 8) |
        (ord($hash[$offset + 3]) & 0xff)
    ) % 1000000;
    return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
}

function user_email(string $username): string
{
    $username = resolve_username($username);
    if ($username === '') {
        return '';
    }
    ensure_users_role_column();
    try {
        $stmt = db()->prepare('SELECT email FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $email = (string) $stmt->fetchColumn();
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $email;
        }
    } catch (Throwable $e) {}

    $emails = cfg()['user_emails'] ?? [];
    return (string) ($emails[$username] ?? '');
}

function ensure_users_role_column(): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    try {
        $cols = db()->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch();
        if (!$cols) {
            db()->exec("ALTER TABLE users ADD role VARCHAR(32) NOT NULL DEFAULT 'professional'");
            db()->exec("UPDATE users SET role = 'admin' WHERE username = 'martin'");
        } else {
            $type = strtolower((string) ($cols['Type'] ?? ''));
            if (strpos($type, 'colaborador') === false && strpos($type, 'varchar') === false) {
                db()->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'professional'");
            }
        }
        $colActive = db()->query("SHOW COLUMNS FROM users LIKE 'active'")->fetch();
        if (!$colActive) {
            db()->exec("ALTER TABLE users ADD active TINYINT(1) NOT NULL DEFAULT 1");
        }
        $colEmail = db()->query("SHOW COLUMNS FROM users LIKE 'email'")->fetch();
        if (!$colEmail) {
            db()->exec("ALTER TABLE users ADD email VARCHAR(120) NULL DEFAULT NULL");
        }
        $colTelefono = db()->query("SHOW COLUMNS FROM users LIKE 'telefono'")->fetch();
        if (!$colTelefono) {
            db()->exec("ALTER TABLE users ADD telefono VARCHAR(30) NULL DEFAULT NULL");
        }
        $colFirstName = db()->query("SHOW COLUMNS FROM users LIKE 'first_name'")->fetch();
        if (!$colFirstName) {
            db()->exec("ALTER TABLE users ADD first_name VARCHAR(60) NULL DEFAULT NULL");
        }
        $colLastName = db()->query("SHOW COLUMNS FROM users LIKE 'last_name'")->fetch();
        if (!$colLastName) {
            db()->exec("ALTER TABLE users ADD last_name VARCHAR(60) NULL DEFAULT NULL");
        }
        $colLoginCount = db()->query("SHOW COLUMNS FROM users LIKE 'login_count'")->fetch();
        if (!$colLoginCount) {
            db()->exec("ALTER TABLE users ADD login_count INT UNSIGNED NOT NULL DEFAULT 0");
        }

        $seedUsers = [
            'martin' => ['name' => 'Martín', 'email' => 'martin.brude@gmail.com', 'telefono' => '', 'first_name' => 'Martín', 'last_name' => 'Brude', 'role' => 'admin'],
            'norberto' => ['name' => 'Norberto', 'email' => 'norberto1712@gmail.com', 'telefono' => '5491161564311', 'first_name' => 'Norberto', 'last_name' => 'Brude', 'role' => 'admin'],
            'maria' => ['name' => 'María', 'email' => 'manosmagicas7116@gmail.com', 'telefono' => '5491128531224', 'first_name' => 'María', 'last_name' => 'Gulin', 'role' => 'professional'],
            'facundo' => ['name' => 'Facundo Vivardo', 'email' => 'facu86@gmail.com', 'telefono' => '', 'first_name' => 'Facundo', 'last_name' => 'Vivardo', 'role' => 'colaborador'],
        ];

        $ins = db()->prepare(
            'INSERT INTO users (username, display_name, password_hash, totp_secret, totp_confirmed, role, active, email, telefono, first_name, last_name, login_count)
             VALUES (:username, :name, "", "", 0, :role, 1, :email, :telefono, :first_name, :last_name, 0)
             ON DUPLICATE KEY UPDATE
                 email = COALESCE(NULLIF(email, ""), VALUES(email)),
                 telefono = COALESCE(NULLIF(telefono, ""), VALUES(telefono)),
                 first_name = COALESCE(NULLIF(first_name, ""), VALUES(first_name)),
                 last_name = COALESCE(NULLIF(last_name, ""), VALUES(last_name)),
                 display_name = IF(display_name = "" OR display_name IS NULL, VALUES(display_name), display_name),
                 role = IF(role = "" OR role IS NULL, VALUES(role), role)'
        );

        foreach ($seedUsers as $uName => $uData) {
            $ins->execute([
                'username' => $uName, 'name' => $uData['name'], 'role' => $uData['role'],
                'email' => $uData['email'], 'telefono' => $uData['telefono'],
                'first_name' => $uData['first_name'], 'last_name' => $uData['last_name'],
            ]);
        }
        db()->exec("UPDATE users SET email = 'facu86@gmail.com' WHERE username = 'facundo' AND (email != 'facu86@gmail.com' OR email IS NULL)");
    } catch (Throwable $e) {}
    $checked = true;
}

function user_role(string $username): string
{
    ensure_users_role_column();
    $stmt = db()->prepare('SELECT role FROM users WHERE username = :username LIMIT 1');
    $stmt->execute(['username' => $username]);
    $role = $stmt->fetchColumn();
    if ($role) {
        return (string) $role;
    }
    if ($username === 'martin') return 'admin';
    if ($username === 'facundo') return 'colaborador';
    return 'professional';
}
