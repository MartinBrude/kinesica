<?php
declare(strict_types=1);

/**
 * Migración 017 — scrub de manage_code en plaintext.
 * Los writes nuevos solo persisten manage_code_hash; limpia residuos legacy.
 */

return [
    'id' => '017_scrub_manage_code_plaintext',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'turnos')) {
            return;
        }
        if (!kinesica_migrations_column_exists($pdo, 'turnos', 'manage_code')) {
            return;
        }
        $pdo->exec('UPDATE turnos SET manage_code = NULL WHERE manage_code IS NOT NULL');
    },
];
