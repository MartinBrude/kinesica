<?php
declare(strict_types=1);


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
