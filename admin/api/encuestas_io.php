<?php
declare(strict_types=1);

/**
 * Persistencia de encuestas (etapa 7).
 *
 * - MariaDB `encuestas` (mig 008): fuente durable (sobrevive deploys que pisan data/*).
 * - JSON (`data/encuestas.json` o seed): espejo + fallback.
 * - append público: DB primero + espejo JSON; no borra otras filas de DB.
 * - save admin: JSON + espejo completo (incluye deletes).
 *
 * Causa histórica de “mail sí / panel no”:
 * 1) El append público cargaba lib.php → side-effects; el espejo DB fallaba en silencio.
 * 2) Solo quedaba JSON en data/, y un hosting_deploy sin ese archivo lo borraba.
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/etapa7-whatsapp-encuestas.md
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

/**
 * PDO sin cargar lib.php (evita auth/whatsapp/handler admin en el form público).
 */
function kinesica_encuestas_pdo(): ?PDO
{
    try {
        if (function_exists('db')) {
            return db();
        }
        if (!defined('KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER')) {
            define('KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER', true);
        }
        require_once __DIR__ . '/lib_db.php';
        return db();
    } catch (Throwable $e) {
        error_log('kinesica encuestas pdo: ' . $e->getMessage());
        return null;
    }
}

/**
 * Une DB + JSON por id (gana el más reciente por created_at).
 *
 * @param list<array<string,mixed>> $a
 * @param list<array<string,mixed>> $b
 * @return list<array<string,mixed>>
 */
function kinesica_encuestas_merge_by_id(array $a, array $b): array
{
    $map = [];
    foreach (array_merge($a, $b) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            continue;
        }
        if (!isset($map[$id])) {
            $map[$id] = $item;
            continue;
        }
        $prev = (string) ($map[$id]['created_at'] ?? '');
        $next = (string) ($item['created_at'] ?? '');
        if ($next > $prev) {
            $map[$id] = $item;
        }
    }
    $out = array_values($map);
    usort($out, static function (array $x, array $y): int {
        return strcmp((string) ($y['created_at'] ?? ''), (string) ($x['created_at'] ?? ''));
    });
    return $out;
}

function kinesica_encuestas_load(): array
{
    $fromJson = kinesica_encuestas_load_json_only();
    $pdo = kinesica_encuestas_pdo();
    if ($pdo instanceof PDO) {
        try {
            require_once __DIR__ . '/lib_relational_encuestas.php';
            if (kinesica_rel_encuestas_ready($pdo)) {
                $fromDb = kinesica_rel_encuestas_load_db($pdo);
                if ($fromDb !== [] || $fromJson !== []) {
                    return kinesica_encuestas_merge_by_id($fromDb, $fromJson);
                }
            }
        } catch (Throwable $e) {
            error_log('kinesica encuestas load db: ' . $e->getMessage());
        }
    }
    return $fromJson;
}

function kinesica_encuestas_save_json(array $encuestas): void
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
}

/**
 * Espejo completo → DB (incluye deletes). Solo para save admin.
 */
function kinesica_encuestas_mirror_db_full(array $encuestas): void
{
    $pdo = kinesica_encuestas_pdo();
    if (!$pdo instanceof PDO) {
        error_log('kinesica encuestas save db mirror: PDO no disponible');
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

/** Upsert de una sola encuesta en DB. No borra otras filas. */
function kinesica_encuestas_mirror_db_one(array $encuesta): bool
{
    $pdo = kinesica_encuestas_pdo();
    if (!$pdo instanceof PDO) {
        error_log('kinesica encuestas append db: PDO no disponible');
        return false;
    }
    try {
        require_once __DIR__ . '/lib_relational_encuestas.php';
        if (!kinesica_rel_encuestas_ready($pdo)) {
            error_log('kinesica encuestas append db: tabla no lista');
            return false;
        }
        return kinesica_rel_encuesta_upsert($pdo, $encuesta);
    } catch (Throwable $e) {
        error_log('kinesica encuestas append db: ' . $e->getMessage());
        return false;
    }
}

function kinesica_encuestas_save(array $encuestas): void
{
    kinesica_encuestas_save_json($encuestas);
    kinesica_encuestas_mirror_db_full($encuestas);
}

/**
 * Append público: DB primero (durable), JSON espejo.
 * Éxito si al menos uno de los dos persiste.
 *
 * @param array<string,mixed> $encuesta
 */
function kinesica_encuestas_append(array $encuesta): void
{
    $dbOk = kinesica_encuestas_mirror_db_one($encuesta);

    $jsonOk = false;
    try {
        // Si DB OK, merge para no pisar filas solo-DB al reescribir JSON.
        $lista = $dbOk ? kinesica_encuestas_load() : kinesica_encuestas_load_json_only();
        $newId = (string) ($encuesta['id'] ?? '');
        if ($newId !== '') {
            $lista = array_values(array_filter(
                $lista,
                static fn (array $e): bool => (string) ($e['id'] ?? '') !== $newId
            ));
        }
        array_unshift($lista, $encuesta);
        kinesica_encuestas_save_json($lista);
        $jsonOk = true;
    } catch (Throwable $e) {
        error_log('kinesica encuestas append json: ' . $e->getMessage());
    }

    if (!$dbOk && !$jsonOk) {
        throw new RuntimeException('No se pudo persistir la encuesta (DB y JSON fallaron).');
    }
    if (!$dbOk) {
        error_log('kinesica encuestas append: persistido solo en JSON (revisar PDO/DB en form público)');
    }
}
