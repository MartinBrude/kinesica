<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$token = $_GET['t'] ?? '';
$expected = (string) (cfg()['install_token'] ?? '');
if ($expected === '' || !hash_equals($expected, $token)) {
    json_out(404, ['error' => 'No encontrado']);
}

$pdo = db();
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(32) PRIMARY KEY,
        display_name VARCHAR(80) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        totp_secret VARCHAR(64) NOT NULL,
        totp_confirmed TINYINT(1) NOT NULL DEFAULT 0,
        role VARCHAR(32) NOT NULL DEFAULT \'professional\',
        active TINYINT(1) NOT NULL DEFAULT 1,
        email VARCHAR(120) NULL DEFAULT NULL,
        telefono VARCHAR(30) NULL DEFAULT NULL,
        first_name VARCHAR(60) NULL DEFAULT NULL,
        last_name VARCHAR(60) NULL DEFAULT NULL,
        login_count INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
ensure_users_role_column(true);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS fichas (
        id CHAR(36) PRIMARY KEY,
        payload JSON NOT NULL,
        profesional VARCHAR(32) NOT NULL,
        updated_at DATETIME NOT NULL,
        updated_by VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS login_attempts (
        username VARCHAR(32) PRIMARY KEY,
        failures SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        locked_until DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS password_reset_attempts (
        attempt_key CHAR(64) PRIMARY KEY,
        attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        window_start DATETIME NOT NULL,
        locked_until DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS pacientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telefono VARCHAR(20) NOT NULL UNIQUE,
        nombre VARCHAR(60) NOT NULL DEFAULT \'\',
        apellido VARCHAR(60) NOT NULL DEFAULT \'\',
        nombre_completo VARCHAR(120) NOT NULL,
        nombre_pila VARCHAR(60) NOT NULL,
        dni VARCHAR(20) DEFAULT NULL,
        email VARCHAR(120) DEFAULT NULL,
        profesional_habitual ENUM(\'norberto\', \'maria\', \'indistinto\') NOT NULL DEFAULT \'indistinto\',
        motivo_consulta VARCHAR(255) DEFAULT NULL,
        notas TEXT DEFAULT NULL,
        origen ENUM(\'whatsapp\', \'web\', \'admin\') NOT NULL DEFAULT \'whatsapp\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pacientes_tel (telefono),
        INDEX idx_pacientes_nombre (nombre_completo),
        INDEX idx_pacientes_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS lista_espera (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paciente_telefono VARCHAR(20) NOT NULL,
        paciente_nombre VARCHAR(120) NOT NULL,
        rango_horario_preferido VARCHAR(100) DEFAULT NULL,
        dias_preferidos VARCHAR(100) DEFAULT NULL,
        profesional ENUM(\'norberto\', \'maria\', \'indistinto\') NOT NULL DEFAULT \'indistinto\',
        estado ENUM(\'activa\', \'notificado\', \'asignado\', \'expirada\') NOT NULL DEFAULT \'activa\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_waitlist_tel (paciente_telefono)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
$column = $pdo->query("SHOW COLUMNS FROM fichas LIKE 'profesional'")->fetch();
if (!$column) {
    $pdo->exec("ALTER TABLE fichas ADD profesional VARCHAR(32) NOT NULL DEFAULT '' AFTER payload");
}

$stmt = $pdo->prepare(
    'INSERT INTO users (username, display_name, password_hash, totp_secret, totp_confirmed)
     VALUES (:username, :name, :hash, :totp, 0)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)'
);
foreach (cfg()['users'] ?? [] as $username => $user) {
    $stmt->execute([
        'username' => $username,
        'name' => $user['name'],
        'hash' => password_hash((string) $user['password'], PASSWORD_DEFAULT),
        'totp' => $user['totp'],
    ]);
}

$clean = cfg();
unset($clean['users']);
$clean['install_token'] = bin2hex(random_bytes(16));
file_put_contents(__DIR__ . '/config.php', "<?php\nreturn " . var_export($clean, true) . ";\n");

json_out(200, ['ok' => true]);
