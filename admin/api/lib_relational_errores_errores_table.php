<?php
declare(strict_types=1);


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
