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
        $domainRoot = dirname(__DIR__, 3);
        foreach ([$domainRoot . '/private/mail.php', __DIR__ . '/mail.php'] as $mailFile) {
            if (is_file($mailFile)) {
                $mail = require $mailFile;
                if (is_array($mail)) {
                    $cfg = array_merge($cfg, $mail);
                    break;
                }
            }
        }
        foreach ([$domainRoot . '/private/whatsapp.php', __DIR__ . '/whatsapp.php'] as $waFile) {
            if (is_file($waFile)) {
                $wa = require $waFile;
                if (is_array($wa)) {
                    $cfg = array_merge($cfg, $wa);
                    break;
                }
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
    $c = cfg()['db'] ?? [];
    if (!empty($c['dsn'])) {
        $pdo = new PDO((string) $c['dsn'], (string) ($c['user'] ?? ''), (string) ($c['pass'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    }
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

// Formularios públicos (p.ej. encuestas vía send-contact) cargan lib_db solo para PDO.
// No registrar el handler admin ahí: reescribiría errores del endpoint público.
if (!defined('KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER') || !KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER) {
    set_exception_handler(static function (Throwable $error): void {
        error_log('kinesica admin: ' . $error->getMessage());
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }
        echo json_encode(['error' => 'Error interno. Intentá de nuevo.'], JSON_UNESCAPED_UNICODE);
    });
}

/** Sesión estándar (profesionales / colaboradores): 8 horas. */

/** Sesión estándar (profesionales / colaboradores): 8 horas. */
function session_lifetime_default(): int
{
    return 8 * 3600;
}

/** Sesión de administradores (role === admin): 30 días absolutos desde el login. */

/** Sesión de administradores (role === admin): 30 días absolutos desde el login. */
function session_lifetime_admin(): int
{
    return 30 * 24 * 3600;
}


function session_lifetime_for_role(string $role): int
{
    return $role === 'admin' ? session_lifetime_admin() : session_lifetime_default();
}

/**
 * @return array{expires:int,path:string,secure:bool,httponly:bool,samesite:string}
 */

/**
 * @return array{expires:int,path:string,secure:bool,httponly:bool,samesite:string}
 */
function session_cookie_params_for(int $lifetimeSeconds): array
{
    return [
        'expires' => time() + max(0, $lifetimeSeconds),
        'path' => '/admin/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}


function clear_session_cookie(): void
{
    if (headers_sent()) {
        return;
    }
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => '/admin/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}


function refresh_session_cookie(int $lifetimeSeconds): void
{
    if (session_status() !== PHP_SESSION_ACTIVE || headers_sent()) {
        return;
    }
    setcookie(session_name(), session_id(), session_cookie_params_for($lifetimeSeconds));
}


function session_role_from_session(): string
{
    return (string) ($_SESSION['role'] ?? 'professional');
}

/**
 * Caducidad absoluta desde auth_at.
 * Admin: 30 días. Resto: 8 horas.
 */

/**
 * Caducidad absoluta desde auth_at.
 * Admin: 30 días. Resto: 8 horas.
 */
function enforce_session_lifetime(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    if (empty($_SESSION['user']) || empty($_SESSION['full'])) {
        return;
    }

    $role = session_role_from_session();
    if ($role === 'admin') {
        $_SESSION['role'] = 'admin';
    }
    $lifetime = session_lifetime_for_role($role);
    $authAt = (int) ($_SESSION['auth_at'] ?? 0);
    if ($authAt <= 0) {
        $_SESSION['auth_at'] = time();
        $authAt = (int) $_SESSION['auth_at'];
    }

    $age = time() - $authAt;
    if ($age > $lifetime) {
        $_SESSION = [];
        clear_session_cookie();
        return;
    }

    refresh_session_cookie(max(60, $lifetime - $age));
}

/** Marca login completo y fija auth_at + cookie según el rol. */

/** Marca login completo y fija auth_at + cookie según el rol. */
function mark_full_session(): void
{
    $_SESSION['full'] = true;
    $_SESSION['auth_at'] = time();
    $role = session_role_from_session();
    if ($role === 'admin') {
        $_SESSION['role'] = 'admin';
    }
    refresh_session_cookie(session_lifetime_for_role($role));
}

