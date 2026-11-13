<?php
declare(strict_types=1);


/** @return list<string> */
function kinesica_rel_config_allowed_keys(): array
{
    return [
        'practitioner_phones',
        'practitioner_emails',
        'practitioner_hours',
        'header_schedule',
        'fees',
        'clara_texts',
        'clara_texts_revision',
        'custom_menu_options',
        'clara_active',
        'booking_active',
        'horarios_updated_at',
        'horarios_updated_by',
        'relational_flags',
    ];
}


function kinesica_rel_config_is_allowed(string $key): bool
{
    return in_array($key, kinesica_rel_config_allowed_keys(), true);
}


function kinesica_rel_config_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'configuraciones');
}


function kinesica_rel_auditoria_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'auditoria_cambios');
}

/**
 * @param mixed $before
 * @param mixed $after
 */

/**
 * @param mixed $before
 * @param mixed $after
 */
function kinesica_rel_auditoria_append(
    PDO $pdo,
    string $entity,
    string $entityId,
    string $action,
    string $actor,
    $before,
    $after
): void {
    if (!kinesica_rel_auditoria_ready($pdo)) {
        return;
    }
    $beforeJson = $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE);
    $afterJson = $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE);
    $pdo->prepare(
        'INSERT INTO auditoria_cambios (entity, entity_id, action, actor, before_json, after_json)
         VALUES (:entity, :eid, :action, :actor, :before_json, :after_json)'
    )->execute([
        'entity' => $entity,
        'eid' => $entityId,
        'action' => $action,
        'actor' => $actor,
        'before_json' => $beforeJson,
        'after_json' => $afterJson,
    ]);
}

/**
 * @return array{config_key:string,value:mixed,version:int,updated_at:string,updated_by:string}|null
 */

/**
 * @return array{config_key:string,value:mixed,version:int,updated_at:string,updated_by:string}|null
 */
function kinesica_rel_config_get(PDO $pdo, string $key): ?array
{
    if (!kinesica_rel_config_ready($pdo) || !kinesica_rel_config_is_allowed($key)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT config_key, value_json, version, updated_at, updated_by
         FROM configuraciones WHERE config_key = :k LIMIT 1'
    );
    $stmt->execute(['k' => $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    $decoded = json_decode((string) ($row['value_json'] ?? ''), true);
    return [
        'config_key' => (string) $row['config_key'],
        'value' => $decoded,
        'version' => (int) ($row['version'] ?? 1),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'updated_by' => (string) ($row['updated_by'] ?? ''),
    ];
}

/**
 * Upsert con versionado. Si $expectedVersion !== null y no coincide → false (conflicto).
 *
 * @param mixed $value
 */

/**
 * Upsert con versionado. Si $expectedVersion !== null y no coincide → false (conflicto).
 *
 * @param mixed $value
 */
function kinesica_rel_config_set(
    PDO $pdo,
    string $key,
    $value,
    string $actor = '',
    ?int $expectedVersion = null
): bool {
    if (!kinesica_rel_config_ready($pdo) || !kinesica_rel_config_is_allowed($key)) {
        return false;
    }
    $json = json_encode($value, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    $current = kinesica_rel_config_get($pdo, $key);
    if ($current !== null && $expectedVersion !== null && $current['version'] !== $expectedVersion) {
        return false;
    }

    $before = $current !== null ? $current['value'] : null;
    $nextVersion = $current !== null ? $current['version'] + 1 : 1;

    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->prepare(
            'INSERT INTO configuraciones (config_key, value_json, version, updated_at, updated_by)
             VALUES (:k, :v, :ver, CURRENT_TIMESTAMP, :by)
             ON CONFLICT(config_key) DO UPDATE SET
               value_json = excluded.value_json,
               version = excluded.version,
               updated_at = CURRENT_TIMESTAMP,
               updated_by = excluded.updated_by'
        )->execute([
            'k' => $key,
            'v' => $json,
            'ver' => $nextVersion,
            'by' => $actor,
        ]);
    } else {
        $pdo->prepare(
            'INSERT INTO configuraciones (config_key, value_json, version, updated_by)
             VALUES (:k, :v, :ver, :by)
             ON DUPLICATE KEY UPDATE
               value_json = VALUES(value_json),
               version = VALUES(version),
               updated_by = VALUES(updated_by)'
        )->execute([
            'k' => $key,
            'v' => $json,
            'ver' => $nextVersion,
            'by' => $actor,
        ]);
    }

    kinesica_rel_auditoria_append(
        $pdo,
        'configuraciones',
        $key,
        $current === null ? 'create' : 'update',
        $actor,
        $before,
        $value
    );
    return true;
}

/**
 * Overlay de claves DB sobre un blob de settings (DB gana si la fila existe).
 *
 * @param array<string,mixed> $settings
 * @return array<string,mixed>
 */

/**
 * Overlay de claves DB sobre un blob de settings (DB gana si la fila existe).
 *
 * @param array<string,mixed> $settings
 * @return array<string,mixed>
 */
function kinesica_rel_config_overlay_settings(PDO $pdo, array $settings): array
{
    if (!kinesica_rel_config_ready($pdo)) {
        return $settings;
    }
    foreach (kinesica_rel_config_allowed_keys() as $key) {
        $row = kinesica_rel_config_get($pdo, $key);
        if ($row === null) {
            continue;
        }
        $settings[$key] = $row['value'];
    }
    return $settings;
}

/**
 * Espeja claves allowlisted del blob settings → configuraciones (+ auditoría).
 *
 * @param array<string,mixed> $settings
 * @return array{mirrored:int,skipped:int}
 */
