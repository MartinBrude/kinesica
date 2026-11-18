<?php
declare(strict_types=1);


function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        enforce_session_lifetime();
        return;
    }
    // GC debe cubrir la sesión admin más larga (30 días).
    ini_set('session.gc_maxlifetime', (string) session_lifetime_admin());
    session_name('kinesica_atm');
    session_set_cookie_params([
        'lifetime' => session_lifetime_default(),
        'path' => '/admin/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    enforce_session_lifetime();
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


/**
 * Gate anti-CSRF por cabecera no-simple (fuerza preflight CORS).
 * El literal "1" no es un secreto: bloquea form POSTs cross-site simples.
 * Con cookie de sesión, también acepta el token emitido por me.php.
 */
function require_header(): void
{
    $header = trim((string) ($_SERVER['HTTP_X_KINESICA'] ?? ''));
    if ($header === '') {
        json_out(403, ['error' => 'Solicitud rechazada']);
    }
    // Si hay cookie de sesión, arrancar para poder validar csrf_token.
    if (session_status() !== PHP_SESSION_ACTIVE) {
        $cookieName = session_name();
        if ($cookieName !== '' && !empty($_COOKIE[$cookieName])) {
            start_session();
        }
    }
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['csrf_token'])) {
        $token = (string) $_SESSION['csrf_token'];
        if (hash_equals($token, $header) || $header === '1') {
            return;
        }
        json_out(403, ['error' => 'Solicitud rechazada']);
    }
    if ($header !== '1') {
        json_out(403, ['error' => 'Solicitud rechazada']);
    }
}

function kinesica_ensure_csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        start_session();
    }
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
    }
    return (string) $_SESSION['csrf_token'];
}
