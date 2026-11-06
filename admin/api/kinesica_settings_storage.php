<?php
declare(strict_types=1);

/**
 * Persistencia de settings operativos (JSON + overlay MariaDB, etapa 8).
 *
 * - Seed: `settings.json` · Runtime: `data/settings.json` (gitignored).
 * - Lectura efectiva: `kinesica_settings_load()` = JSON + overlay `configuraciones`
 *   (claves allowlisted; DB gana). `kinesica_settings_raw()` = solo archivo.
 * - Escritura: lock + tmp/rename; luego espejo best-effort a `configuraciones`
 *   + `auditoria_cambios` (lib_relational_config.php).
 * - Secrets / tokens de config.php **no** se espejan (allowlist estricta).
 *
 * Docs: docs/etapa8-config-gastos.md · docs/codigo-datos-relacionales.md
 */

function kinesica_settings_runtime_file(): string
{
    return __DIR__ . '/data/settings.json';
}

function kinesica_settings_seed_file(): string
{
    return __DIR__ . '/settings.json';
}

function kinesica_settings_source_file(): string
{
    $runtime = kinesica_settings_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_settings_seed_file();
}

/**
 * Solo JSON (sin overlay DB). Usar para mutate bajo lock / backfill.
 */
function kinesica_settings_raw(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kinesica_settings_pdo(): ?PDO
{
    try {
        if (function_exists('db')) {
            return db();
        }
        // Evitar tirar lib.php si aún no hay bootstrap (CLI tests / flags).
        if (!is_file(__DIR__ . '/lib.php')) {
            return null;
        }
        require_once __DIR__ . '/lib.php';
        return db();
    } catch (Throwable) {
        return null;
    }
}

/**
 * Settings con overlay de configuraciones (etapa 8). DB gana por clave allowlisted.
 *
 * @return array<string,mixed>
 */
function kinesica_settings_load(): array
{
    $data = kinesica_settings_raw(kinesica_settings_source_file());
    $pdo = kinesica_settings_pdo();
    if (!$pdo instanceof PDO) {
        return $data;
    }
    try {
        require_once __DIR__ . '/lib_relational_config.php';
        return kinesica_rel_config_overlay_settings($pdo, $data);
    } catch (Throwable $e) {
        error_log('kinesica settings overlay: ' . $e->getMessage());
        return $data;
    }
}

final class KinesicaSettingsConflict extends RuntimeException
{
}

/**
 * Lee-modifica-escribe bajo lock exclusivo con escritura atómica (tmp + rename).
 * Tras guardar JSON, espeja claves allowlisted a MariaDB (best-effort).
 */
function kinesica_update_settings(callable $mutate, string $actor = ''): array
{
    $runtime = kinesica_settings_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.settings.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear la configuración.');
    }
    $next = null;
    try {
        // Mutate sobre JSON (+ overlay) para que conflict checks vean la fuente de lectura.
        $current = kinesica_settings_load();
        $next = $mutate($current);
        if (!is_array($next)) {
            throw new RuntimeException('La mutación de settings no devolvió un array.');
        }
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la configuración.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    // REL: espejo configuraciones (best-effort; no bloquea el save JSON).
    if (is_array($next)) {
        $pdo = kinesica_settings_pdo();
        if ($pdo instanceof PDO) {
            try {
                require_once __DIR__ . '/lib_relational_config.php';
                kinesica_rel_config_mirror_settings($pdo, $next, $actor);
            } catch (Throwable $e) {
                error_log('kinesica settings db mirror: ' . $e->getMessage());
            }
        }
    }

    return is_array($next) ? $next : [];
}
