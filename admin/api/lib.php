<?php
declare(strict_types=1);

function cfg(): array
{
    static $cfg;
    if ($cfg === null) {
        $configFile = __DIR__ . '/config.php';
        if (is_file($configFile)) {
            $cfg = require $configFile;
        } elseif (is_file(__DIR__ . '/config.example.php')) {
            $cfg = require __DIR__ . '/config.example.php';
        } else {
            $cfg = [];
        }
        $mailFile = __DIR__ . '/mail.php';
        if (is_file($mailFile)) {
            $mail = require $mailFile;
            if (is_array($mail)) {
                $cfg = array_merge($cfg, $mail);
            }
        }
        // Secretos WhatsApp fuera de git (mismo patrón que mail.php).
        $waFile = __DIR__ . '/whatsapp.php';
        if (is_file($waFile)) {
            $wa = require $waFile;
            if (is_array($wa)) {
                $cfg = array_merge($cfg, $wa);
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
    for ($i = -1; $i <= 1; $i++) {
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

function resolve_username(string $identifier): string
{
    $clean = mb_strtolower(trim($identifier), 'UTF-8');
    $clean = strtr($clean, [
        'á' => 'a',
        'é' => 'e',
        'í' => 'i',
        'ó' => 'o',
        'ú' => 'u',
        'ü' => 'u',
    ]);
    if ($clean === '') {
        return '';
    }
    // Primero buscar en base de datos si existe el email o username
    ensure_users_role_column();
    try {
        $stmt = db()->prepare('SELECT username FROM users WHERE username = :u OR LOWER(email) = :e LIMIT 1');
        $stmt->execute(['u' => $clean, 'e' => trim($identifier)]);
        $found = (string) $stmt->fetchColumn();
        if ($found !== '') {
            return $found;
        }
    } catch (Throwable $e) {}

    $emails = cfg()['user_emails'] ?? [];
    if (isset($emails[$clean])) {
        return $clean;
    }
    foreach ($emails as $name => $address) {
        if (strcasecmp((string) $address, trim($identifier)) === 0) {
            return (string) $name;
        }
    }
    return $clean;
}

function mask_email(string $email): string
{
    $parts = explode('@', $email, 2);
    if (count($parts) !== 2) {
        return $email;
    }
    $name = $parts[0];
    $domain = $parts[1];
    $len = strlen($name);
    if ($len <= 2) {
        $masked = substr($name, 0, 1) . '*';
    } else {
        $masked = substr($name, 0, 2) . str_repeat('*', min(4, max(1, $len - 3))) . substr($name, -1);
    }
    return $masked . '@' . $domain;
}

function send_html_mail(string $to, string $subject, string $htmlBody, string $textAlt = ''): bool
{
    $from = (string) (cfg()['mail_from'] ?? 'no-reply@kinesica.com.ar');
    if ($from === '' || $to === '') {
        return false;
    }
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $resendKey = getenv('RESEND_API_KEY') ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? cfg()['resend_api_key'] ?? '');
    if ($resendKey !== '' && function_exists('curl_init')) {
        $payload = [
            'from' => 'Kinésica <' . $from . '>',
            'to' => [$to],
            'subject' => $subject,
            'html' => $htmlBody,
        ];
        if ($textAlt !== '') {
            $payload['text'] = $textAlt;
        }
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $resendKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 6,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
            return true;
        }
    }

    if ($textAlt !== '') {
        $boundary = 'bnd_' . md5(uniqid((string) mt_rand(), true));
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'From: =?UTF-8?B?' . base64_encode('Kinésica') . "?= <{$from}>",
            'Reply-To: Kinésica <' . $from . '>',
            'X-Mailer: PHP/' . phpversion(),
        ]) . "\r\n";

        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($textAlt)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($htmlBody)) . "\r\n"
            . "--{$boundary}--\r\n";
    } else {
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: =?UTF-8?B?' . base64_encode('Kinésica') . "?= <{$from}>",
            'Reply-To: Kinésica <' . $from . '>',
            'X-Mailer: PHP/' . phpversion(),
        ]) . "\r\n";
        $body = $htmlBody;
    }

    $sent = @mail($to, $encoded, $body, $headers, '-f ' . $from);
    if (!$sent) {
        $sent = @mail($to, $encoded, $body, $headers);
    }
    return (bool) $sent;
}

function send_login_code_email(string $to, string $displayName, string $code): bool
{
    $subject = 'Código de acceso a Kinésica';
    $cleanCode = str_pad(trim($code), 6, '0', STR_PAD_LEFT);
    $greeting = $displayName !== '' ? 'Hola ' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . ',' : 'Hola,';
    $greetingPlain = $displayName !== '' ? "Hola {$displayName}," : "Hola,";

    $html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de acceso a Kinésica</title>
  <style>
    body { margin: 0; padding: 24px; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { padding: 24px 20px 16px; text-align: center; border-bottom: 2px solid #005f99; }
    .header h2 { margin: 0; color: #005f99; font-size: 20px; letter-spacing: 0.02em; }
    .content { padding: 28px 24px; color: #1e293b; font-size: 15px; line-height: 1.6; }
    .code-box { background: #f0f7fc; border: 1px solid #bae0f5; border-radius: 10px; text-align: center; padding: 20px 12px; margin: 0 0 20px 0; }
    .code-number { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 4px; color: #005f99; margin: 0 0 10px 0; line-height: 1; -webkit-user-select: all; user-select: all; }
    .instruction { font-size: 15px; color: #0f172a; font-weight: 500; margin: 0 0 10px 0; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; color: #64748b; }
    .footer { text-align: center; padding: 18px; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    {$cleanCode} es tu código de verificación para iniciar sesión en el panel de control de Kinésica.
  </div>
  <div class="wrapper">
    <div class="header">
      <h2>Kinésica · Panel de Control</h2>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-number">{$cleanCode}</div>
        <div class="instruction">Usá este código de verificación para iniciar sesión en el panel de control de Kinésica.</div>
        <span class="badge">Válido por 15 minutos · Un solo uso</span>
      </div>
      <p style="margin-top: 16px;">{$greeting}</p>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
        Si vos no solicitaste este código, podés ignorar este mensaje con tranquilidad. Tu cuenta permanece segura.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Kinésica · Terapias Manuales & Rehabilitación</p>
    </div>
  </div>
</body>
</html>
HTML;

    $text = "{$cleanCode}\n\n"
        . "Usá este código de verificación para iniciar sesión en el panel de control de Kinésica.\n\n"
        . "{$greetingPlain}\n\n"
        . "Detalles de seguridad:\n"
        . "• Validez: 15 minutos\n"
        . "• Uso: un solo uso\n\n"
        . "Si vos no solicitaste este código, podés ignorar este correo. Tu cuenta permanece segura.\n\n"
        . "Kinésica · Terapias Manuales & Rehabilitación";

    return send_html_mail($to, $subject, $html, $text);
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

function ensure_users_role_column(): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    try {
        $cols = db()->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch();
        if (!$cols) {
            db()->exec("ALTER TABLE users ADD role ENUM('admin', 'professional') NOT NULL DEFAULT 'professional'");
            db()->exec("UPDATE users SET role = 'admin' WHERE username = 'martin'");
        }

        // Asegurar columnas extendidas para gestión de profesionales
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

        // Sembrar / migrar datos de los usuarios base si no existen o faltan datos
        $seedUsers = [
            'martin' => [
                'name' => 'Martín',
                'email' => 'martin.brude@gmail.com',
                'telefono' => '',
                'first_name' => 'Martín',
                'last_name' => 'Brude',
                'role' => 'admin',
            ],
            'norberto' => [
                'name' => 'Norberto',
                'email' => 'norberto1712@gmail.com',
                'telefono' => '5491161564311',
                'first_name' => 'Norberto',
                'last_name' => 'Brude',
                'role' => 'admin',
            ],
            'maria' => [
                'name' => 'María',
                'email' => 'manosmagicas7116@gmail.com',
                'telefono' => '5491128531224',
                'first_name' => 'María',
                'last_name' => 'Gulin',
                'role' => 'professional',
            ],
        ];

        $ins = db()->prepare(
            'INSERT INTO users (username, display_name, password_hash, totp_secret, totp_confirmed, role, active, email, telefono, first_name, last_name, login_count)
             VALUES (:username, :name, "", "", 0, :role, 1, :email, :telefono, :first_name, :last_name, 0)
             ON DUPLICATE KEY UPDATE
                 email = COALESCE(NULLIF(email, ""), VALUES(email)),
                 telefono = COALESCE(NULLIF(telefono, ""), VALUES(telefono)),
                 first_name = COALESCE(NULLIF(first_name, ""), VALUES(first_name)),
                 last_name = COALESCE(NULLIF(last_name, ""), VALUES(last_name)),
                 display_name = IF(display_name = "" OR display_name IS NULL, VALUES(display_name), display_name)'
        );

        foreach ($seedUsers as $uName => $uData) {
            $ins->execute([
                'username' => $uName,
                'name' => $uData['name'],
                'role' => $uData['role'],
                'email' => $uData['email'],
                'telefono' => $uData['telefono'],
                'first_name' => $uData['first_name'],
                'last_name' => $uData['last_name'],
            ]);
        }
    } catch (Throwable $e) {
    }
    $checked = true;
}

function user_role(string $username): string
{
    ensure_users_role_column();
    $stmt = db()->prepare('SELECT role FROM users WHERE username = :username LIMIT 1');
    $stmt->execute(['username' => $username]);
    $role = $stmt->fetchColumn();
    return $role ? (string) $role : ($username === 'martin' ? 'admin' : 'professional');
}

function ensure_login_counts(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $column = db()->query("SHOW COLUMNS FROM users LIKE 'login_count'")->fetch();
    if (!$column) {
        db()->exec('ALTER TABLE users ADD login_count INT UNSIGNED NOT NULL DEFAULT 0');
    }
    $ready = true;
}

function login_record_success(string $username): void
{
    $key = login_attempt_key($username);
    if ($key === '') {
        return;
    }
    ensure_login_counts();
    db()->prepare('UPDATE users SET login_count = login_count + 1 WHERE username = :username')
        ->execute(['username' => $key]);
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

function ensure_login_codes(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
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
    if ($ready) {
        return;
    }
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
    $clean = resolve_username($identifier);
    if ($clean === '') {
        $clean = 'empty';
    }
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
    if (!$until) {
        return false;
    }
    if (strtotime($until . ' UTC') > time()) {
        return true;
    }
    db()->prepare('DELETE FROM login_code_attempts WHERE attempt_key = :key')
        ->execute(['key' => $key]);
    return false;
}

function login_code_register_attempt(string $identifier): void
{
    ensure_login_code_attempts();
    $key = login_code_attempt_key($identifier);
    $pdo = db();
    $windowStart = gmdate('Y-m-d H:i:s', time() - 15 * 60);
    $pdo->prepare('DELETE FROM login_code_attempts WHERE window_start < :expired')
        ->execute(['expired' => $windowStart]);
    $pdo->prepare(
        'INSERT INTO login_code_attempts (attempt_key, attempts, window_start, locked_until)
         VALUES (:key, 1, UTC_TIMESTAMP(), NULL)
         ON DUPLICATE KEY UPDATE
            attempts = IF(window_start < :window_start, 1, attempts + 1),
            window_start = IF(window_start < :window_start_cmp, UTC_TIMESTAMP(), window_start)'
    )->execute([
        'key' => $key,
        'window_start' => $windowStart,
        'window_start_cmp' => $windowStart,
    ]);

    $stmt = $pdo->prepare('SELECT attempts FROM login_code_attempts WHERE attempt_key = :key');
    $stmt->execute(['key' => $key]);
    if ((int) $stmt->fetchColumn() <= 4) {
        return;
    }
    $pdo->prepare('UPDATE login_code_attempts SET locked_until = :until WHERE attempt_key = :key')
        ->execute([
            'until' => gmdate('Y-m-d H:i:s', time() + 15 * 60),
            'key' => $key,
        ]);
}

function login_code_clear_attempts(string $identifier): void
{
    ensure_login_code_attempts();
    db()->prepare('DELETE FROM login_code_attempts WHERE attempt_key = :key')
        ->execute(['key' => login_code_attempt_key($identifier)]);
}

function login_code_store(string $username, string $code, int $validMinutes = 15): void
{
    $username = resolve_username($username);
    ensure_login_codes();
    $hash = hash('sha256', $username . ':' . $code);
    $pdo = db();
    $pdo->prepare('DELETE FROM login_codes WHERE username = :username OR expires_at < UTC_TIMESTAMP()')
        ->execute(['username' => $username]);
    $expires = gmdate('Y-m-d H:i:s', time() + ($validMinutes * 60));
    $pdo->prepare(
        'INSERT INTO login_codes (code_hash, username, expires_at) VALUES (:hash, :username, :expires)'
    )->execute([
        'hash' => $hash,
        'username' => $username,
        'expires' => $expires,
    ]);
}

function login_code_verify(string $username, string $code): bool
{
    $username = resolve_username($username);
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $code)) {
        return false;
    }
    ensure_login_codes();
    $hash = hash('sha256', $username . ':' . $code);
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT username FROM login_codes WHERE code_hash = :hash AND username = :username AND expires_at > UTC_TIMESTAMP() LIMIT 1'
    );
    $stmt->execute(['hash' => $hash, 'username' => $username]);
    if ($stmt->fetchColumn()) {
        $pdo->prepare('DELETE FROM login_codes WHERE username = :username')->execute(['username' => $username]);
        return true;
    }
    return false;
}

/**
 * Credenciales Meta WhatsApp Cloud API (env primero, luego config.php).
 *
 * @return array{token: string, phone_number_id: string}
 */
function whatsapp_credentials(): array
{
    $token = (string) (
        getenv('WHATSAPP_TOKEN')
        ?: ($_SERVER['WHATSAPP_TOKEN'] ?? $_ENV['WHATSAPP_TOKEN'] ?? cfg()['whatsapp_token'] ?? '')
    );
    $phoneId = (string) (
        getenv('WHATSAPP_PHONE_NUMBER_ID')
        ?: ($_SERVER['WHATSAPP_PHONE_NUMBER_ID'] ?? $_ENV['WHATSAPP_PHONE_NUMBER_ID'] ?? cfg()['whatsapp_phone_number_id'] ?? '1340013275870491')
    );
    return [
        'token' => trim($token),
        'phone_number_id' => trim($phoneId) !== '' ? trim($phoneId) : '1340013275870491',
    ];
}

/**
 * Envía un texto por WhatsApp Cloud API.
 *
 * @return array{ok: bool, http_code: int, error?: string, response?: array}
 */
function send_whatsapp_text(string $to, string $body): array
{
    $to = preg_replace('/\D+/', '', $to) ?? '';
    $body = trim($body);
    if ($to === '' || $body === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Destino o mensaje vacío'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible en el servidor'];
    }

    $creds = whatsapp_credentials();
    if ($creds['token'] === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'Falta WHATSAPP_TOKEN (config.php o variable de entorno)',
        ];
    }

    $url = 'https://graph.facebook.com/v21.0/' . rawurlencode($creds['phone_number_id']) . '/messages';
    $payload = json_encode([
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $to,
        'type' => 'text',
        'text' => [
            'preview_url' => false,
            'body' => $body,
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $creds['token'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red: ' . $curlError];
    }

    $decoded = is_string($response) ? json_decode($response, true) : null;
    if ($httpCode >= 200 && $httpCode < 300) {
        return [
            'ok' => true,
            'http_code' => $httpCode,
            'response' => is_array($decoded) ? $decoded : [],
        ];
    }

    $metaMsg = '';
    if (is_array($decoded)) {
        $metaMsg = (string) ($decoded['error']['message'] ?? $decoded['error']['error_user_msg'] ?? '');
    }
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => $metaMsg !== '' ? $metaMsg : ('Meta HTTP ' . $httpCode),
        'response' => is_array($decoded) ? $decoded : [],
    ];
}

/**
 * Fallback: despacha la alerta vía webhook n8n (usa la credencial WhatsApp de n8n).
 * Útil cuando Hostinger no tiene WHATSAPP_TOKEN en config.
 *
 * @return array{ok: bool, http_code: int, error?: string}
 */
function send_whatsapp_via_n8n_demo(string $to, string $body): array
{
    $to = preg_replace('/\D+/', '', $to) ?? '';
    $body = trim($body);
    if ($to === '' || $body === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Destino o mensaje vacío'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'http_code' => 0, 'error' => 'cURL no disponible en el servidor'];
    }

    $url = trim((string) (
        getenv('N8N_DEMO_ALERT_URL')
        ?: ($_SERVER['N8N_DEMO_ALERT_URL'] ?? $_ENV['N8N_DEMO_ALERT_URL'] ?? cfg()['n8n_demo_alert_url'] ?? '')
    ));
    if ($url === '') {
        $url = 'https://n8n.kinesica.com.ar/webhook/clara-demo-alert';
    }
    $secret = trim((string) (cfg()['webhook_secret'] ?? ''));
    if ($secret === '') {
        return ['ok' => false, 'http_code' => 0, 'error' => 'Falta webhook_secret en config.php'];
    }

    $payload = json_encode([
        'to' => $to,
        'body' => $body,
        'source' => 'admin-simulator',
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Webhook-Secret: ' . $secret,
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'http_code' => $httpCode, 'error' => 'Error de red n8n: ' . $curlError];
    }
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true, 'http_code' => $httpCode];
    }
    $snippet = is_string($response) ? substr($response, 0, 200) : '';
    return [
        'ok' => false,
        'http_code' => $httpCode,
        'error' => 'n8n HTTP ' . $httpCode . ($snippet !== '' ? (': ' . $snippet) : ''),
    ];
}

/**
 * Envía WhatsApp: Graph API si hay token; si no, webhook n8n del simulador.
 *
 * @return array{ok: bool, http_code: int, error?: string, via?: string}
 */
function send_whatsapp_alert(string $to, string $body): array
{
    $creds = whatsapp_credentials();
    if ($creds['token'] !== '') {
        $direct = send_whatsapp_text($to, $body);
        if ($direct['ok']) {
            $direct['via'] = 'graph';
            return $direct;
        }
        // Si hay token pero falló Meta, no caemos a n8n en silencio: devolvemos el error.
        $direct['via'] = 'graph';
        return $direct;
    }
    $viaN8n = send_whatsapp_via_n8n_demo($to, $body);
    $viaN8n['via'] = 'n8n';
    return $viaN8n;
}
