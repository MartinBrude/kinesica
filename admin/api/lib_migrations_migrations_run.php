<?php
declare(strict_types=1);


/**
 * Aplica migraciones pendientes.
 *
 * @return array{applied:list<string>,skipped:list<string>,pending:list<string>}
 */
function kinesica_migrations_run(PDO $pdo, bool $dryRun = false): array
{
    kinesica_migrations_ensure_control_table($pdo);
    $appliedMap = kinesica_migrations_applied_map($pdo);
    $discovered = kinesica_migrations_discover();
    $result = ['applied' => [], 'skipped' => [], 'pending' => []];

    foreach ($discovered as $mig) {
        $id = $mig['id'];
        if (isset($appliedMap[$id])) {
            if (!hash_equals($appliedMap[$id], $mig['checksum'])) {
                throw new RuntimeException(
                    "Checksum distinto para migración ya aplicada {$id}. No editar migraciones aplicadas; crear una nueva."
                );
            }
            $result['skipped'][] = $id;
            continue;
        }
        $result['pending'][] = $id;
        if ($dryRun) {
            continue;
        }
        // MySQL/MariaDB hace commit implícito en DDL; solo transaccionamos en SQLite.
        $useTx = kinesica_migrations_is_sqlite($pdo);
        if ($useTx) {
            $pdo->beginTransaction();
        }
        try {
            ($mig['up'])($pdo);
            $ins = $pdo->prepare(
                'INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (:id, :checksum, :at)'
            );
            $ins->execute([
                'id' => $id,
                'checksum' => $mig['checksum'],
                'at' => gmdate('Y-m-d H:i:s'),
            ]);
            if ($useTx && $pdo->inTransaction()) {
                $pdo->commit();
            }
            $result['applied'][] = $id;
        } catch (Throwable $e) {
            if ($useTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw new RuntimeException("Fallo migración {$id}: " . $e->getMessage(), 0, $e);
        }
    }

    return $result;
}

/**
 * @return array{applied:list<string>,pending:list<string>}
 */

/**
 * @return array{applied:list<string>,pending:list<string>}
 */
function kinesica_migrations_status(PDO $pdo): array
{
    $appliedMap = kinesica_migrations_applied_map($pdo);
    $applied = [];
    $pending = [];
    foreach (kinesica_migrations_discover() as $mig) {
        if (isset($appliedMap[$mig['id']])) {
            $applied[] = $mig['id'];
        } else {
            $pending[] = $mig['id'];
        }
    }
    return ['applied' => $applied, 'pending' => $pending];
}
