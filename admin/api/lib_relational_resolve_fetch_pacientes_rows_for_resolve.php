<?php
declare(strict_types=1);


/**
 * @return list<array<string,mixed>>
 */
/**
 * Columnas base + opcionales. Solo filas activas (sin soft-delete).
 *
 * @return list<array<string,mixed>>
 */
function kinesica_rel_fetch_pacientes_rows_for_resolve(PDO $pdo): array
{
    $cols = ['id', 'telefono', 'nombre_completo'];
    if (kinesica_migrations_column_exists($pdo, 'pacientes', 'dni')) {
        $cols[] = 'dni';
    }
    $hasDeletedAt = kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at');
    if ($hasDeletedAt) {
        $cols[] = 'deleted_at';
    }
    $sql = 'SELECT ' . implode(', ', $cols) . ' FROM pacientes';
    if ($hasDeletedAt) {
        $sql .= ' WHERE deleted_at IS NULL';
    }
    return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/**
 * @return list<array<string,mixed>>
 */

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_phone(PDO $pdo, string $normPhone): array
{
    $rows = kinesica_rel_fetch_pacientes_rows_for_resolve($pdo);
    $out = [];
    foreach ($rows as $row) {
        if (kinesica_rel_paciente_row_is_deleted($row)) {
            continue;
        }
        $raw = (string) ($row['telefono'] ?? '');
        if (is_placeholder_phone($raw)) {
            continue;
        }
        $n = clean_phone_number($raw);
        if ($n === $normPhone) {
            $out[] = $row;
            continue;
        }
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits !== '' && ($digits === $normPhone || clean_phone_number($digits) === $normPhone)) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_dni(PDO $pdo, string $dni): array
{
    $rows = kinesica_rel_fetch_pacientes_rows_for_resolve($pdo);
    $out = [];
    foreach ($rows as $row) {
        if (kinesica_rel_paciente_row_is_deleted($row)) {
            continue;
        }
        if (clean_patient_dni($row['dni'] ?? null) === $dni) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_name_key(PDO $pdo, string $nameKey): array
{
    $rows = kinesica_rel_fetch_pacientes_rows_for_resolve($pdo);
    $out = [];
    foreach ($rows as $row) {
        if (kinesica_rel_paciente_row_is_deleted($row)) {
            continue;
        }
        if (canonical_patient_name_key((string) ($row['nombre_completo'] ?? '')) === $nameKey) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * @param array{ignore_flag?:bool} $opts
 */

/**
 * @param array{ignore_flag?:bool} $opts
 */
function kinesica_rel_resolve_profesional_id(PDO $pdo, string $usernameOrSlug, array $opts = []): ?int
{
    $ignoreFlag = !empty($opts['ignore_flag']);
    if (!$ignoreFlag && !kinesica_rel_write_ids()) {
        return null;
    }
    require_once __DIR__ . '/lib_relational_profesionales.php';
    $prof = kinesica_rel_fetch_profesional_by_slug($pdo, $usernameOrSlug);
    return $prof !== null ? $prof['id'] : null;
}


function kinesica_rel_unlinked_log_path(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir . '/rel_unlinked.jsonl';
}

/**
 * Registra un write sin paciente_id (métrica diaria / etapa 3).
 * No guarda PII completa: solo contexto, reason y hashes cortos.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */

/**
 * Registra un write sin paciente_id (métrica diaria / etapa 3).
 * No guarda PII completa: solo contexto, reason y hashes cortos.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */
function kinesica_rel_note_unlinked(string $source, string $status, string $reason, array $hints = []): void
{
    $phone = (string) ($hints['phone'] ?? $hints['wa_id'] ?? '');
    $dni = (string) ($hints['dni'] ?? '');
    $entry = [
        'ts' => gmdate('c'),
        'source' => $source,
        'status' => $status,
        'reason' => $reason,
        'phone_suffix' => $phone !== '' ? substr(preg_replace('/\D+/', '', $phone) ?? '', -4) : '',
        'dni_suffix' => $dni !== '' ? substr(preg_replace('/\D+/', '', $dni) ?? '', -3) : '',
        'name_key' => canonical_patient_name_key((string) ($hints['nombre'] ?? '')),
    ];
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    if ($line === false) {
        return;
    }
    @file_put_contents(kinesica_rel_unlinked_log_path(), $line . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * Resuelve y, si no hay ID, anota métrica. Atajo para writers.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */

/**
 * Resuelve y, si no hay ID, anota métrica. Atajo para writers.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */
function kinesica_rel_resolve_paciente_id_or_note(PDO $pdo, string $source, array $hints): ?int
{
    $res = kinesica_rel_resolve_paciente($pdo, $hints);
    if ($res['paciente_id'] !== null) {
        return $res['paciente_id'];
    }
    if ($res['status'] !== 'disabled') {
        kinesica_rel_note_unlinked($source, $res['status'], $res['reason'], $hints);
    }
    return null;
}
