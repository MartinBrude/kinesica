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


function require_header(): void
{
    $header = $_SERVER['HTTP_X_KINESICA'] ?? '';
    if ($header !== '1') {
        json_out(403, ['error' => 'Solicitud rechazada']);
    }
}
