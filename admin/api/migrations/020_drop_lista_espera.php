<?php
declare(strict_types=1);

/**
 * Migración 020 — Eliminar tabla lista_espera.
 * La funcionalidad de lista de espera ya no se utiliza en el sistema.
 */

return [
    'id' => '020_drop_lista_espera',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (kinesica_migrations_table_exists($pdo, 'lista_espera')) {
            $pdo->exec('DROP TABLE IF EXISTS lista_espera');
        }
    },
];
