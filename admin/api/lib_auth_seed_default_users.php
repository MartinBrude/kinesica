<?php
declare(strict_types=1);


function seed_default_users(?PDO $pdo = null): void
{
    $pdo = $pdo ?? db();
    try {
        $cnt = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($cnt > 0) {
            return;
        }
        $seedUsers = [
            'martin' => ['name' => 'Martín', 'email' => 'martin.brude@gmail.com', 'telefono' => '+34 658 44 49 35', 'first_name' => 'Martín', 'last_name' => 'Brude', 'role' => 'admin'],
            'norberto' => ['name' => 'Norberto', 'email' => 'norberto1712@gmail.com', 'telefono' => '5491161564311', 'first_name' => 'Norberto', 'last_name' => 'Brude', 'role' => 'admin'],
            'maria' => ['name' => 'María', 'email' => 'manosmagicas7116@gmail.com', 'telefono' => '5491128531224', 'first_name' => 'María', 'last_name' => 'Gulin', 'role' => 'professional'],
            'facundo' => ['name' => 'Facundo Vivardo', 'email' => 'facu86@gmail.com', 'telefono' => '', 'first_name' => 'Facundo', 'last_name' => 'Vivardo', 'role' => 'colaborador'],
        ];

        $ins = $pdo->prepare(
            'INSERT INTO users (username, display_name, password_hash, totp_secret, totp_confirmed, role, active, email, telefono, first_name, last_name, login_count)
             VALUES (:username, :name, "", "", 0, :role, 1, :email, :telefono, :first_name, :last_name, 0)'
        );

        foreach ($seedUsers as $uName => $uData) {
            $ins->execute([
                'username' => $uName, 'name' => $uData['name'], 'role' => $uData['role'],
                'email' => $uData['email'], 'telefono' => $uData['telefono'],
                'first_name' => $uData['first_name'], 'last_name' => $uData['last_name'],
            ]);
        }
    } catch (Throwable $e) {}
}


function user_role(string $username): string
{
    try {
        $stmt = db()->prepare('SELECT role FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $role = $stmt->fetchColumn();
        if ($role) {
            return (string) $role;
        }
    } catch (Throwable $e) {}

    // Sin fila en DB: nunca elevar por nombre (admins salen del seed / columna role).
    return 'professional';
}

/** Admins activos (opcionalmente excluyendo un username). */
function count_active_admins(?PDO $pdo = null, ?string $exceptUsername = null): int
{
    $pdo = $pdo ?? db();
    try {
        if ($exceptUsername !== null && $exceptUsername !== '') {
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1 AND username != :u"
            );
            $stmt->execute(['u' => $exceptUsername]);
            return (int) $stmt->fetchColumn();
        }
        return (int) $pdo->query(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1"
        )->fetchColumn();
    } catch (Throwable $e) {
        return 0;
    }
}
