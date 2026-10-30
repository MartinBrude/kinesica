<?php
declare(strict_types=1);

/**
 * Kinésica Admin - Librería Central de Backend
 */

require_once __DIR__ . '/lib_db.php';
require_once __DIR__ . '/lib_auth.php';
require_once __DIR__ . '/lib_attempts.php';
require_once __DIR__ . '/lib_codes.php';
require_once __DIR__ . '/lib_mail.php';
require_once __DIR__ . '/lib_whatsapp.php';

function resolve_username(string $identifier): string
{
    $clean = mb_strtolower(trim($identifier), 'UTF-8');
    $clean = strtr($clean, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u']);
    if ($clean === '') return '';
    try {
        $stmt = db()->prepare('SELECT username FROM users WHERE username = :u OR LOWER(email) = :e LIMIT 1');
        $stmt->execute(['u' => $clean, 'e' => trim($identifier)]);
        $found = (string) $stmt->fetchColumn();
        if ($found !== '') return $found;
    } catch (Throwable $e) {}

    $emails = cfg()['user_emails'] ?? [];
    if (isset($emails[$clean])) return $clean;
    foreach ($emails as $name => $address) {
        if (strcasecmp((string) $address, trim($identifier)) === 0) return (string) $name;
    }
    return $clean;
}

function mask_email(string $email): string
{
    $parts = explode('@', $email, 2);
    if (count($parts) !== 2) return $email;
    $name = $parts[0];
    $domain = $parts[1];
    $len = strlen($name);
    $masked = ($len <= 2)
        ? substr($name, 0, 1) . '*'
        : substr($name, 0, 2) . str_repeat('*', min(4, max(1, $len - 3))) . substr($name, -1);
    return $masked . '@' . $domain;
}

function totp_valid(string $secret, string $code): bool
{
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $code)) return false;
    $now = time();
    for ($i = -1; $i <= 1; $i++) {
        if (hash_equals(totp_code($secret, $now + ($i * 30)), $code)) return true;
    }
    return false;
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
    $pdo->prepare('INSERT INTO login_codes (code_hash, username, expires_at) VALUES (:hash, :username, :expires)')
        ->execute(['hash' => $hash, 'username' => $username, 'expires' => $expires]);
}

function login_code_verify(string $username, string $code): bool
{
    $username = resolve_username($username);
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $code)) return false;
    ensure_login_codes();
    $hash = hash('sha256', $username . ':' . $code);
    $pdo = db();
    $stmt = $pdo->prepare('SELECT username FROM login_codes WHERE code_hash = :hash AND username = :username AND expires_at > UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute(['hash' => $hash, 'username' => $username]);
    if ($stmt->fetchColumn()) {
        $pdo->prepare('DELETE FROM login_codes WHERE username = :username')->execute(['username' => $username]);
        return true;
    }
    return false;
}

function send_login_code_email(string $to, string $displayName, string $code): bool
{
    $subject = 'Código de acceso a Kinésica';
    $cleanCode = str_pad(trim($code), 6, '0', STR_PAD_LEFT);
    $greeting = $displayName !== '' ? 'Hola ' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . ',' : 'Hola,';
    $greetingPlain = $displayName !== '' ? "Hola {$displayName}," : "Hola,";

    $html = <<<HTML
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Código de acceso</title>
<style>body{margin:0;padding:24px;background:#f4f6f9;font-family:sans-serif}.wrapper{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0}.code-number{font-family:monospace;font-size:36px;font-weight:700;letter-spacing:4px;color:#005f99;text-align:center;padding:16px;background:#f0f7fc;border-radius:10px}</style></head>
<body><div class="wrapper"><h2>Kinésica · Panel de Control</h2><p>{$greeting}</p><div class="code-number">{$cleanCode}</div><p style="font-size:13px;color:#64748b;margin-top:16px">Válido por 15 minutos · Un solo uso</p></div></body></html>
HTML;

    $text = "{$cleanCode}\n\nUsá este código para iniciar sesión en Kinésica.\n\n{$greetingPlain}\nVálido 15 minutos.";
    return send_html_mail($to, $subject, $html, $text);
}

function kinesica_extract_ficha_photos(array $item): array
{
    $files = [];
    if (!empty($item['fotoUrl']) && preg_match('/file=([a-f0-9]{32,64}\.(jpe?g|png|webp))$/i', (string) $item['fotoUrl'], $m)) {
        $files[$m[1]] = true;
    }
    if (!empty($item['fotosUrls']) && is_array($item['fotosUrls'])) {
        foreach ($item['fotosUrls'] as $u) {
            if (is_string($u) && preg_match('/file=([a-f0-9]{32,64}\.(jpe?g|png|webp))$/i', $u, $m)) {
                $files[$m[1]] = true;
            }
        }
    }
    return array_keys($files);
}
