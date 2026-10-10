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
        totp_confirmed TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS fichas (
        id CHAR(36) PRIMARY KEY,
        payload JSON NOT NULL,
        profesional VARCHAR(32) NOT NULL,
        updated_at DATETIME NOT NULL,
        updated_by VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
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
