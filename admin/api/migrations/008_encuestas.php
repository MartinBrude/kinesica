<?php
declare(strict_types=1);

/**
 * Migración 008 — tabla encuestas (respuestas anónimas; paciente_id opcional).
 * Dual-write con JSON vía encuestas_io.php. Ver lib_relational_encuestas.php
 */

return [
    'id' => '008_encuestas',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'encuestas')) {
            return;
        }
        if (kinesica_migrations_is_sqlite($pdo)) {
            $pdo->exec(
                'CREATE TABLE encuestas (
                    id TEXT NOT NULL PRIMARY KEY,
                    experiencia INTEGER NOT NULL,
                    tratamiento_resultado TEXT NOT NULL DEFAULT \'\',
                    tratamiento_label TEXT NOT NULL DEFAULT \'\',
                    recomendaria TEXT NOT NULL DEFAULT \'\',
                    recomendaria_label TEXT NOT NULL DEFAULT \'\',
                    comentarios TEXT NOT NULL DEFAULT \'\',
                    lang TEXT NOT NULL DEFAULT \'es\',
                    paciente_id INTEGER NULL,
                    created_at TEXT NOT NULL
                )'
            );
            $pdo->exec('CREATE INDEX idx_encuestas_created_at ON encuestas (created_at)');
            return;
        }
        $pdo->exec(
            'CREATE TABLE encuestas (
                id VARCHAR(40) NOT NULL PRIMARY KEY,
                experiencia TINYINT UNSIGNED NOT NULL,
                tratamiento_resultado VARCHAR(32) NOT NULL DEFAULT \'\',
                tratamiento_label VARCHAR(80) NOT NULL DEFAULT \'\',
                recomendaria VARCHAR(16) NOT NULL DEFAULT \'\',
                recomendaria_label VARCHAR(40) NOT NULL DEFAULT \'\',
                comentarios TEXT NOT NULL,
                lang VARCHAR(8) NOT NULL DEFAULT \'es\',
                paciente_id INT UNSIGNED NULL,
                created_at DATETIME NOT NULL,
                KEY idx_encuestas_created_at (created_at),
                KEY idx_encuestas_paciente_id (paciente_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    },
];
