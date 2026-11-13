<?php
declare(strict_types=1);

/**
 * Autenticación pacientes.php.
 */
function authenticate_request(?array &$bodyData = null): array
{
    $config = cfg();
    $expectedSecret = (string) ($config['webhook_secret'] ?? $config['install_token'] ?? '');

    $botTokenOk = static function (string $token): bool {
        if (strlen($token) < 32) return false;
        $hashFile = __DIR__ . '/bot_token.sha256';
        $expectedHash = is_file($hashFile) ? strtolower(trim((string) file_get_contents($hashFile))) : '';
        return strlen($expectedHash) === 64 && hash_equals($expectedHash, hash('sha256', $token));
    };

    $headerToken = (string) ($_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '');
    $authHeaderRaw = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (str_starts_with($authHeaderRaw, 'Bearer ')) {
        $headerToken = $headerToken !== '' ? $headerToken : trim(substr($authHeaderRaw, 7));
    }
    if ($headerToken !== '' && $botTokenOk($headerToken)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($authHeader, 'Bearer ')) {
        $token = trim(substr($authHeader, 7));
        if ($expectedSecret !== '' && hash_equals($expectedSecret, $token)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    $webhookHeader = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '';
    if ($webhookHeader !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $webhookHeader)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'POST' || $method === 'PUT') {
        if ($bodyData === null) $bodyData = read_json();
        $payloadSecret = (string) ($bodyData['secret'] ?? $bodyData['token'] ?? '');
        if ($payloadSecret !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $payloadSecret)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    require_header();
    $user = require_auth();
    return [
        'type' => 'session',
        'user' => $user['username'],
        'name' => $user['name'],
        'role' => $user['role'] ?? 'professional',
    ];
}

