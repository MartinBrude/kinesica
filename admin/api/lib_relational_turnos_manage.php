<?php
declare(strict_types=1);

/**
 * Código de gestión web: apellido + email + código por turno.
 */

require_once __DIR__ . '/lib_relational_turnos_manage_helpers.php';

/**
 * Adjunta email/apellido/código a un turno (por calendar_event_id).
 * Si ya hay hash y no se pasa plaintext: idempotente (code null), salvo
 * `$extra['rotate_manage_code']` (p. ej. reintento de send-confirmation).
 * Crea fila sombra mínima si aún no existe. Nunca persiste plaintext.
 *
 * @return array{ok:bool,turno_id:?int,code:?string,reused?:bool,rotated?:bool,reason?:string}
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
    $existing = $pdo->prepare('SELECT manage_code_hash FROM turnos WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $tid]);
    $row = $existing->fetch(PDO::FETCH_ASSOC) ?: [];
    $existingHash = trim((string) ($row['manage_code_hash'] ?? ''));
    $plainEmpty = $plainCode === null || trim((string) $plainCode) === '';
    $rotate = !empty($extra['rotate_manage_code']);

    if ($existingHash !== '' && $plainEmpty && !$rotate) {
        $clearPlain = $hasPlainCol ? ', manage_code = NULL' : '';
        $updMeta = $pdo->prepare(
            "UPDATE turnos SET
                manage_email = :email,
                manage_apellido_norm = :ape
                {$clearPlain},
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id"
        );
        $updMeta->execute([
            'email' => mb_substr($emailNorm, 0, 120, 'UTF-8'),
            'ape' => mb_substr($apeNorm, 0, 80, 'UTF-8'),
            'id' => $tid,
        ]);
        return ['ok' => true, 'turno_id' => $tid, 'code' => null, 'reused' => true, 'rotated' => false];
    }

    $hadHash = $existingHash !== '';
    $code = !$plainEmpty ? strtoupper(trim((string) $plainCode)) : kinesica_generate_manage_code();
    $hash = kinesica_hash_manage_code($code);

    $clearPlain = $hasPlainCol ? ', manage_code = NULL' : '';
    $stmt = $pdo->prepare(
        "UPDATE turnos SET
            manage_email = :email,
            manage_apellido_norm = :ape,
            manage_code_hash = :hash
            {$clearPlain},
            manage_code_created_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = :id"
    );
    $stmt->execute([
        'email' => mb_substr($emailNorm, 0, 120, 'UTF-8'),
        'ape' => mb_substr($apeNorm, 0, 80, 'UTF-8'),
        'hash' => $hash,
        'id' => $tid,
    ]);

    return [
        'ok' => true,
        'turno_id' => $tid,
        'code' => $code,
        'reused' => false,
        'rotated' => $hadHash && $rotate && $plainEmpty,
    ];
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
        if (kinesica_apellido_matches($apeNorm, (string) ($row['manage_apellido_norm'] ?? ''))) {
            return ['ok' => true, 'turno' => $row];
        }
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
        return ['allowed' => false, 'reason' => 'within_policy_window', 'hours_left' => round($hoursLeft, 1)];
    }
    return ['allowed' => true, 'hours_left' => round($hoursLeft, 1)];
}

/**
 * ¿Anulación con poca anticipación? (default ≤2 hs antes del turno).
 *
 * @param array<string,mixed> $turno
 */
function kinesica_rel_manage_is_late_cancel(array $turno, float $withinHours = KINESICA_LATE_CANCEL_NOTICE_HOURS): bool
{
    $starts = trim((string) ($turno['starts_at'] ?? ''));
    if ($starts === '') {
        return false;
    }
    $ts = strtotime($starts);
    if ($ts === false) {
        return false;
    }
    $hoursLeft = ($ts - time()) / 3600;
    return $hoursLeft > 0 && $hoursLeft <= $withinHours;
}

function kinesica_rel_manage_late_cancel_notice(): string
{
    return KINESICA_LATE_CANCEL_NOTICE_ES;
}
