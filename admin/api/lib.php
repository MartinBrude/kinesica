<?php
declare(strict_types=1);

function cfg(): array
{
    static $cfg;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
        $mailFile = __DIR__ . '/mail.php';
        if (is_file($mailFile)) {
            $mail = require $mailFile;
            if (is_array($mail)) {
                $cfg = array_merge($cfg, $mail);
            }
        }
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
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return $pdo;
}

set_exception_handler(static function (Throwable $error): void {
    error_log('kinesica admin: ' . $error->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode(['error' => 'Error interno. Intentá de nuevo.'], JSON_UNESCAPED_UNICODE);
});

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
    $max = 512 * 1024;
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > $max) {
        json_out(413, ['error' => 'La solicitud es demasiado grande']);
    }
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > $max) {
        json_out(413, ['error' => 'La solicitud es demasiado grande']);
    }
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

function send_mail(string $to, string $subject, string $body): bool
{
    $from = (string) (cfg()['mail_from'] ?? '');
    if ($from === '' || $to === '') {
        return false;
    }
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = "From: Kinésica <{$from}>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    return mail($to, $encoded, $body, $headers);
}

function user_email(string $username): string
{
    $emails = cfg()['user_emails'] ?? [];
    return (string) ($emails[$username] ?? '');
}

function ensure_password_resets(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    db()->exec(
        'CREATE TABLE IF NOT EXISTS password_resets (
            token_hash CHAR(64) PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            expires_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}


function reset_attempt_key(string $identifier): string
{
    $identifier = strtolower(trim($identifier));
    if ($identifier === '') {
        $identifier = 'empty';
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $identifier . '|' . $ip);
}

function ensure_password_reset_attempts(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    db()->exec(
        'CREATE TABLE IF NOT EXISTS password_reset_attempts (
            attempt_key CHAR(64) PRIMARY KEY,
            attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            window_start DATETIME NOT NULL,
            locked_until DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}

function password_reset_block_message(): string
{
    return 'Demasiados intentos. Probá de nuevo en 30 minutos.';
}

function password_reset_is_locked(string $identifier): bool
{
    ensure_password_reset_attempts();
    $key = reset_attempt_key($identifier);
    $stmt = db()->prepare('SELECT locked_until FROM password_reset_attempts WHERE attempt_key = :attempt_key');
    $stmt->execute(['attempt_key' => $key]);
    $until = $stmt->fetchColumn();
    if (!$until) {
        return false;
    }
    if (strtotime($until . ' UTC') > time()) {
        return true;
    }
    db()->prepare('DELETE FROM password_reset_attempts WHERE attempt_key = :attempt_key')
        ->execute(['attempt_key' => $key]);
    return false;
}

function password_reset_register_attempt(string $identifier): void
{
    ensure_password_reset_attempts();
    $key = reset_attempt_key($identifier);
    $pdo = db();
    $windowStart = gmdate('Y-m-d H:i:s', time() - 60 * 60);
    $pdo->prepare('DELETE FROM password_reset_attempts WHERE window_start < :expired')
        ->execute(['expired' => $windowStart]);
    $pdo->prepare(
        'INSERT INTO password_reset_attempts (attempt_key, attempts, window_start, locked_until)
         VALUES (:attempt_key, 1, UTC_TIMESTAMP(), NULL)
         ON DUPLICATE KEY UPDATE
            attempts = IF(window_start < :window_start, 1, attempts + 1),
            window_start = IF(window_start < :window_start_cmp, UTC_TIMESTAMP(), window_start)'
    )->execute([
        'attempt_key' => $key,
        'window_start' => $windowStart,
        'window_start_cmp' => $windowStart,
    ]);

    $stmt = $pdo->prepare('SELECT attempts FROM password_reset_attempts WHERE attempt_key = :attempt_key');
    $stmt->execute(['attempt_key' => $key]);
    if ((int) $stmt->fetchColumn() <= 3) {
        return;
    }
    $pdo->prepare('UPDATE password_reset_attempts SET locked_until = :until WHERE attempt_key = :attempt_key')
        ->execute([
            'until' => gmdate('Y-m-d H:i:s', time() + 30 * 60),
            'attempt_key' => $key,
        ]);
}

function password_reset_clear_attempts(string $identifier): void
{
    ensure_password_reset_attempts();
    db()->prepare('DELETE FROM password_reset_attempts WHERE attempt_key = :attempt_key')
        ->execute(['attempt_key' => reset_attempt_key($identifier)]);
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
