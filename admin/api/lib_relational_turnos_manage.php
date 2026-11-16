<?php
declare(strict_types=1);

/**
 * Código de gestión web: apellido + email + código por turno.
 */

const KINESICA_MANAGE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KINESICA_MANAGE_CODE_LEN = 7;
const KINESICA_MANAGE_CANCEL_HOURS = 24;

function kinesica_rel_turnos_manage_ready(PDO $pdo): bool
{
    return kinesica_rel_turnos_ready($pdo)
        && kinesica_migrations_column_exists($pdo, 'turnos', 'manage_code_hash');
}

function kinesica_normalize_apellido(string $raw): string
{
    $s = trim(mb_strtolower($raw, 'UTF-8'));
    if ($s === '') {
        return '';
    }
    $map = [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
        'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
        'ñ' => 'n', 'ç' => 'c',
    ];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9\s\'\-]/u', '', $s) ?? '';
    $s = preg_replace('/\s+/u', ' ', $s) ?? '';
    return trim($s);
}

/** Apellido = todo lo que sigue al primer nombre (misma regla que send-confirmation). */
function kinesica_apellido_from_full_name(string $fullName): string
{
    $full = trim(preg_replace('/\s+/u', ' ', $fullName) ?? '');
    if ($full === '') {
        return '';
    }
    $parts = preg_split('/\s+/u', $full, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    return trim((string) ($parts[1] ?? $parts[0] ?? ''));
}

function kinesica_apellido_matches(string $inputNorm, string $storedNorm): bool
{
    if ($inputNorm === '' || $storedNorm === '') {
        return false;
    }
    if (hash_equals($storedNorm, $inputNorm)) {
        return true;
    }
    // "Pérez" contra "Carlos Pérez"
    if (str_ends_with($storedNorm, ' ' . $inputNorm)) {
        return true;
    }
    $tokens = preg_split('/\s+/u', $storedNorm, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $last = (string) end($tokens);
    return $last !== '' && hash_equals($last, $inputNorm);
}

function kinesica_generate_manage_code(): string
{
    $alphabet = KINESICA_MANAGE_CODE_ALPHABET;
    $max = strlen($alphabet) - 1;
    $out = '';
    for ($i = 0; $i < KINESICA_MANAGE_CODE_LEN; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

function kinesica_hash_manage_code(string $code): string
{
    return hash('sha256', strtoupper(trim($code)));
}

/**
 * Adjunta email/apellido/código a un turno (por calendar_event_id).
 * Un solo código por evento: si ya hay hash, no regenera (idempotente).
 * Crea fila sombra mínima si aún no existe.
 *
 * @return array{ok:bool,turno_id:?int,code:?string,reused?:bool,reason?:string}
 */
function kinesica_rel_attach_manage_code(
    PDO $pdo,
    string $calendarEventId,
    string $email,
    string $fullName,
    ?string $plainCode = null,
    array $extra = []
): array {
    if (!kinesica_rel_turnos_manage_ready($pdo)) {
        return ['ok' => false, 'turno_id' => null, 'code' => null, 'reason' => 'manage_cols_missing'];
    }
    $calId = kinesica_rel_normalize_calendar_event_id($calendarEventId);
    $emailNorm = strtolower(trim($email));
    $apeNorm = kinesica_normalize_apellido(kinesica_apellido_from_full_name($fullName));
    if ($calId === '' || $emailNorm === '' || $apeNorm === '') {
        return ['ok' => false, 'turno_id' => null, 'code' => null, 'reason' => 'missing_fields'];
    }

    $upsert = [
        'calendar_event_id' => $calId,
        'patient_name_snapshot' => $fullName,
        'summary' => $fullName,
        'status' => 'scheduled',
        'source' => 'booking',
    ];
    if (!empty($extra['starts_at'])) {
        $upsert['starts_at'] = $extra['starts_at'];
    }
    if (!empty($extra['ends_at'])) {
        $upsert['ends_at'] = $extra['ends_at'];
    }
    if (!empty($extra['profesional_id'])) {
        $upsert['profesional_id'] = (int) $extra['profesional_id'];
    } elseif (!empty($extra['practitioner_id']) || !empty($extra['practitionerId'])) {
        $slug = strtolower(trim((string) ($extra['practitioner_id'] ?? $extra['practitionerId'] ?? '')));
        if ($slug !== '' && function_exists('kinesica_rel_fetch_profesional_by_slug')) {
            $prof = kinesica_rel_fetch_profesional_by_slug($pdo, $slug);
            if ($prof && !empty($prof['id'])) {
                $upsert['profesional_id'] = (int) $prof['id'];
            }
        }
    }
    if (!empty($extra['summary'])) {
        $upsert['summary'] = (string) $extra['summary'];
    }
    $tid = kinesica_rel_upsert_turno_by_calendar_event($pdo, $upsert);
    if ($tid === null) {
        return ['ok' => false, 'turno_id' => null, 'code' => null, 'reason' => 'upsert_failed'];
    }

    $hasPlainCol = kinesica_migrations_column_exists($pdo, 'turnos', 'manage_code');
    $selCols = 'manage_code_hash' . ($hasPlainCol ? ', manage_code' : '');
    $existing = $pdo->prepare("SELECT {$selCols} FROM turnos WHERE id = :id LIMIT 1");
    $existing->execute(['id' => $tid]);
    $row = $existing->fetch(PDO::FETCH_ASSOC) ?: [];
    $existingHash = trim((string) ($row['manage_code_hash'] ?? ''));
    $existingPlain = $hasPlainCol ? strtoupper(trim((string) ($row['manage_code'] ?? ''))) : '';

    // Ya tiene código: no regenerar. Devolver el plaintext si está guardado.
    if ($existingHash !== '' && ($plainCode === null || trim((string) $plainCode) === '')) {
        $updMeta = $pdo->prepare(
            'UPDATE turnos SET
                manage_email = :email,
                manage_apellido_norm = :ape,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $updMeta->execute([
            'email' => mb_substr($emailNorm, 0, 120, 'UTF-8'),
            'ape' => mb_substr($apeNorm, 0, 80, 'UTF-8'),
            'id' => $tid,
        ]);
        return [
            'ok' => true,
            'turno_id' => $tid,
            'code' => $existingPlain !== '' ? $existingPlain : null,
            'reused' => true,
        ];
    }

    $code = $plainCode !== null && trim($plainCode) !== ''
        ? strtoupper(trim($plainCode))
        : kinesica_generate_manage_code();
    $hash = kinesica_hash_manage_code($code);

    if ($hasPlainCol) {
        $stmt = $pdo->prepare(
            'UPDATE turnos SET
                manage_email = :email,
                manage_apellido_norm = :ape,
                manage_code_hash = :hash,
                manage_code = :code,
                manage_code_created_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'email' => mb_substr($emailNorm, 0, 120, 'UTF-8'),
            'ape' => mb_substr($apeNorm, 0, 80, 'UTF-8'),
            'hash' => $hash,
            'code' => $code,
            'id' => $tid,
        ]);
    } else {
        $stmt = $pdo->prepare(
            'UPDATE turnos SET
                manage_email = :email,
                manage_apellido_norm = :ape,
                manage_code_hash = :hash,
                manage_code_created_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'email' => mb_substr($emailNorm, 0, 120, 'UTF-8'),
            'ape' => mb_substr($apeNorm, 0, 80, 'UTF-8'),
            'hash' => $hash,
            'id' => $tid,
        ]);
    }

    return ['ok' => true, 'turno_id' => $tid, 'code' => $code, 'reused' => false];
}

/**
 * Busca turno futuro/vigente por email + apellido + código.
 *
 * @return array{ok:bool,turno?:array<string,mixed>,reason?:string}
 */
function kinesica_rel_lookup_turno_by_manage(PDO $pdo, string $email, string $apellido, string $code): array
{
    if (!kinesica_rel_turnos_manage_ready($pdo)) {
        return ['ok' => false, 'reason' => 'manage_cols_missing'];
    }
    $emailNorm = strtolower(trim($email));
    $apeNorm = kinesica_normalize_apellido($apellido);
    $hash = kinesica_hash_manage_code($code);
    if ($emailNorm === '' || $apeNorm === '' || trim($code) === '') {
        return ['ok' => false, 'reason' => 'missing_fields'];
    }

    $stmt = $pdo->prepare(
        'SELECT id, calendar_event_id, starts_at, ends_at, status, summary,
                patient_name_snapshot, profesional_id, manage_email, manage_apellido_norm
         FROM turnos
         WHERE manage_email = :email
           AND manage_code_hash = :hash
           AND status = \'scheduled\'
         ORDER BY starts_at ASC
         LIMIT 5'
    );
    $stmt->execute(['email' => $emailNorm, 'hash' => $hash]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($rows as $row) {
        $storedApe = (string) ($row['manage_apellido_norm'] ?? '');
        if (!kinesica_apellido_matches($apeNorm, $storedApe)) {
            continue;
        }
        return ['ok' => true, 'turno' => $row];
    }
    return ['ok' => false, 'reason' => 'not_found'];
}

/**
 * ¿Se puede anular según política de anticipación (default 24 hs)?
 *
 * @param array<string,mixed> $turno
 * @return array{allowed:bool,reason?:string,hours_left?:float}
 */
function kinesica_rel_manage_cancel_allowed(array $turno, int $minHours = KINESICA_MANAGE_CANCEL_HOURS): array
{
    $starts = trim((string) ($turno['starts_at'] ?? ''));
    if ($starts === '') {
        return ['allowed' => true];
    }
    $ts = strtotime($starts);
    if ($ts === false) {
        return ['allowed' => true];
    }
    $hoursLeft = ($ts - time()) / 3600;
    if ($hoursLeft < $minHours) {
        return [
            'allowed' => false,
            'reason' => 'within_policy_window',
            'hours_left' => round($hoursLeft, 1),
        ];
    }
    return ['allowed' => true, 'hours_left' => round($hoursLeft, 1)];
}
