<?php
declare(strict_types=1);


/**
 * Backfill desde todos los pacientes.
 *
 * @return array{
 *   table:string,scanned:int,synced:int,skipped:int,errors:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_paciente_contactos(PDO $pdo, bool $apply): array
{
    $stats = [
        'table' => 'paciente_contactos',
        'scanned' => 0,
        'synced' => 0,
        'skipped' => 0,
        'errors' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
    if (!kinesica_migrations_table_exists($pdo, 'pacientes')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_rel_contactos_ready($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $hasCTel = kinesica_migrations_column_exists($pdo, 'pacientes', 'contacto_telefono');
    $hasCEmail = kinesica_migrations_column_exists($pdo, 'pacientes', 'contacto_email');
    $cTelCol = $hasCTel ? 'contacto_telefono' : 'NULL AS contacto_telefono';
    $cEmailCol = $hasCEmail ? 'contacto_email' : 'NULL AS contacto_email';

    $rows = $pdo->query(
        "SELECT id, telefono, email, {$cTelCol}, {$cEmailCol} FROM pacientes"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($rows as $row) {
        $stats['scanned']++;
        $id = (int) ($row['id'] ?? 0);
        if ($id <= 0) {
            $stats['skipped']++;
            continue;
        }
        $tel = (string) ($row['telefono'] ?? '');
        $email = (string) ($row['email'] ?? '');
        $hasTel = $tel !== '' && !is_placeholder_phone($tel) && clean_phone_number($tel) !== '';
        $hasEmail = kinesica_rel_normalize_email($email) !== '';
        if (!$hasTel && !$hasEmail) {
            $stats['skipped']++;
            continue;
        }
        if (!$apply) {
            $stats['synced']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['paciente_id' => $id, 'status' => 'would_sync'];
            }
            continue;
        }
        try {
            $res = kinesica_rel_sync_paciente_contactos($pdo, $id, [
                'telefono' => $tel,
                'email' => $email,
                'contacto_telefono' => (string) ($row['contacto_telefono'] ?? ''),
                'contacto_email' => (string) ($row['contacto_email'] ?? ''),
            ]);
            $stats['synced']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['paciente_id' => $id, 'status' => 'synced', 'detail' => $res];
            }
        } catch (Throwable $e) {
            $stats['errors']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['paciente_id' => $id, 'status' => 'error', 'reason' => $e->getMessage()];
            }
        }
    }

    return $stats;
}

/**
 * Pacientes que tienen un teléfono normalizado en contactos (para resolve).
 *
 * @return list<array<string,mixed>>
 */

/**
 * Pacientes que tienen un teléfono normalizado en contactos (para resolve).
 *
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_contacto_phone(PDO $pdo, string $normPhone): array
{
    if ($normPhone === '' || !kinesica_rel_contactos_ready($pdo)) {
        return [];
    }
    $cols = ['p.id', 'p.telefono', 'p.nombre_completo'];
    if (kinesica_migrations_column_exists($pdo, 'pacientes', 'dni')) {
        $cols[] = 'p.dni';
    }
    $deletedFilter = '';
    if (kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        $deletedFilter = ' AND p.deleted_at IS NULL';
    }
    $stmt = $pdo->prepare(
        'SELECT ' . implode(', ', $cols) . '
         FROM paciente_contactos c
         INNER JOIN pacientes p ON p.id = c.paciente_id
         WHERE c.tipo = :tipo AND c.valor_normalizado = :norm' . $deletedFilter
    );
    $stmt->execute(['tipo' => 'telefono', 'norm' => $normPhone]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}
