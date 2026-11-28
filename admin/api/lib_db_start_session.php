<?php
declare(strict_types=1);

const KINESICA_SESSION_NAME = 'kinesica_atm';

function kinesica_session_name(): string
{
    return KINESICA_SESSION_NAME;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name(KINESICA_SESSION_NAME);
}

/**
 * Directorio propio para archivos de sesión.
 * Prioriza private/sessions fuera de public_html para persistir a través de deploys,
 * y data/sessions local como fallback.
 * Evita que el GC del /tmp compartido del hosting borre sesiones admin antes de 30 días.
 */
function kinesica_session_save_path(): string
{
    $domainRoot = dirname(__DIR__, 3);
    $docRoot = dirname(__DIR__, 2);
    $normalizedDoc = str_replace('\\', '/', $docRoot);
    $candidates = [];
    if (str_ends_with($normalizedDoc, '/public_html') || basename($normalizedDoc) === 'public_html') {
        $candidates[] = $domainRoot . '/private/sessions';
    }
    $candidates[] = __DIR__ . '/data/sessions';

    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $htaccess = $dir . '/.htaccess';
        if (is_dir($dir) && !is_file($htaccess)) {
            @file_put_contents($htaccess, "Require all denied\n");
        }
        if (is_dir($dir) && is_writable($dir)) {
            return $dir;
        }
    }
    return '';
}


function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        enforce_session_lifetime();
        return;
    }
    $savePath = kinesica_session_save_path();
    if ($savePath !== '') {
        session_save_path($savePath);
    }
    // GC debe cubrir la sesión admin más larga (30 días).
    ini_set('session.gc_maxlifetime', (string) session_lifetime_admin());
    session_name(KINESICA_SESSION_NAME);
    // Cookie inicial al máximo (admin); enforce_session_lifetime ajusta por rol.
    session_set_cookie_params([
        'lifetime' => session_lifetime_admin(),
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


/**
 * Emite una respuesta de error estructurada con clasificación de causa y sugerencia de acción.
 *
 * @param int $status Código HTTP (400, 401, 403, 404, 422, 500, 502, 503)
 * @param string $message Mensaje descriptivo y legible
 * @param string $category 'user_input' | 'software_logic' | 'external_service' | 'infrastructure' | 'auth'
 * @param string|null $code Código de error nemotécnico (ej: 'PHONE_INVALID', 'META_ERROR')
 * @param string|null $hint Sugerencia accionable para el usuario
 * @param array $extra Metadatos adicionales de contexto
 */
function json_error(
    int $status,
    string $message,
    string $category = 'user_input',
    ?string $code = null,
    ?string $hint = null,
    array $extra = []
): void {
    $body = array_merge([
        'ok' => false,
        'status' => 'error',
        'error' => $message,
        'message' => $message,
        'error_category' => $category,
        'error_code' => $code ?: ('ERR_' . $status),
    ], $extra);

    if ($hint !== null && $hint !== '') {
        $body['hint'] = $hint;
    }

    json_out($status, $body);
}

/**
 * Emite json_error desde un payload de fallo ya tipado (error / category / code / hint).
 */
function json_error_from(
    array $res,
    int $status = 400,
    string $fallbackMessage = 'Error',
    string $fallbackCode = 'ERROR',
    string $fallbackCategory = 'user_input'
): void {
    $hint = isset($res['hint']) && is_string($res['hint']) ? $res['hint'] : null;
    json_error(
        $status,
        (string) ($res['error'] ?? $fallbackMessage),
        (string) ($res['error_category'] ?? $fallbackCategory),
        (string) ($res['error_code'] ?? $fallbackCode),
        $hint,
        $res
    );
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
        $cookieName = kinesica_session_name();
        if (!empty($_COOKIE[$cookieName])) {
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
    if (!empty($_SESSION['csrf_token']) && is_string($_SESSION['csrf_token'])) {
        return (string) $_SESSION['csrf_token'];
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        start_session();
    }
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
    }
    return (string) $_SESSION['csrf_token'];
}
