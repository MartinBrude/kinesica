<?php
declare(strict_types=1);


/**
 * Espeja claves allowlisted del blob settings → configuraciones (+ auditoría).
 *
 * @param array<string,mixed> $settings
 * @return array{mirrored:int,skipped:int}
 */
function kinesica_rel_config_mirror_settings(PDO $pdo, array $settings, string $actor = ''): array
{
    $stats = ['mirrored' => 0, 'skipped' => 0];
    if (!kinesica_rel_config_ready($pdo)) {
        return $stats;
    }
    foreach (kinesica_rel_config_allowed_keys() as $key) {
        if (!array_key_exists($key, $settings)) {
            $stats['skipped']++;
            continue;
        }
        $existing = kinesica_rel_config_get($pdo, $key);
        if ($existing !== null) {
            $prev = json_encode($existing['value'], JSON_UNESCAPED_UNICODE);
            $next = json_encode($settings[$key], JSON_UNESCAPED_UNICODE);
            if ($prev === $next) {
                $stats['skipped']++;
                continue;
            }
        }
        if (kinesica_rel_config_set($pdo, $key, $settings[$key], $actor)) {
            $stats['mirrored']++;
        } else {
            $stats['skipped']++;
        }
    }
    return $stats;
}

/**
 * Backfill desde settings JSON (seed/runtime).
 *
 * @return array{scanned:int,updated:int,skipped:int}
 */

/**
 * Backfill desde settings JSON (seed/runtime).
 *
 * @return array{scanned:int,updated:int,skipped:int}
 */
function kinesica_rel_backfill_configuraciones(PDO $pdo, bool $apply): array
{
    $stats = ['scanned' => 0, 'updated' => 0, 'skipped' => 0];
    if (!kinesica_rel_config_ready($pdo)) {
        $stats['skipped'] = 1;
        return $stats;
    }
    require_once __DIR__ . '/kinesica_settings_storage.php';
    $raw = kinesica_settings_raw(kinesica_settings_source_file());
    foreach (kinesica_rel_config_allowed_keys() as $key) {
        if (!array_key_exists($key, $raw)) {
            continue;
        }
        $stats['scanned']++;
        $existing = kinesica_rel_config_get($pdo, $key);
        if ($existing !== null) {
            $stats['skipped']++;
            continue;
        }
        if ($apply && kinesica_rel_config_set($pdo, $key, $raw[$key], 'backfill')) {
            $stats['updated']++;
        } elseif (!$apply) {
            $stats['updated']++; // dry-run: would insert
        }
    }
    return $stats;
}

/**
 * Sync phone/email en tabla profesionales (mig 009).
 */

/**
 * Sync phone/email en tabla profesionales (mig 009).
 */
function kinesica_rel_profesional_set_contact(
    PDO $pdo,
    string $slug,
    ?string $phone,
    ?string $email
): bool {
    $slug = strtolower(trim($slug));
    if ($slug === '' || !kinesica_migrations_table_exists($pdo, 'profesionales')) {
        return false;
    }
    if (
        !kinesica_migrations_column_exists($pdo, 'profesionales', 'phone')
        && !kinesica_migrations_column_exists($pdo, 'profesionales', 'email')
    ) {
        return false;
    }
    $sets = [];
    $params = ['slug' => $slug, 'u' => $slug];
    if (kinesica_migrations_column_exists($pdo, 'profesionales', 'phone')) {
        $sets[] = 'phone = :phone';
        $params['phone'] = $phone !== null && $phone !== '' ? $phone : null;
    }
    if (kinesica_migrations_column_exists($pdo, 'profesionales', 'email')) {
        $sets[] = 'email = :email';
        $params['email'] = $email !== null && $email !== '' ? $email : null;
    }
    if ($sets === []) {
        return false;
    }
    $sql = 'UPDATE profesionales SET ' . implode(', ', $sets)
        . ', updated_at = CURRENT_TIMESTAMP WHERE slug = :slug OR username = :u';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount() > 0;
}

/**
 * @return array{scanned:int,updated:int,skipped:int}
 */

/**
 * @return array{scanned:int,updated:int,skipped:int}
 */
function kinesica_rel_backfill_profesionales_contactos(PDO $pdo, bool $apply): array
{
    $stats = ['scanned' => 0, 'updated' => 0, 'skipped' => 0];
    if (
        !kinesica_migrations_table_exists($pdo, 'profesionales')
        || !kinesica_migrations_column_exists($pdo, 'profesionales', 'phone')
    ) {
        $stats['skipped'] = 1;
        return $stats;
    }

    require_once __DIR__ . '/kinesica_settings_storage.php';
    $raw = kinesica_settings_raw(kinesica_settings_source_file());
    $phones = is_array($raw['practitioner_phones'] ?? null) ? $raw['practitioner_phones'] : [];
    $emails = is_array($raw['practitioner_emails'] ?? null) ? $raw['practitioner_emails'] : [];

    $slugs = array_unique(array_merge(array_keys($phones), array_keys($emails)));
    foreach ($slugs as $slug) {
        $slug = (string) $slug;
        if ($slug === '' || $slug === 'martin') {
            continue;
        }
        $stats['scanned']++;
        $phone = isset($phones[$slug]) ? trim((string) $phones[$slug]) : null;
        $email = isset($emails[$slug]) ? trim((string) $emails[$slug]) : null;
        if (($phone === null || $phone === '') && ($email === null || $email === '')) {
            $stats['skipped']++;
            continue;
        }
        if ($apply) {
            if (kinesica_rel_profesional_set_contact($pdo, $slug, $phone, $email)) {
                $stats['updated']++;
            } else {
                $stats['skipped']++;
            }
        } else {
            $stats['updated']++;
        }
    }

    // También desde users si existe.
    if (kinesica_migrations_table_exists($pdo, 'users')) {
        try {
            $users = $pdo->query(
                "SELECT username, email, telefono FROM users
                 WHERE username IN ('norberto', 'maria') AND active = 1"
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($users as $u) {
                $stats['scanned']++;
                $slug = (string) ($u['username'] ?? '');
                $phone = trim((string) ($u['telefono'] ?? ''));
                $email = trim((string) ($u['email'] ?? ''));
                if ($apply && kinesica_rel_profesional_set_contact(
                    $pdo,
                    $slug,
                    $phone !== '' ? $phone : null,
                    $email !== '' ? $email : null
                )) {
                    $stats['updated']++;
                } elseif (!$apply) {
                    $stats['updated']++;
                }
            }
        } catch (Throwable) {
        }
    }

    return $stats;
}
