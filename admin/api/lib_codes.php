<?php
declare(strict_types=1);

function ensure_login_codes(): void
{
    static $ready = false;
    if ($ready) return;
    db()->exec(
        'CREATE TABLE IF NOT EXISTS login_codes (
            code_hash CHAR(64) PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_login_codes_user (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}

function ensure_login_code_attempts(): void
{
    static $ready = false;
    if ($ready) return;
    db()->exec(
        'CREATE TABLE IF NOT EXISTS login_code_attempts (
            attempt_key CHAR(64) PRIMARY KEY,
            attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            window_start DATETIME NOT NULL,
            locked_until DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $ready = true;
}

function login_code_attempt_key(string $identifier): string
{
    $clean = resolve_username($identifier) ?: 'empty';
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $clean . '|' . $ip);
}

function login_code_block_message(): string
{
    return 'Demasiadas solicitudes de código. Por seguridad, esperá 15 minutos antes de volver a intentar.';
}

function login_code_is_locked(string $identifier): bool
{
    ensure_login_code_attempts();
    $key = login_code_attempt_key($identifier);
    $stmt = db()->prepare('SELECT locked_until FROM login_code_attempts WHERE attempt_key = :key');
    $stmt->execute(['key' => $key]);
    $until = $stmt->fetchColumn();
    if (!$until) return false;
    if (strtotime($until . ' UTC') > time()) return true;
    db()->prepare('DELETE FROM login_code_attempts WHERE attempt_key = :key')->execute(['key' => $key]);
    return false;
}

function login_code_register_attempt(string $identifier): void
{
    ensure_login_code_attempts();
    $key = login_code_attempt_key($identifier);
    $pdo = db();
    $windowStart = gmdate('Y-m-d H:i:s', time() - 15 * 60);
    $pdo->prepare('DELETE FROM login_code_attempts WHERE window_start < :expired')->execute(['expired' => $windowStart]);
    $pdo->prepare(
        'INSERT INTO login_code_attempts (attempt_key, attempts, window_start, locked_until)
         VALUES (:key, 1, UTC_TIMESTAMP(), NULL)
         ON DUPLICATE KEY UPDATE
            attempts = IF(window_start < :window_start, 1, attempts + 1),
            window_start = IF(window_start < :window_start_cmp, UTC_TIMESTAMP(), window_start)'
    )->execute(['key' => $key, 'window_start' => $windowStart, 'window_start_cmp' => $windowStart]);

    $stmt = $pdo->prepare('SELECT attempts FROM login_code_attempts WHERE attempt_key = :key');
    $stmt->execute(['key' => $key]);
    if ((int) $stmt->fetchColumn() <= 4) return;
    $pdo->prepare('UPDATE login_code_attempts SET locked_until = :until WHERE attempt_key = :key')
        ->execute(['until' => gmdate('Y-m-d H:i:s', time() + 15 * 60), 'key' => $key]);
}

function login_code_clear_attempts(string $identifier): void
{
    ensure_login_code_attempts();
    db()->prepare('DELETE FROM login_code_attempts WHERE attempt_key = :key')
        ->execute(['key' => login_code_attempt_key($identifier)]);
}
