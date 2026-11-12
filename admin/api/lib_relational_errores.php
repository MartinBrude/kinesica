<?php
declare(strict_types=1);

/**
 * Reporte de Errores relacional — dual-write con JSON.
 *
 * Tabla: migrations/015_errores.php
 * IO: errores_io.php (load DB-first si hay filas; save espeja JSON+DB).
 * Backfill CLI: --only=errores
 */

require_once __DIR__ . '/lib_migrations.php';

function ensure_errores_table(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }
    if (kinesica_migrations_table_exists($pdo, 'errores')) {
        $ensured = true;
        return;
    }
    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS errores (
                id TEXT NOT NULL PRIMARY KEY,
                seccion TEXT NOT NULL DEFAULT \'\',
                info TEXT NOT NULL DEFAULT \'\',
                comportamiento_actual TEXT NOT NULL DEFAULT \'\',
                comportamiento_esperado TEXT NOT NULL DEFAULT \'\',
                foto TEXT NOT NULL DEFAULT \'\',
                video TEXT NOT NULL DEFAULT \'\',
                estado TEXT NOT NULL DEFAULT \'pendiente\',
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL DEFAULT \'\',
                resolved_at TEXT NULL,
                resolved_by TEXT NULL,
                updated_at TEXT NULL
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_errores_estado ON errores (estado)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_errores_created_at ON errores (created_at)');
    } else {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS errores (
                id VARCHAR(40) NOT NULL PRIMARY KEY,
                seccion VARCHAR(120) NOT NULL DEFAULT \'\',
                info VARCHAR(255) NOT NULL DEFAULT \'\',
                comportamiento_actual TEXT NOT NULL,
                comportamiento_esperado TEXT NOT NULL,
                foto VARCHAR(500) NOT NULL DEFAULT \'\',
                video VARCHAR(500) NOT NULL DEFAULT \'\',
                estado VARCHAR(20) NOT NULL DEFAULT \'pendiente\',
                created_at DATETIME NOT NULL,
                created_by VARCHAR(60) NOT NULL DEFAULT \'\',
                resolved_at DATETIME NULL,
                resolved_by VARCHAR(60) NULL,
                updated_at DATETIME NULL,
                KEY idx_errores_estado (estado),
                KEY idx_errores_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }
    $ensured = true;
}

function kinesica_rel_errores_ready(PDO $pdo): bool
{
    ensure_errores_table($pdo);
    return kinesica_migrations_table_exists($pdo, 'errores');
}

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */
function kinesica_rel_error_normalize_row(array $row): array
{
    $createdAt = (string) ($row['created_at'] ?? '');
    if ($createdAt !== '' && !str_contains($createdAt, 'T')) {
        $ts = strtotime($createdAt);
        if ($ts !== false) {
            $createdAt = gmdate('Y-m-d\TH:i:s\Z', $ts);
        }
    }
    $resolvedAt = isset($row['resolved_at']) && $row['resolved_at'] !== null && $row['resolved_at'] !== ''
        ? (string) $row['resolved_at']
        : null;
    if ($resolvedAt !== null && !str_contains($resolvedAt, 'T')) {
        $ts = strtotime($resolvedAt);
        if ($ts !== false) {
            $resolvedAt = gmdate('Y-m-d\TH:i:s\Z', $ts);
        }
    }
    $resolvedBy = isset($row['resolved_by']) && $row['resolved_by'] !== null && $row['resolved_by'] !== ''
        ? (string) $row['resolved_by']
        : null;

    return [
        'id' => (string) ($row['id'] ?? ''),
        'seccion' => (string) ($row['seccion'] ?? ''),
        'info' => (string) ($row['info'] ?? ''),
        'comportamiento_actual' => (string) ($row['comportamiento_actual'] ?? ''),
        'comportamiento_esperado' => (string) ($row['comportamiento_esperado'] ?? ''),
        'foto' => (string) ($row['foto'] ?? ''),
        'video' => (string) ($row['video'] ?? ''),
        'estado' => (string) ($row['estado'] ?? 'pendiente'),
        'created_at' => $createdAt !== '' ? $createdAt : gmdate('Y-m-d\TH:i:s\Z'),
        'created_by' => (string) ($row['created_by'] ?? 'admin'),
        'resolved_at' => $resolvedAt,
        'resolved_by' => $resolvedBy,
    ];
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_errores_load_db(PDO $pdo): array
{
    if (!kinesica_rel_errores_ready($pdo)) {
        return [];
    }
    $rows = $pdo->query(
        'SELECT id, seccion, info, comportamiento_actual, comportamiento_esperado,
                foto, video, estado, created_at, created_by, resolved_at, resolved_by, updated_at
         FROM errores
         ORDER BY created_at DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $out = [];
    foreach ($rows as $row) {
        $n = kinesica_rel_error_normalize_row($row);
        if ($n['id'] !== '') {
            $out[] = $n;
        }
    }
    return $out;
}

/**
 * @param array<string,mixed> $error
 */
function kinesica_rel_error_upsert(PDO $pdo, array $error, string $actor = ''): bool
{
    if (!kinesica_rel_errores_ready($pdo)) {
        return false;
    }
    $n = kinesica_rel_error_normalize_row($error);
    if ($n['id'] === '') {
        return false;
    }
    if ($actor !== '') {
        if ($n['created_by'] === '') {
            $n['created_by'] = $actor;
        }
    }

    $createdSql = str_replace('T', ' ', rtrim($n['created_at'], 'Z'));
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $createdSql)) {
        $createdSql .= ' 00:00:00';
    }
    $resolvedSql = null;
    if ($n['resolved_at'] !== null) {
        $resolvedSql = str_replace('T', ' ', rtrim($n['resolved_at'], 'Z'));
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $resolvedSql)) {
            $resolvedSql .= ' 00:00:00';
        }
    }
    $nowSql = gmdate('Y-m-d H:i:s');

    $params = [
        'id' => $n['id'],
        'seccion' => $n['seccion'],
        'info' => $n['info'],
        'actual' => $n['comportamiento_actual'],
        'esperado' => $n['comportamiento_esperado'],
        'foto' => $n['foto'],
        'video' => $n['video'],
        'estado' => $n['estado'],
        'created_at' => $createdSql,
        'created_by' => $n['created_by'],
        'resolved_at' => $resolvedSql,
        'resolved_by' => $n['resolved_by'],
        'updated_at' => $nowSql,
    ];

    $existing = $pdo->prepare('SELECT id, seccion, info, estado, resolved_at FROM errores WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $n['id']]);
    $before = $existing->fetch(PDO::FETCH_ASSOC) ?: null;

    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->prepare(
            'INSERT INTO errores (
                id, seccion, info, comportamiento_actual, comportamiento_esperado,
                foto, video, estado, created_at, created_by, resolved_at, resolved_by, updated_at
             ) VALUES (
                :id, :seccion, :info, :actual, :esperado,
                :foto, :video, :estado, :created_at, :created_by, :resolved_at, :resolved_by, :updated_at
             )
             ON CONFLICT(id) DO UPDATE SET
                seccion = excluded.seccion,
                info = excluded.info,
                comportamiento_actual = excluded.comportamiento_actual,
                comportamiento_esperado = excluded.comportamiento_esperado,
                foto = excluded.foto,
                video = excluded.video,
                estado = excluded.estado,
                resolved_at = excluded.resolved_at,
                resolved_by = excluded.resolved_by,
                updated_at = excluded.updated_at'
        )->execute($params);
    } else {
        $pdo->prepare(
            'INSERT INTO errores (
                id, seccion, info, comportamiento_actual, comportamiento_esperado,
                foto, video, estado, created_at, created_by, resolved_at, resolved_by, updated_at
             ) VALUES (
                :id, :seccion, :info, :actual, :esperado,
                :foto, :video, :estado, :created_at, :created_by, :resolved_at, :resolved_by, :updated_at
             )
             ON DUPLICATE KEY UPDATE
                seccion = VALUES(seccion),
                info = VALUES(info),
                comportamiento_actual = VALUES(comportamiento_actual),
                comportamiento_esperado = VALUES(comportamiento_esperado),
                foto = VALUES(foto),
                video = VALUES(video),
                estado = VALUES(estado),
                resolved_at = VALUES(resolved_at),
                resolved_by = VALUES(resolved_by),
                updated_at = VALUES(updated_at)'
        )->execute($params);
    }

    if (file_exists(__DIR__ . '/lib_relational_config.php')) {
        require_once __DIR__ . '/lib_relational_config.php';
        if (function_exists('kinesica_rel_auditoria_append')) {
            kinesica_rel_auditoria_append(
                $pdo,
                'errores',
                $n['id'],
                $before === null ? 'create' : 'update',
                $actor !== '' ? $actor : ($n['created_by'] ?: 'system'),
                $before,
                [
                    'seccion' => $n['seccion'],
                    'info' => $n['info'],
                    'estado' => $n['estado'],
                ]
            );
        }
    }
    return true;
}

function kinesica_rel_error_delete(PDO $pdo, string $id, string $actor = ''): bool
{
    if (!kinesica_rel_errores_ready($pdo) || $id === '') {
        return false;
    }
    $existing = $pdo->prepare('SELECT id, seccion, info, estado FROM errores WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $before = $existing->fetch(PDO::FETCH_ASSOC) ?: null;

    $stmt = $pdo->prepare('DELETE FROM errores WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $ok = $stmt->rowCount() > 0;
    if ($ok && file_exists(__DIR__ . '/lib_relational_config.php')) {
        require_once __DIR__ . '/lib_relational_config.php';
        if (function_exists('kinesica_rel_auditoria_append')) {
            kinesica_rel_auditoria_append(
                $pdo,
                'errores',
                $id,
                'delete',
                $actor !== '' ? $actor : 'system',
                $before,
                null
            );
        }
    }
    return $ok;
}

/**
 * @return array{scanned:int,updated:int,skipped:int}
 */
function kinesica_rel_backfill_errores(PDO $pdo, bool $apply): array
{
    $stats = ['scanned' => 0, 'updated' => 0, 'skipped' => 0];
    if (!kinesica_rel_errores_ready($pdo)) {
        $stats['skipped'] = 1;
        return $stats;
    }
    require_once __DIR__ . '/errores_io.php';
    $list = kinesica_errores_load_json_only();
    foreach ($list as $item) {
        if (!is_array($item)) {
            continue;
        }
        $stats['scanned']++;
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            $stats['skipped']++;
            continue;
        }
        $chk = $pdo->prepare('SELECT id FROM errores WHERE id = :id LIMIT 1');
        $chk->execute(['id' => $id]);
        if ($chk->fetchColumn()) {
            $stats['skipped']++;
            continue;
        }
        if ($apply) {
            if (kinesica_rel_error_upsert($pdo, $item, 'backfill')) {
                $stats['updated']++;
            } else {
                $stats['skipped']++;
            }
        } else {
            $stats['updated']++;
        }
    }
    return $stats;
}
