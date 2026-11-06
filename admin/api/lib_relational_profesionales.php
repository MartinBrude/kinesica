<?php
declare(strict_types=1);

/**
 * Profesionales canónicos + backfill de profesional_id.
 */

require_once __DIR__ . '/lib_migrations.php';
require_once __DIR__ . '/lib_relational_flags.php';

function kinesica_rel_profesionales_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'profesionales');
}

/**
 * @return array{id:int,slug:string,username:?string,display_name:string,active:bool}|null
 */
function kinesica_rel_fetch_profesional_by_slug(PDO $pdo, string $slug): ?array
{
    $slug = strtolower(trim($slug));
    if ($slug === '' || $slug === 'indistinto' || !kinesica_rel_profesionales_ready($pdo)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT id, slug, username, display_name, active FROM profesionales
         WHERE (slug = :s OR username = :u) AND deleted_at IS NULL LIMIT 1'
    );
    $stmt->execute(['s' => $slug, 'u' => $slug]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'username' => $row['username'] !== null ? (string) $row['username'] : null,
        'display_name' => (string) $row['display_name'],
        'active' => (int) ($row['active'] ?? 1) === 1,
    ];
}

/**
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */
function kinesica_rel_backfill_profesional_ids(PDO $pdo, bool $apply, string $table): array
{
    $stats = [
        'table' => $table . '.profesional_id',
        'scanned' => 0,
        'already_set' => 0,
        'updated' => 0,
        'matched' => 0,
        'unmatched' => 0,
        'skipped_no_column' => false,
        'samples' => [],
    ];
    if (!kinesica_migrations_table_exists($pdo, $table)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_migrations_column_exists($pdo, $table, 'profesional_id')) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }
    if (!kinesica_rel_profesionales_ready($pdo)) {
        $stats['skipped_no_column'] = true;
        return $stats;
    }

    $slugCol = $table === 'lista_espera' ? 'profesional' : 'profesional';
    $idCol = 'id';
    $rows = $pdo->query("SELECT {$idCol}, {$slugCol} AS slug, profesional_id FROM {$table}")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $upd = $apply
        ? $pdo->prepare("UPDATE {$table} SET profesional_id = :pid WHERE {$idCol} = :id AND profesional_id IS NULL")
        : null;

    foreach ($rows as $row) {
        $stats['scanned']++;
        if ($row['profesional_id'] !== null && $row['profesional_id'] !== '') {
            $stats['already_set']++;
            continue;
        }
        $slug = strtolower(trim((string) ($row['slug'] ?? '')));
        $prof = kinesica_rel_fetch_profesional_by_slug($pdo, $slug);
        if ($prof === null) {
            $stats['unmatched']++;
            if (count($stats['samples']) < 25) {
                $stats['samples'][] = ['id' => $row['id'], 'slug' => $slug, 'status' => 'unmatched'];
            }
            continue;
        }
        $stats['matched']++;
        if ($apply && $upd) {
            $upd->execute(['pid' => $prof['id'], 'id' => $row['id']]);
            $stats['updated'] += $upd->rowCount() > 0 ? 1 : 0;
        }
        if (count($stats['samples']) < 25) {
            $stats['samples'][] = [
                'id' => $row['id'],
                'slug' => $slug,
                'status' => 'matched',
                'profesional_id' => $prof['id'],
            ];
        }
    }

    return $stats;
}

function kinesica_rel_backfill_fichas_profesional_id(PDO $pdo, bool $apply): array
{
    return kinesica_rel_backfill_profesional_ids($pdo, $apply, 'fichas');
}

function kinesica_rel_backfill_lista_profesional_id(PDO $pdo, bool $apply): array
{
    return kinesica_rel_backfill_profesional_ids($pdo, $apply, 'lista_espera');
}
