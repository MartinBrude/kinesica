<?php
declare(strict_types=1);

/**
 * Encuestas relacionales (etapa 7) — dual-write con JSON.
 *
 * Tabla: migrations/008_encuestas.php
 * IO: encuestas_io.php (load DB-first si hay filas; save/append espeja JSON+DB).
 * paciente_id opcional (form público anónimo → casi siempre NULL).
 * Backfill CLI: --only=encuestas
 *
 * Docs: docs/etapa7-whatsapp-encuestas.md · docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

function kinesica_rel_encuestas_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'encuestas');
}

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */
function kinesica_rel_encuesta_normalize_row(array $row): array
{
    return [
        'id' => (string) ($row['id'] ?? ''),
        'experiencia' => (int) ($row['experiencia'] ?? 0),
        'tratamiento_resultado' => (string) ($row['tratamiento_resultado'] ?? ''),
        'tratamiento_label' => (string) ($row['tratamiento_label'] ?? ''),
        'recomendaria' => (string) ($row['recomendaria'] ?? ''),
        'recomendaria_label' => (string) ($row['recomendaria_label'] ?? ''),
        'comentarios' => (string) ($row['comentarios'] ?? ''),
        'lang' => (string) ($row['lang'] ?? 'es'),
        'paciente_id' => isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
            ? (int) $row['paciente_id']
            : null,
        'created_at' => (string) ($row['created_at'] ?? ''),
    ];
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_encuestas_load_db(PDO $pdo): array
{
    if (!kinesica_rel_encuestas_ready($pdo)) {
        return [];
    }
    $rows = $pdo->query(
        'SELECT id, experiencia, tratamiento_resultado, tratamiento_label,
                recomendaria, recomendaria_label, comentarios, lang, paciente_id, created_at
         FROM encuestas
         ORDER BY created_at DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $out = [];
    foreach ($rows as $row) {
        $n = kinesica_rel_encuesta_normalize_row($row);
        if ($n['id'] !== '') {
            $out[] = $n;
        }
    }
    return $out;
}

/**
 * @param array<string,mixed> $encuesta
 */
function kinesica_rel_encuesta_upsert(PDO $pdo, array $encuesta): bool
{
    if (!kinesica_rel_encuestas_ready($pdo)) {
        return false;
    }
    $n = kinesica_rel_encuesta_normalize_row($encuesta);
    if ($n['id'] === '') {
        return false;
    }
    $created = $n['created_at'];
    if ($created === '') {
        $created = gmdate('Y-m-d H:i:s');
    } else {
        // ISO → DATETIME
        $created = str_replace('T', ' ', rtrim($created, 'Z'));
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $created)) {
            $created .= ' 00:00:00';
        }
        if (strlen($created) === 16) {
            $created .= ':00';
        }
    }

    if (kinesica_migrations_is_sqlite($pdo)) {
        $pdo->prepare(
            'INSERT OR REPLACE INTO encuestas (
                id, experiencia, tratamiento_resultado, tratamiento_label,
                recomendaria, recomendaria_label, comentarios, lang, paciente_id, created_at
             ) VALUES (
                :id, :exp, :trat, :trat_l, :rec, :rec_l, :com, :lang, :pid, :created
             )'
        )->execute([
            'id' => $n['id'],
            'exp' => $n['experiencia'],
            'trat' => $n['tratamiento_resultado'],
            'trat_l' => $n['tratamiento_label'],
            'rec' => $n['recomendaria'],
            'rec_l' => $n['recomendaria_label'],
            'com' => $n['comentarios'],
            'lang' => $n['lang'],
            'pid' => $n['paciente_id'],
            'created' => $created,
        ]);
        return true;
    }

    $pdo->prepare(
        'INSERT INTO encuestas (
            id, experiencia, tratamiento_resultado, tratamiento_label,
            recomendaria, recomendaria_label, comentarios, lang, paciente_id, created_at
         ) VALUES (
            :id, :exp, :trat, :trat_l, :rec, :rec_l, :com, :lang, :pid, :created
         )
         ON DUPLICATE KEY UPDATE
            experiencia = VALUES(experiencia),
            tratamiento_resultado = VALUES(tratamiento_resultado),
            tratamiento_label = VALUES(tratamiento_label),
            recomendaria = VALUES(recomendaria),
            recomendaria_label = VALUES(recomendaria_label),
            comentarios = VALUES(comentarios),
            lang = VALUES(lang),
            paciente_id = COALESCE(VALUES(paciente_id), paciente_id)'
    )->execute([
        'id' => $n['id'],
        'exp' => $n['experiencia'],
        'trat' => $n['tratamiento_resultado'],
        'trat_l' => $n['tratamiento_label'],
        'rec' => $n['recomendaria'],
        'rec_l' => $n['recomendaria_label'],
        'com' => $n['comentarios'],
        'lang' => $n['lang'],
        'pid' => $n['paciente_id'],
        'created' => $created,
    ]);
    return true;
}

function kinesica_rel_encuesta_delete(PDO $pdo, string $id): bool
{
    if (!kinesica_rel_encuestas_ready($pdo) || $id === '') {
        return false;
    }
    $stmt = $pdo->prepare('DELETE FROM encuestas WHERE id = :id');
    $stmt->execute(['id' => $id]);
    return $stmt->rowCount() > 0;
}

/**
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_encuestas(PDO $pdo, bool $apply): array
{
    $stats = [
        'table' => 'encuestas',
        'scanned' => 0,
        'already_set' => 0,
        'updated' => 0,
        'matched' => 0,
        'unmatched' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
    if (!kinesica_rel_encuestas_ready($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    require_once __DIR__ . '/encuestas_io.php';
    $lista = kinesica_encuestas_load_json_only();
    $find = $pdo->prepare('SELECT 1 FROM encuestas WHERE id = :id LIMIT 1');
    foreach ($lista as $item) {
        if (!is_array($item)) {
            continue;
        }
        $stats['scanned']++;
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            $stats['unmatched']++;
            continue;
        }
        $find->execute(['id' => $id]);
        if ($find->fetchColumn()) {
            $stats['already_set']++;
            continue;
        }
        $stats['matched']++;
        if ($apply) {
            if (kinesica_rel_encuesta_upsert($pdo, $item)) {
                $stats['updated']++;
            }
        }
        if (count($stats['samples']) < 25) {
            $stats['samples'][] = ['id' => $id, 'status' => 'matched'];
        }
    }
    return $stats;
}
