<?php
declare(strict_types=1);

/**
 * Migración 009 — phone/email en profesionales (etapa 8).
 * Espejo de practitioner_phones/emails en settings; sync desde users.
 * Runtime: profesionales_sync.php · lib_relational_config.php
 * Docs: docs/etapa8-config-gastos.md
 */

return [
    'id' => '009_profesionales_contactos',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'profesionales')) {
            return;
        }
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'profesionales',
            'phone',
            'VARCHAR(32) NULL',
            'TEXT NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'profesionales',
            'email',
            'VARCHAR(120) NULL',
            'TEXT NULL'
        );

        // Alinear desde users si existe.
        if (!kinesica_migrations_table_exists($pdo, 'users')) {
            return;
        }
        try {
            $users = $pdo->query(
                "SELECT username, email, telefono FROM users
                 WHERE username IN ('norberto', 'maria')"
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $upd = $pdo->prepare(
                'UPDATE profesionales
                 SET phone = COALESCE(:phone, phone),
                     email = COALESCE(:email, email),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE slug = :slug OR username = :u'
            );
            foreach ($users as $u) {
                $phone = trim((string) ($u['telefono'] ?? ''));
                $email = trim((string) ($u['email'] ?? ''));
                $upd->execute([
                    'phone' => $phone !== '' ? $phone : null,
                    'email' => $email !== '' ? $email : null,
                    'slug' => (string) $u['username'],
                    'u' => (string) $u['username'],
                ]);
            }
        } catch (Throwable) {
        }
    },
];
