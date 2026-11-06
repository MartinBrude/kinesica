<?php
declare(strict_types=1);

/**
 * Persistencia de encuestas (etapa 7).
 *
 * - MariaDB `encuestas` (mig 008): primario si tiene filas.
 * - JSON (`data/encuestas.json` o seed): espejo + fallback pre-migrate.
 * - append/save: dual-write best-effort (JSON primero; DB no bloquea al público).
 *
 * Formulario público sigue anónimo (paciente_id casi siempre NULL).
 * Docs: docs/codigo-datos-relacionales.md
 */

function kinesica_encuestas_runtime_file(): string
{
    return __DIR__ . '/data/encuestas.json';
}

function kinesica_encuestas_seed_file(): string
{
    return __DIR__ . '/encuestas.json';
}

function kinesica_encuestas_source_file(): string
{
    $runtime = kinesica_encuestas_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_encuestas_seed_file();
}

/** Solo JSON (backfill / espejo). */
function kinesica_encuestas_load_json_only(): array
{
    $file = kinesica_encuestas_source_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kinesica_encuestas_pdo(): ?PDO
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

function kinesica_encuestas_load(): array
{
    $pdo = kinesica_encuestas_pdo();
    if ($pdo instanceof PDO) {
        try {
            require_once __DIR__ . '/lib_relational_encuestas.php';
            if (kinesica_rel_encuestas_ready($pdo)) {
                $fromDb = kinesica_rel_encuestas_load_db($pdo);
                if ($fromDb !== []) {
                    return $fromDb;
                }
            }
        } catch (Throwable $e) {
            error_log('kinesica encuestas load db: ' . $e->getMessage());
        }
    }
    return kinesica_encuestas_load_json_only();
}

function kinesica_encuestas_save(array $encuestas): void
{
    $runtime = kinesica_encuestas_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.encuestas.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de encuestas.');
    }
    try {
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode(array_values($encuestas), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la lista de encuestas.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    // REL: espejo MariaDB (best-effort).
    $pdo = kinesica_encuestas_pdo();
    if (!$pdo instanceof PDO) {
        return;
    }
    try {
        require_once __DIR__ . '/lib_relational_encuestas.php';
        if (!kinesica_rel_encuestas_ready($pdo)) {
            return;
        }
        $ids = [];
        foreach ($encuestas as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $ids[$id] = true;
            kinesica_rel_encuesta_upsert($pdo, $item);
        }
        // Borrar de DB lo que ya no está en la lista JSON (delete vía save filtrado).
        $existing = $pdo->query('SELECT id FROM encuestas')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        foreach ($existing as $eid) {
            $eid = (string) $eid;
            if (!isset($ids[$eid])) {
                kinesica_rel_encuesta_delete($pdo, $eid);
            }
        }
    } catch (Throwable $e) {
        error_log('kinesica encuestas save db mirror: ' . $e->getMessage());
    }
}

/**
 * Append atómico de una encuesta (JSON + DB).
 *
 * @param array<string,mixed> $encuesta
 */
function kinesica_encuestas_append(array $encuesta): void
{
    $lista = kinesica_encuestas_load_json_only();
    array_unshift($lista, $encuesta);
    kinesica_encuestas_save($lista);
}
