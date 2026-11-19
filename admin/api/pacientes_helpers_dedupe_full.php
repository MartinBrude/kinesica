<?php
declare(strict_types=1);

/**
 * Barrido completo de dedupe del directorio activo.
 */

require_once __DIR__ . '/pacientes_helpers_alive.php';
require_once __DIR__ . '/pacientes_helpers_match_steps.php';
require_once __DIR__ . '/pacientes_helpers_dedupe_link.php';
require_once __DIR__ . '/pacientes_helpers_dedup_apply.php';

function deduplicate_pacientes_table(PDO $pdo): int
{
    try {
        // Solo fichas activas: un soft-deleted nunca puede ser survivor ni absorber a un activo.
        $alive = kinesica_pacientes_alive_sql($pdo);
        $stmt = $pdo->query("SELECT * FROM pacientes WHERE ({$alive}) ORDER BY id ASC");
        if (!$stmt) {
            return 0;
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $rows = array_values(array_filter($rows, 'kinesica_pacientes_row_is_active'));
        if (count($rows) <= 1) {
            return 0;
        }

        $clusters = kinesica_dedupe_build_clusters($rows);
        return kinesica_pacientes_dedup_apply_clusters($pdo, $clusters);
    } catch (Throwable $e) {
        error_log('deduplicate_pacientes_table error: ' . $e->getMessage());
        return 0;
    }
}
