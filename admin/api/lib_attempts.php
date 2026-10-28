<?php
declare(strict_types=1);

function login_attempt_key(string $username): string
{
    $key = strtolower(trim($username));
    return ($key === '' || strlen($key) > 32) ? '' : $key;
}

function ensure_login_attempts(): void
{
    static $ready = false;
    if ($ready) return;
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
    if ($key === '') return false;
    ensure_login_attempts();
    $stmt = db()->prepare('SELECT locked_until FROM login_attempts WHERE username = :username');
    $stmt->execute(['username' => $key]);
    $until = $stmt->fetchColumn();
    if (!$until) return false;
    if (strtotime($until . ' UTC') > time()) return true;
    db()->prepare('UPDATE login_attempts SET failures = 0, locked_until = NULL WHERE username = :username')
        ->execute(['username' => $key]);
    return false;
}

function login_register_failure(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '' || login_is_locked($key)) return;
    $pdo = db();
    $pdo->prepare(
        'INSERT INTO login_attempts (username, failures, locked_until)
         VALUES (:username, 1, NULL)
         ON DUPLICATE KEY UPDATE failures = failures + 1'
    )->execute(['username' => $key]);
    $stmt = $pdo->prepare('SELECT failures FROM login_attempts WHERE username = :username');
    $stmt->execute(['username' => $key]);
    if ((int) $stmt->fetchColumn() < 5) return;
    $pdo->prepare('UPDATE login_attempts SET locked_until = :until WHERE username = :username')
        ->execute(['until' => gmdate('Y-m-d H:i:s', time() + 30 * 60), 'username' => $key]);
}

function ensure_login_counts(): void
{
    static $ready = false;
    if ($ready) return;
    $column = db()->query("SHOW COLUMNS FROM users LIKE 'login_count'")->fetch();
    if (!$column) {
        db()->exec('ALTER TABLE users ADD login_count INT UNSIGNED NOT NULL DEFAULT 0');
    }
    $ready = true;
}

function login_record_success(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '') return;
    ensure_login_counts();
    db()->prepare('UPDATE users SET login_count = login_count + 1 WHERE username = :username')
        ->execute(['username' => $key]);
}

function login_clear_failures(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '') return;
    ensure_login_attempts();
    db()->prepare('DELETE FROM login_attempts WHERE username = :username')->execute(['username' => $key]);
}

function ensure_password_resets(): void
{
    static $ready = false;
    if ($ready) return;
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
    $identifier = strtolower(trim($identifier)) ?: 'empty';
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $identifier . '|' . $ip);
}

function ensure_password_reset_attempts(): void
{
    static $ready = false;
    if ($ready) return;
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
    if (!$until) return false;
    if (strtotime($until . ' UTC') > time()) return true;
    db()->prepare('DELETE FROM password_reset_attempts WHERE attempt_key = :attempt_key')->execute(['attempt_key' => $key]);
    return false;
}

function password_reset_register_attempt(string $identifier): void
{
    ensure_password_reset_attempts();
    $key = reset_attempt_key($identifier);
    $pdo = db();
    $windowStart = gmdate('Y-m-d H:i:s', time() - 60 * 60);
    $pdo->prepare('DELETE FROM password_reset_attempts WHERE window_start < :expired')->execute(['expired' => $windowStart]);
    $pdo->prepare(
        'INSERT INTO password_reset_attempts (attempt_key, attempts, window_start, locked_until)
         VALUES (:attempt_key, 1, UTC_TIMESTAMP(), NULL)
         ON DUPLICATE KEY UPDATE
            attempts = IF(window_start < :window_start, 1, attempts + 1),
            window_start = IF(window_start < :window_start_cmp, UTC_TIMESTAMP(), window_start)'
    )->execute(['attempt_key' => $key, 'window_start' => $windowStart, 'window_start_cmp' => $windowStart]);

    $stmt = $pdo->prepare('SELECT attempts FROM password_reset_attempts WHERE attempt_key = :attempt_key');
    $stmt->execute(['attempt_key' => $key]);
    if ((int) $stmt->fetchColumn() <= 3) return;
    $pdo->prepare('UPDATE password_reset_attempts SET locked_until = :until WHERE attempt_key = :attempt_key')
        ->execute(['until' => gmdate('Y-m-d H:i:s', time() + 30 * 60), 'attempt_key' => $key]);
}

function password_reset_clear_attempts(string $identifier): void
{
    ensure_password_reset_attempts();
    db()->prepare('DELETE FROM password_reset_attempts WHERE attempt_key = :attempt_key')
        ->execute(['attempt_key' => reset_attempt_key($identifier)]);
}
