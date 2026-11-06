<?php
declare(strict_types=1);

/**
 * Migración 013 — FOREIGN KEYs RESTRICT + CHECK status (etapa 9).
 *
 * Preflight: NULL en IDs huérfanos para que ALTER no falle.
 * SQLite: ADD FK vía ALTER no es portable → no-op (tests usan CREATE + PRAGMA).
 * Rollback operativo: REL_ENFORCE_FK=false (app); DROP CONSTRAINT = mig futura / restore.
 *
 * Ver lib_relational_integrity.php · docs/etapa9-integridad-referencial.md
 */

return [
    'id' => '013_rel_integrity_fks',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';
        require_once dirname(__DIR__) . '/lib_relational_integrity.php';

        // 1) Limpiar huérfanos (IDs apuntando a padres inexistentes).
        $orphans = kinesica_rel_integrity_null_orphans($pdo, true);
        foreach ($orphans as $o) {
            if (($o['nulled'] ?? 0) > 0) {
                error_log(sprintf(
                    'kinesica 013: nulled %d orphans on %s.%s',
                    $o['nulled'],
                    $o['table'],
                    $o['column']
                ));
            }
        }

        // 2) FKs + CHECKs (MariaDB).
        kinesica_rel_integrity_apply_fks($pdo);
    },
];
