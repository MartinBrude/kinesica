<?php
declare(strict_types=1);

function cfg(): array
{
    static $cfg;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $c = cfg()['db'];
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'], $c['name']),
        $c['user'],
        $c['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    return $pdo;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('kinesica_atm');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/admin/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function json_out(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_header(): void
{
    $header = $_SERVER['HTTP_X_KINESICA'] ?? '';
    if ($header !== '1') {
        json_out(403, ['error' => 'Solicitud rechazada']);
    }
}

function require_auth(): array
{
    start_session();
    if (empty($_SESSION['user']) || empty($_SESSION['full'])) {
        json_out(401, ['login' => true]);
    }
    return ['username' => $_SESSION['user'], 'name' => $_SESSION['name']];
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
    $offset = ord($hash[19]) & 0x0f;
    $code = (
        ((ord($hash[$offset]) & 0x7f) << 24) |
        ((ord($hash[$offset + 1]) & 0xff) << 16) |
        ((ord($hash[$offset + 2]) & 0xff) << 8) |
        (ord($hash[$offset + 3]) & 0xff)
    ) % 1000000;
    return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
}

function totp_valid(string $secret, string $code): bool
{
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $code)) {
        return false;
    }
    $now = time();
    for ($i = -2; $i <= 2; $i++) {
        if (hash_equals(totp_code($secret, $now + ($i * 30)), $code)) {
            return true;
        }
    }
    return false;
}

function login_attempt_key(string $username): string
{
    $key = strtolower(trim($username));
    if ($key === '' || strlen($key) > 32) {
        return '';
    }
    return $key;
}

function ensure_login_attempts(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    db()->exec(
        'CREATE TABLE IF NOT EXISTS login_attempts (
            username VARCHAR(32) PRIMARY KEY,
            failures SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            locked_until DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}

function login_block_message(): string
{
    return 'Demasiados intentos. El acceso queda bloqueado 30 minutos.';
}

function login_is_locked(string $username): bool
{
    $key = login_attempt_key($username);
    if ($key === '') {
        return false;
    }
    ensure_login_attempts();
    $stmt = db()->prepare('SELECT locked_until FROM login_attempts WHERE username = :username');
    $stmt->execute(['username' => $key]);
    $until = $stmt->fetchColumn();
    if (!$until) {
        return false;
    }
    if (strtotime($until . ' UTC') > time()) {
        return true;
    }
    db()->prepare('UPDATE login_attempts SET failures = 0, locked_until = NULL WHERE username = :username')
        ->execute(['username' => $key]);
    return false;
}

function login_register_failure(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '' || login_is_locked($key)) {
        return;
    }
    $pdo = db();
    $pdo->prepare(
        'INSERT INTO login_attempts (username, failures, locked_until)
         VALUES (:username, 1, NULL)
         ON DUPLICATE KEY UPDATE failures = failures + 1'
    )->execute(['username' => $key]);
    $stmt = $pdo->prepare('SELECT failures FROM login_attempts WHERE username = :username');
    $stmt->execute(['username' => $key]);
    if ((int) $stmt->fetchColumn() < 5) {
        return;
    }
    $pdo->prepare('UPDATE login_attempts SET locked_until = :until WHERE username = :username')
        ->execute([
            'until' => gmdate('Y-m-d H:i:s', time() + 30 * 60),
            'username' => $key,
        ]);
}

function login_clear_failures(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '') {
        return;
    }
    ensure_login_attempts();
    db()->prepare('DELETE FROM login_attempts WHERE username = :username')
        ->execute(['username' => $key]);
}
