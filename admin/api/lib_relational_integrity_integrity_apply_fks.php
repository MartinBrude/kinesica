<?php
declare(strict_types=1);


/**
 * Aplica FKs RESTRICT de etapa 9 (idempotente). Usado por mig 013.
 * Fuente de verdad: kinesica_rel_integrity_fk_specs().
 *
 * @return array{added:list<string>,skipped:list<string>}
 */
function kinesica_rel_integrity_apply_fks(PDO $pdo): array
{
    $added = [];
    $skipped = [];

    // En MySQL/MariaDB asegurar que la clave primaria pacientes.id sea INT UNSIGNED
    // para coincidir con el tipo INT UNSIGNED de las columnas paciente_id foráneas.
    if (!kinesica_migrations_is_sqlite($pdo)) {
        try {
            if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
                $pdo->exec('ALTER TABLE pacientes MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT');
            }
        } catch (Throwable $e) {
            error_log('kinesica ensure pacientes.id INT UNSIGNED: ' . $e->getMessage());
        }
    }

    foreach (kinesica_rel_integrity_fk_specs() as $spec) {
        $table = $spec['table'];
        $col = $spec['column'];
        $parent = $spec['parent'];
        $name = kinesica_rel_integrity_fk_name($table, $col);
        try {
            if (kinesica_migrations_add_fk_if_missing(
                $pdo,
                $table,
                $name,
                $col,
                $parent,
                $spec['parent_column'],
                'RESTRICT',
                'RESTRICT'
            )) {
                $added[] = $name;
            } else {
                $skipped[] = $name;
            }
        } catch (Throwable $e) {
            error_log("kinesica FK {$name}: " . $e->getMessage());
            $skipped[] = $name . ':error';
        }
    }

    // CHECK opcionales (status)
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'turnos',
        'chk_turnos_status',
        "status IN ('scheduled','cancelled','completed','unknown')"
    );
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'turnos',
        'chk_turnos_source',
        "source IN ('gas','recordatorio','manual','backfill','booking','backup')"
    );
    kinesica_migrations_add_check_if_missing(
        $pdo,
        'recordatorio_eventos',
        'chk_recordatorio_status',
        "status IN ('pending','sent','sent_email','failed','missing_phone','skipped','run_skipped')"
    );

    return ['added' => $added, 'skipped' => $skipped];
}
