<?php
declare(strict_types=1);


function interacciones_dir(): string
{
    $dir = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    if ($dir === '') {
        $dir = __DIR__ . '/data';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}


function interacciones_media_dir(): string
{
    $custom = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    $dir = $custom !== '' ? ($custom . '/media') : (dirname(__DIR__) . '/uploads/interacciones');
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        if (!is_file($dir . '/.htaccess')) {
            @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        }
    }
    return $dir;
}


function interacciones_clean_media_id(string $raw): string
{
    $clean = preg_replace('/[^A-Za-z0-9_\-.]/', '', trim($raw)) ?? '';
    $clean = ltrim($clean, '.');
    return (strlen($clean) >= 3 && strlen($clean) <= 128) ? $clean : '';
}


function interacciones_tz(): DateTimeZone
{
    $name = 'America/Argentina/Buenos_Aires';
    if (function_exists('cfg')) {
        $configured = cfg()['interacciones_tz'] ?? '';
        if (is_string($configured) && $configured !== '') {
            $name = $configured;
        }
    }
    try {
        return new DateTimeZone($name);
    } catch (Throwable $e) {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    }
}


function interacciones_pdo(?PDO $pdo = null): PDO
{
    return $pdo ?? db();
}


function interacciones_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = interacciones_pdo($pdo);
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    // REL: puente idempotente (no DROP). Se mantiene activo para no romper media_/schema.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_eventos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(100) NOT NULL,
            wa_id VARCHAR(32) NOT NULL,
            direction VARCHAR(16) NOT NULL,
            body MEDIUMTEXT NOT NULL,
            ts_utc DATETIME NOT NULL,
            patient_name VARCHAR(120) NOT NULL DEFAULT \'\',
            source VARCHAR(24) NOT NULL DEFAULT \'\',
            exec_id VARCHAR(32) NULL,
            media_id VARCHAR(128) NULL,
            media_type VARCHAR(32) NULL,
            media_mime VARCHAR(100) NULL,
            media_filename VARCHAR(255) NULL,
            received_at DATETIME NOT NULL,
            UNIQUE KEY uq_event_key (event_key),
            KEY idx_wa_ts (wa_id, ts_utc),
            KEY idx_ts (ts_utc)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM interaccion_eventos LIKE 'media_id'");
        if ($cols && !$cols->fetchColumn()) {
            $pdo->exec(
                'ALTER TABLE interaccion_eventos
                 ADD COLUMN media_id VARCHAR(128) NULL AFTER exec_id,
                 ADD COLUMN media_type VARCHAR(32) NULL AFTER media_id,
                 ADD COLUMN media_mime VARCHAR(100) NULL AFTER media_type,
                 ADD COLUMN media_filename VARCHAR(255) NULL AFTER media_mime'
            );
        }
    } catch (Throwable $e) {
    }
    // REL: puente columna paciente_id (mig 002). Retirar tras etapa 10.
    try {
        require_once __DIR__ . '/lib_migrations.php';
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_eventos',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
    } catch (Throwable $e) {
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_estado (
            conversation_key VARCHAR(64) NOT NULL PRIMARY KEY,
            legacy_id VARCHAR(64) NULL,
            answered TINYINT(1) NOT NULL DEFAULT 0,
            answered_at DATETIME NULL,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            archived_at DATETIME NULL,
            category VARCHAR(40) NULL,
            category_label VARCHAR(80) NULL,
            summary VARCHAR(255) NULL,
            patient_name VARCHAR(120) NULL,
            updated_at DATETIME NOT NULL,
            updated_by VARCHAR(60) NOT NULL DEFAULT \'\',
            KEY idx_legacy (legacy_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    // REL: puente estado.paciente_id / wa_id (mig 007).
    try {
        require_once __DIR__ . '/lib_migrations.php';
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'wa_id',
            'VARCHAR(32) NULL',
            'TEXT NULL'
        );
        // SLA: una sola alerta a Norberto por mensaje pendiente > 3 h.
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'sla_notified_at',
            'DATETIME NULL',
            'TEXT NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_estado',
            'sla_notified_event_key',
            'VARCHAR(100) NULL',
            'TEXT NULL'
        );
    } catch (Throwable $e) {
    }
    $done[$pdo] = true;
}

/** Epoch desde epoch numérico, ISO-8601 o 'Y-m-d H:i:s' (UTC si no trae zona). */

/** Epoch desde epoch numérico, ISO-8601 o 'Y-m-d H:i:s' (UTC si no trae zona). */
function interacciones_parse_ts($value, int $fallback): int
{
    if (is_int($value) || (is_string($value) && preg_match('/^\d{9,13}(\.\d+)?$/', $value))) {
        $n = (float) $value;
        return (int) ($n > 99999999999 ? $n / 1000 : $n);
    }
    if (is_string($value) && trim($value) !== '') {
        try {
            return (new DateTimeImmutable(trim($value), new DateTimeZone('UTC')))->getTimestamp();
        } catch (Throwable $e) {
        }
    }
    return $fallback;
}

/**
 * Normaliza wa_id a dígitos E.164-ish (fuente: clean_phone_number).
 * AR → 549…; extranjeros con CC se preservan.
 */

/**
 * Normaliza wa_id a dígitos E.164-ish (fuente: clean_phone_number).
 * AR → 549…; extranjeros con CC se preservan.
 */
function interacciones_clean_wa_id(string $raw): string
{
    if (str_starts_with($raw, 'ig_')) {
        return 'ig_' . (preg_replace('/[^A-Za-z0-9_.]/', '', substr($raw, 3)) ?? '');
    }
    if (!function_exists('clean_phone_number')) {
        $helpers = __DIR__ . '/pacientes_helpers.php';
        if (is_file($helpers)) {
            require_once $helpers;
        }
    }
    if (function_exists('clean_phone_number')) {
        $normalized = clean_phone_number($raw);
        if ($normalized !== '') {
            return $normalized;
        }
    }
    return preg_replace('/\D/', '', $raw) ?? '';
}

/**
 * Normaliza un evento entrante. Devuelve null si no es válido (nunca lanza).
 *
 * @return array{event_key:string,wa_id:string,direction:string,body:string,ts:int,patient_name:string,source:string,exec_id:?string}|null
 */
