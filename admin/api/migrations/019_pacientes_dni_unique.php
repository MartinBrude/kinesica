<?php
declare(strict_types=1);

/**
 * Migración 019 — Restricción UNIQUE para pacientes.dni.
 * Normaliza valores vacíos o de placeholder ('No provisto', '') a NULL
 * y añade el índice/restricción UNIQUE uq_pacientes_dni.
 */

return [
    'id' => '019_pacientes_dni_unique',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        if (!kinesica_migrations_table_exists($pdo, 'pacientes')) {
            return;
        }

        if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'dni')) {
            return;
        }

        // 1. Normalizar DNIs inválidos, vacíos o placeholders a NULL para que no colisionen
        $pdo->exec("
            UPDATE pacientes
            SET dni = NULL
            WHERE dni IS NOT NULL
              AND (
                TRIM(dni) = ''
                OR LOWER(TRIM(dni)) = 'no provisto'
                OR LOWER(TRIM(dni)) = 'null'
                OR dni LIKE 'sin-tel-%'
              )
        ");

        $sqlite = kinesica_migrations_is_sqlite($pdo);
        if (!$sqlite) {
            try {
                // Eliminar índice no único previo si existe
                $hasOldIdx = (bool) $pdo->query("SHOW INDEX FROM pacientes WHERE Key_name = 'idx_pacientes_dni'")->fetch();
                if ($hasOldIdx) {
                    $pdo->exec("ALTER TABLE pacientes DROP INDEX idx_pacientes_dni");
                }
            } catch (Throwable) {
            }

            try {
                $hasUq = (bool) $pdo->query("SHOW INDEX FROM pacientes WHERE Key_name = 'uq_pacientes_dni'")->fetch();
                if (!$hasUq) {
                    $pdo->exec("ALTER TABLE pacientes ADD UNIQUE KEY uq_pacientes_dni (dni)");
                }
            } catch (Throwable $e) {
                error_log('Migracion 019 uq_pacientes_dni: ' . $e->getMessage());
            }
        } else {
            try {
                $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_dni ON pacientes (dni) WHERE dni IS NOT NULL AND dni != ''");
            } catch (Throwable $e) {
                error_log('Migracion 019 SQLite uq_pacientes_dni: ' . $e->getMessage());
            }
        }
    },
];
