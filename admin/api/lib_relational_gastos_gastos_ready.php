<?php
declare(strict_types=1);


function kinesica_rel_gastos_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'gastos');
}

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */
function kinesica_rel_gasto_normalize_row(array $row): array
{
    $out = [
        'id' => (string) ($row['id'] ?? ''),
        'concepto' => (string) ($row['concepto'] ?? ''),
        'detalle' => (string) ($row['detalle'] ?? ''),
        'fecha' => (string) ($row['fecha'] ?? ''),
        'moneda' => strtoupper((string) ($row['moneda'] ?? 'ARS')),
        'monto' => (float) ($row['monto'] ?? 0),
        'created_by' => (string) ($row['created_by'] ?? ''),
        'updated_by' => (string) ($row['updated_by'] ?? ''),
    ];
    foreach (['monto_eur', 'monto_usd', 'monto_ars', 'tc_eur_usd', 'tc_eur_ars'] as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null && $row[$k] !== '') {
            $out[$k] = (float) $row[$k];
        }
    }
    if (!empty($row['created_at'])) {
        $out['created_at'] = (string) $row['created_at'];
    }
    if (!empty($row['updated_at'])) {
        $out['updated_at'] = (string) $row['updated_at'];
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_gastos_load_db(PDO $pdo): array
{
    if (!kinesica_rel_gastos_ready($pdo)) {
        return [];
    }
    $rows = $pdo->query(
        'SELECT id, concepto, detalle, fecha, moneda, monto,
                monto_eur, monto_usd, monto_ars, tc_eur_usd, tc_eur_ars,
                created_at, updated_at, created_by, updated_by
         FROM gastos
         ORDER BY fecha DESC, id DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $out = [];
    foreach ($rows as $row) {
        $n = kinesica_rel_gasto_normalize_row($row);
        if ($n['id'] !== '') {
            $out[] = $n;
        }
    }
    return $out;
}

/**
 * @param array<string,mixed> $gasto
 */

/**
 * @param array<string,mixed> $gasto
 */
function kinesica_rel_gasto_upsert(PDO $pdo, array $gasto, string $actor = ''): bool
{
    if (!kinesica_rel_gastos_ready($pdo)) {
        return false;
    }
    $n = kinesica_rel_gasto_normalize_row($gasto);
    if ($n['id'] === '' || $n['fecha'] === '') {
        return false;
    }
    if ($actor !== '') {
        if ($n['created_by'] === '') {
            $n['created_by'] = $actor;
        }
        $n['updated_by'] = $actor;
    }

    $params = [
        'id' => $n['id'],
        'concepto' => $n['concepto'],
        'detalle' => $n['detalle'],
        'fecha' => $n['fecha'],
        'moneda' => $n['moneda'],
        'monto' => $n['monto'],
        'monto_eur' => $n['monto_eur'] ?? null,
        'monto_usd' => $n['monto_usd'] ?? null,
        'monto_ars' => $n['monto_ars'] ?? null,
        'tc_eur_usd' => $n['tc_eur_usd'] ?? null,
        'tc_eur_ars' => $n['tc_eur_ars'] ?? null,
        'created_by' => $n['created_by'],
        'updated_by' => $n['updated_by'],
    ];

    $existing = $pdo->prepare('SELECT id, concepto, detalle, fecha, moneda, monto FROM gastos WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $n['id']]);
    $before = $existing->fetch(PDO::FETCH_ASSOC) ?: null;

    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->prepare(
            'INSERT INTO gastos (
                id, concepto, detalle, fecha, moneda, monto,
                monto_eur, monto_usd, monto_ars, tc_eur_usd, tc_eur_ars,
                created_at, updated_at, created_by, updated_by
             ) VALUES (
                :id, :concepto, :detalle, :fecha, :moneda, :monto,
                :monto_eur, :monto_usd, :monto_ars, :tc_eur_usd, :tc_eur_ars,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :created_by, :updated_by
             )
             ON CONFLICT(id) DO UPDATE SET
                concepto = excluded.concepto,
                detalle = excluded.detalle,
                fecha = excluded.fecha,
                moneda = excluded.moneda,
                monto = excluded.monto,
                monto_eur = excluded.monto_eur,
                monto_usd = excluded.monto_usd,
                monto_ars = excluded.monto_ars,
                tc_eur_usd = excluded.tc_eur_usd,
                tc_eur_ars = excluded.tc_eur_ars,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by'
        )->execute($params);
    } else {
        $pdo->prepare(
            'INSERT INTO gastos (
                id, concepto, detalle, fecha, moneda, monto,
                monto_eur, monto_usd, monto_ars, tc_eur_usd, tc_eur_ars,
                created_at, updated_at, created_by, updated_by
             ) VALUES (
                :id, :concepto, :detalle, :fecha, :moneda, :monto,
                :monto_eur, :monto_usd, :monto_ars, :tc_eur_usd, :tc_eur_ars,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :created_by, :updated_by
             )
             ON DUPLICATE KEY UPDATE
                concepto = VALUES(concepto),
                detalle = VALUES(detalle),
                fecha = VALUES(fecha),
                moneda = VALUES(moneda),
                monto = VALUES(monto),
                monto_eur = VALUES(monto_eur),
                monto_usd = VALUES(monto_usd),
                monto_ars = VALUES(monto_ars),
                tc_eur_usd = VALUES(tc_eur_usd),
                tc_eur_ars = VALUES(tc_eur_ars),
                updated_at = CURRENT_TIMESTAMP,
                updated_by = VALUES(updated_by)'
        )->execute($params);
    }

    require_once __DIR__ . '/lib_relational_config.php';
    kinesica_rel_auditoria_append(
        $pdo,
        'gastos',
        $n['id'],
        $before === null ? 'create' : 'update',
        $actor !== '' ? $actor : ($n['updated_by'] ?: 'system'),
        $before,
        [
            'concepto' => $n['concepto'],
            'detalle' => $n['detalle'],
            'fecha' => $n['fecha'],
            'moneda' => $n['moneda'],
            'monto' => $n['monto'],
        ]
    );
    return true;
}


function kinesica_rel_gasto_delete(PDO $pdo, string $id, string $actor = ''): bool
{
    if (!kinesica_rel_gastos_ready($pdo) || $id === '') {
        return false;
    }
    $existing = $pdo->prepare('SELECT id, concepto, detalle, fecha, moneda, monto FROM gastos WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $before = $existing->fetch(PDO::FETCH_ASSOC) ?: null;

    $stmt = $pdo->prepare('DELETE FROM gastos WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $ok = $stmt->rowCount() > 0;
    if ($ok) {
        require_once __DIR__ . '/lib_relational_config.php';
        kinesica_rel_auditoria_append(
            $pdo,
            'gastos',
            $id,
            'delete',
            $actor !== '' ? $actor : 'system',
            $before,
            null
        );
    }
    return $ok;
}

/**
 * @return array{scanned:int,updated:int,skipped:int}
 */
