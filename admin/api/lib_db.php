<?php
declare(strict_types=1);

/**
 * Rutas candidatas de config (la primera que exista gana).
 *
 * @return list<string>
 */
function kinesica_config_candidate_paths(): array
{
    $domainRoot = dirname(__DIR__, 3);
    $paths = [
        $domainRoot . '/private/admin-config.php',
        __DIR__ . '/config.php',
    ];
    // Solo para pruebas automatizadas: config alternativa por variable de entorno.
    $override = getenv('KINESICA_ADMIN_CONFIG');
    if (is_string($override) && $override !== '' && is_file($override)) {
        array_unshift($paths, $override);
    }
    return $paths;
}

function cfg(): array
{
    static $cfg;
    if ($cfg === null) {
        $cfg = [];
        foreach (kinesica_config_candidate_paths() as $configFile) {
            if (is_file($configFile)) {
                $loaded = require $configFile;
                if (is_array($loaded)) {
                    $cfg = $loaded;
                    break;
                }
            }
        }
        if ($cfg === [] && is_file(__DIR__ . '/config.example.php')) {
            $cfg = require __DIR__ . '/config.example.php';
        }
        $mailFile = __DIR__ . '/mail.php';
        if (is_file($mailFile)) {
            $mail = require $mailFile;
            if (is_array($mail)) {
                $cfg = array_merge($cfg, $mail);
            }
        }
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
    $lifetime = 8 * 3600;
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    session_name('kinesica_atm');
    session_set_cookie_params([
        'lifetime' => $lifetime,
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
