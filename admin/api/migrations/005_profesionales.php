<?php
declare(strict_types=1);

/**
 * Migración 005 — profesionales + seed norberto/maria.
 * Alinea display_name desde users si existe. Ver lib_relational_profesionales.php
 */

return [
    'id' => '005_profesionales',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'profesionales')) {
            if (kinesica_migrations_is_sqlite($pdo)) {
                $pdo->exec(
                    'CREATE TABLE profesionales (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        slug TEXT NOT NULL UNIQUE,
                        username TEXT NULL,
                        display_name TEXT NOT NULL,
                        active INTEGER NOT NULL DEFAULT 1,
                        deleted_at TEXT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )'
                );
                $pdo->exec('CREATE INDEX idx_profesionales_username ON profesionales (username)');
            } else {
                $pdo->exec(
                    'CREATE TABLE profesionales (
                        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        slug VARCHAR(32) NOT NULL,
                        username VARCHAR(32) NULL,
                        display_name VARCHAR(80) NOT NULL,
                        active TINYINT(1) NOT NULL DEFAULT 1,
                        deleted_at DATETIME NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uq_profesionales_slug (slug),
                        KEY idx_profesionales_username (username)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
                );
            }
        }

        $seeds = [
            ['slug' => 'norberto', 'username' => 'norberto', 'display_name' => 'Norberto'],
            ['slug' => 'maria', 'username' => 'maria', 'display_name' => 'María'],
        ];
        $find = $pdo->prepare('SELECT id FROM profesionales WHERE slug = :slug LIMIT 1');
        $ins = $pdo->prepare(
            'INSERT INTO profesionales (slug, username, display_name, active)
             VALUES (:slug, :username, :display_name, 1)'
        );
        foreach ($seeds as $seed) {
            $find->execute(['slug' => $seed['slug']]);
            if ($find->fetchColumn()) {
                continue;
            }
            $ins->execute($seed);
        }

        // Si existe users, alinear display_name / username.
        if (kinesica_migrations_table_exists($pdo, 'users')) {
            try {
                $users = $pdo->query(
                    "SELECT username, display_name, active FROM users
                     WHERE username IN ('norberto', 'maria')"
                )->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $upd = $pdo->prepare(
                    'UPDATE profesionales
                     SET username = :u, display_name = :d, active = :a, updated_at = CURRENT_TIMESTAMP
                     WHERE slug = :slug'
                );
                foreach ($users as $u) {
                    $upd->execute([
                        'u' => (string) $u['username'],
                        'd' => (string) ($u['display_name'] ?: $u['username']),
                        'a' => isset($u['active']) ? (int) $u['active'] : 1,
                        'slug' => (string) $u['username'],
                    ]);
                }
            } catch (Throwable) {
            }
        }
    },
];
