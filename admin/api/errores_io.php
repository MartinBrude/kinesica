<?php
declare(strict_types=1);

/**
 * Persistencia de Reporte de Errores (dual-write MariaDB + JSON).
 *
 * - MariaDB `errores` (mig 015): primario si tiene filas.
 * - JSON (`data/errores.json` o seed): espejo + fallback pre-migrate.
 * - save: dual-write best-effort (JSON primero; DB no bloquea al admin).
 */

function kinesica_errores_runtime_file(): string
{
    return __DIR__ . '/data/errores.json';
}

function kinesica_errores_seed_file(): string
{
    return __DIR__ . '/errores.json';
}

function kinesica_errores_source_file(): string
{
    $runtime = kinesica_errores_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_errores_seed_file();
}

/** Solo JSON (backfill / espejo). */
function kinesica_errores_load_json_only(): array
{
    $file = kinesica_errores_source_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kinesica_errores_pdo(): ?PDO
{
    try {
        if (function_exists('db')) {
            return db();
        }
        require_once __DIR__ . '/lib.php';
        return db();
    } catch (Throwable) {
        return null;
    }
}

function kinesica_errores_load(): array
{
    $pdo = kinesica_errores_pdo();
    if ($pdo instanceof PDO) {
        try {
            require_once __DIR__ . '/lib_relational_errores.php';
            if (kinesica_rel_errores_ready($pdo)) {
                $fromDb = kinesica_rel_errores_load_db($pdo);
                if ($fromDb !== []) {
                    return $fromDb;
                }
                // Si la tabla existe pero está vacía, auto-seed desde JSON
                $fromBackup = kinesica_errores_load_json_only();
                if ($fromBackup !== []) {
                    foreach ($fromBackup as $errItem) {
                        if (is_array($errItem)) {
                            kinesica_rel_error_upsert($pdo, $errItem, 'auto-seed');
                        }
                    }
                    return $fromBackup;
                }
            }
        } catch (Throwable $e) {
            error_log('kinesica errores load db: ' . $e->getMessage());
        }
    }
    return kinesica_errores_load_json_only();
}

function kinesica_errores_save(array $errores, string $actor = ''): void
{
    $runtime = kinesica_errores_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.errores.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de errores.');
    }
    try {
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode(array_values($errores), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la lista de errores.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    // REL: espejo MariaDB (best-effort).
    $pdo = kinesica_errores_pdo();
    if (!$pdo instanceof PDO) {
        return;
    }
    try {
        require_once __DIR__ . '/lib_relational_errores.php';
        if (!kinesica_rel_errores_ready($pdo)) {
            return;
        }
        $ids = [];
        foreach ($errores as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $ids[$id] = true;
            kinesica_rel_error_upsert($pdo, $item, $actor);
        }
        $existing = $pdo->query('SELECT id FROM errores')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        foreach ($existing as $eid) {
            $eid = (string) $eid;
            if (!isset($ids[$eid])) {
                kinesica_rel_error_delete($pdo, $eid, $actor);
            }
        }
    } catch (Throwable $e) {
        error_log('kinesica errores save db mirror: ' . $e->getMessage());
    }
}
