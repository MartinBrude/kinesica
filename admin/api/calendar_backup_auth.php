<?php
declare(strict_types=1);

/**
 * Autorización para calendar backup.
 */
function kinesica_backup_has_admin_session(): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
    }
    if (empty($_SESSION['user']) || empty($_SESSION['full'])) {
        return false;
    }
    if (function_exists('is_admin')) {
        return is_admin([
            'username' => (string) ($_SESSION['user'] ?? ''),
            'role' => (string) ($_SESSION['role'] ?? 'professional'),
        ]);
    }
    return (string) ($_SESSION['role'] ?? '') === 'admin';
}

/**
 * Verifica token para acciones privilegiadas de sincronización directa (push_snapshot / mark_synced).
 */
function kinesica_backup_is_authorized_sync(array $params): bool
{
    $cfg = function_exists('cfg') ? cfg() : [];
    $expected = trim((string) (
        getenv('KINESICA_BACKUP_SECRET')
        ?: ($_SERVER['KINESICA_BACKUP_SECRET'] ?? $_ENV['KINESICA_BACKUP_SECRET'] ?? $cfg['webhook_secret'] ?? $cfg['install_token'] ?? '')
    ));
    $given = trim((string) (
        $params['secret']
        ?? $_SERVER['HTTP_X_WEBHOOK_SECRET']
        ?? ''
    ));
    $authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($given === '' && str_starts_with($authHeader, 'Bearer ')) {
        $given = trim(substr($authHeader, 7));
    }
    if ($expected !== '' && $given !== '' && hash_equals($expected, $given)) {
        return true;
    }
    $botHashFile = __DIR__ . '/bot_token.sha256';
    if ($given !== '' && is_file($botHashFile)) {
        $expectedHash = trim((string) @file_get_contents($botHashFile));
        if ($expectedHash !== '' && hash_equals($expectedHash, hash('sha256', $given))) {
            return true;
        }
    }
    return false;
}

/**
 * Piggyback del widget público: exige Origin/Referer del sitio (sin secret en el cliente).
 *
 * @param list<string> $allowedOrigins
 */
function kinesica_backup_is_trusted_browser_origin(array $allowedOrigins): bool
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        return true;
    }
    $referer = trim((string) ($_SERVER['HTTP_REFERER'] ?? ''));
    if ($referer === '') {
        return false;
    }
    foreach ($allowedOrigins as $allowed) {
        if ($referer === $allowed || str_starts_with($referer, $allowed . '/')) {
            return true;
        }
    }
    return false;
}

/** sync_client_slots: secret/sesión admin, o browser del sitio. */
function kinesica_backup_can_sync_client_slots(array $params, array $allowedOrigins): bool
{
    if (kinesica_backup_is_authorized_sync($params)) {
        return true;
    }
    if (kinesica_backup_has_admin_session()) {
        return true;
    }
    return kinesica_backup_is_trusted_browser_origin($allowedOrigins);
}

