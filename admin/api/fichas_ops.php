<?php
declare(strict_types=1);

/**
 * Puente columnas relacionales en fichas (migraciones 002/004).
 * Idempotente (ADD IF MISSING). No se apaga: red de seguridad productiva.
 */
function kinesica_fichas_ensure_rel_columns(PDO $pdo): void
{
    static $done = null;
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    require_once __DIR__ . '/lib_migrations.php';
    try {
        kinesica_migrations_add_column_if_missing($pdo, 'fichas', 'paciente_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing($pdo, 'fichas', 'profesional_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'fichas',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1',
            'INTEGER NOT NULL DEFAULT 1'
        );
    } catch (Throwable $e) {
        error_log('kinesica fichas ensure_rel_columns: ' . $e->getMessage());
    }
    $done[$pdo] = true;
}

function kinesica_fichas_check_structure(array $data): bool
{
    $checkValue = static function ($value, int $depth = 0) use (&$checkValue): bool {
        if ($depth > 4) return false;
        if (is_string($value)) return mb_strlen($value) <= 5000;
        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) return true;
        if (is_array($value)) {
            if (count($value) > 200) return false;
            foreach ($value as $k => $v) {
                if (is_string($k) && !preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $k)) return false;
                if (!$checkValue($v, $depth + 1)) return false;
            }
            return true;
        }
        return false;
    };
    return $checkValue($data);
}

function kinesica_fichas_get_all(PDO $pdo): void
{
    kinesica_fichas_ensure_rel_columns($pdo);
    require_once __DIR__ . '/lib_migrations.php';
    // REL: enriquecer filas con datos canónicos si REL_READ_IDS (lib_relational_read.php).
    require_once __DIR__ . '/lib_relational_read.php';
    $hasPid = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $hasVersion = kinesica_migrations_column_exists($pdo, 'fichas', 'version');
    $cols = 'payload';
    if ($hasPid) {
        $cols .= ', paciente_id';
    }
    if ($hasVersion) {
        $cols .= ', version';
    }
    $rows = $pdo->query("SELECT {$cols} FROM fichas ORDER BY updated_at DESC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    json_out(200, kinesica_rel_map_ficha_rows($pdo, $rows));
}

function kinesica_fichas_find_inherited_owner(PDO $pdo, string $id, array $data, string $incomingDoc, string $incomingName, array $clinicians, callable $docKey, callable $nameKey): string
{
    $stmtSiblings = $pdo->prepare('
        SELECT id, profesional, payload FROM fichas 
        WHERE id != :id AND (
            JSON_UNQUOTE(JSON_EXTRACT(payload, "$.dni")) LIKE :dniPattern OR 
            JSON_UNQUOTE(JSON_EXTRACT(payload, "$.nombre")) LIKE :namePattern
        ) ORDER BY updated_at DESC LIMIT 50
    ');
    $dniPat = $incomingDoc !== '' ? '%' . trim((string) ($data['dni'] ?? '')) . '%' : '%NOMATCH%';
    $namePat = $incomingName !== '' ? '%' . trim((string) ($data['nombre'] ?? '')) . '%' : '%NOMATCH%';
    $stmtSiblings->execute(['id' => $id, 'dniPattern' => $dniPat, 'namePattern' => $namePat]);
    $siblingRows = $stmtSiblings->fetchAll() ?: $pdo->query('SELECT id, profesional, payload FROM fichas ORDER BY updated_at DESC LIMIT 100')->fetchAll();
    foreach ($siblingRows as $row) {
        if ((string) $row['id'] === $id) continue;
        $item = json_decode((string) $row['payload'], true);
        if (!is_array($item)) continue;
        $doc = $docKey((string) ($item['dni'] ?? ''));
        $name = $nameKey((string) ($item['nombre'] ?? ''));
        $sameDoc = $incomingDoc !== '' && $doc === $incomingDoc;
        $sameNameOnly = $incomingDoc === '' && $incomingName !== '' && $name === $incomingName && $doc === '';
        if (!$sameDoc && !$sameNameOnly) continue;
        $owner = (string) ($row['profesional'] ?? '');
        if (isset($clinicians[$owner])) return $owner;
    }
    return '';
}

/**
 * Optimistic locking: si el cliente envía version y no coincide → 409.
 * Clientes legacy sin version siguen pudiendo guardar.
 *
 * @return int versión actual en DB (0 si no hay fila / columna)
 */
function kinesica_fichas_assert_version(PDO $pdo, string $id, array $data): int
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'fichas', 'version')) {
        return 0;
    }
    $stmt = $pdo->prepare('SELECT version FROM fichas WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return 0;
    }
    $dbVersion = (int) ($row['version'] ?? 1);
    if (!array_key_exists('version', $data)) {
        return $dbVersion;
    }
    $clientVersion = (int) $data['version'];
    if ($clientVersion > 0 && $clientVersion !== $dbVersion) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_out(409, [
            'error' => 'La ficha fue modificada por otro usuario. Recargá e intentá de nuevo.',
            'version' => $dbVersion,
            'code' => 'ficha_version_conflict',
        ]);
    }
    return $dbVersion;
}

/**
 * @return array{version:int}
 */
function kinesica_fichas_save_record(PDO $pdo, array $auth, string $id, array $data, string $profesional): array
{
    kinesica_fichas_ensure_rel_columns($pdo);
    $currentVersion = kinesica_fichas_assert_version($pdo, $id, $data);

    // No persistir version dentro del JSON clínico (vive en columna).
    unset($data['version']);
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($payload === false) {
        $pdo->rollBack();
        json_out(422, ['error' => 'La ficha contiene datos no válidos']);
    }

    // REL: resolver paciente_id / profesional_id (lib_relational_resolve.php).
    // paciente_id solo con REL_WRITE_IDS; profesional_id también con ignore_flag post-005.
    $pacienteId = null;
    $profesionalId = null;
    $didSync = false;
    try {
        require_once __DIR__ . '/lib_relational_resolve.php';
        if (kinesica_rel_write_ids()) {
            require_once __DIR__ . '/pacientes_helpers.php';
            if (function_exists('sync_pacientes_from_fichas')) {
                sync_pacientes_from_fichas($pdo, $id, $data, $profesional);
                $didSync = true;
            }
            // REL etapa 10: preferir paciente_id del payload si viene; si no, resolver.
            // Teléfono del payload (si existe) mejora match; DNI/nombre siguen como fallback.
            $hints = [
                'dni' => (string) ($data['dni'] ?? ''),
                'nombre' => (string) ($data['nombre'] ?? ''),
                'phone' => (string) ($data['telefono'] ?? $data['phone'] ?? ''),
            ];
            $explicitPacienteId = function_exists('kinesica_rel_parse_positive_id')
                ? kinesica_rel_parse_positive_id($data['paciente_id'] ?? null)
                : (int) ($data['paciente_id'] ?? 0);
            if ($explicitPacienteId > 0) {
                $hints['paciente_id'] = $explicitPacienteId;
            }
            $pacienteId = kinesica_rel_resolve_paciente_id_or_note($pdo, 'fichas', $hints);
            // Explicit inválido/eliminado: no persistir NULL (desvincularía la ficha).
            if ($explicitPacienteId > 0 && $pacienteId === null) {
                json_out(422, [
                    'status' => 'error',
                    'code' => 'paciente_id_invalid',
                    'message' => 'paciente_id inválido o eliminado.',
                ]);
            }
            $explicitProfesionalId = function_exists('kinesica_rel_parse_positive_id')
                ? kinesica_rel_parse_positive_id($data['profesional_id'] ?? null)
                : (int) ($data['profesional_id'] ?? 0);
            if ($explicitProfesionalId > 0) {
                $profesionalId = $explicitProfesionalId;
            } else {
                $profesionalId = kinesica_rel_resolve_profesional_id($pdo, $profesional);
            }
        } elseif (kinesica_migrations_table_exists($pdo, 'profesionales')) {
            // REL: profesional_id sin WRITE_IDS si ya existe tabla profesionales (mig 005).
            $profesionalId = kinesica_rel_resolve_profesional_id($pdo, $profesional, ['ignore_flag' => true]);
        }
    } catch (Throwable $e) {
        // Resolve es best-effort: la ficha clínica se guarda igual sin IDs.
        error_log('kinesica fichas resolve IDs: ' . $e->getMessage());
    }

    // REL: con REL_ENFORCE_FK, rechazar IDs inválidos / soft-deleted (lib_relational_integrity.php).
    // Sin try/catch amplio: un fallo de assert/require no debe silenciar la integridad.
    require_once __DIR__ . '/lib_relational_integrity.php';
    $chkP = kinesica_rel_assert_paciente_id($pdo, $pacienteId);
    if ($chkP !== true) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_out(422, ['status' => 'error', 'code' => $chkP['code'], 'message' => $chkP['message']]);
    }
    $chkPr = kinesica_rel_assert_profesional_id($pdo, $profesionalId);
    if ($chkPr !== true) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_out(422, ['status' => 'error', 'code' => $chkPr['code'], 'message' => $chkPr['message']]);
    }

    $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $hasProfCol = kinesica_migrations_column_exists($pdo, 'fichas', 'profesional_id');
    $hasVersion = kinesica_migrations_column_exists($pdo, 'fichas', 'version');
    $nextVersion = $hasVersion ? ($currentVersion > 0 ? $currentVersion + 1 : 1) : 0;

    $cols = 'id, payload, profesional, updated_at, updated_by';
    $vals = ':id, :payload, :profesional, UTC_TIMESTAMP(), :user';
    $upd = 'payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)';
    $params = [
        'id' => $id,
        'payload' => $payload,
        'profesional' => $profesional,
        'user' => $auth['username'],
    ];
    // Explicit ID en payload puede reemplazar; resolve por tel/nombre solo rellena NULL
    // (evita reasignar ficha ya vinculada si el nombre/DNI cambian o matchean otro).
    $explicitPacienteOnSave = function_exists('kinesica_rel_parse_positive_id')
        ? kinesica_rel_parse_positive_id($data['paciente_id'] ?? null) > 0
        : (isset($data['paciente_id']) && (int) $data['paciente_id'] > 0);
    $explicitProfOnSave = function_exists('kinesica_rel_parse_positive_id')
        ? kinesica_rel_parse_positive_id($data['profesional_id'] ?? null) > 0
        : (isset($data['profesional_id']) && (int) $data['profesional_id'] > 0);
    if ($hasPacienteCol) {
        $cols .= ', paciente_id';
        $vals .= ', :paciente_id';
        $upd .= $explicitPacienteOnSave
            ? ', paciente_id = VALUES(paciente_id)'
            : ', paciente_id = COALESCE(paciente_id, VALUES(paciente_id))';
        $params['paciente_id'] = $pacienteId;
    }
    if ($hasProfCol) {
        $cols .= ', profesional_id';
        $vals .= ', :profesional_id';
        $upd .= $explicitProfOnSave
            ? ', profesional_id = VALUES(profesional_id)'
            : ', profesional_id = COALESCE(profesional_id, VALUES(profesional_id))';
        $params['profesional_id'] = $profesionalId;
    }
    if ($hasVersion) {
        $cols .= ', version';
        $vals .= ', :version';
        $upd .= ', version = version + 1';
        $params['version'] = $nextVersion > 0 ? $nextVersion : 1;
    }
    $stmt = $pdo->prepare(
        "INSERT INTO fichas ({$cols}) VALUES ({$vals}) ON DUPLICATE KEY UPDATE {$upd}"
    );
    $stmt->execute($params);

    if ($hasVersion) {
        $verStmt = $pdo->prepare('SELECT version FROM fichas WHERE id = :id LIMIT 1');
        $verStmt->execute(['id' => $id]);
        $nextVersion = (int) ($verStmt->fetchColumn() ?: $nextVersion);
    }

    $pdo->commit();

    if (!$didSync) {
        try {
            require_once __DIR__ . '/pacientes_helpers.php';
            if (function_exists('sync_pacientes_from_fichas')) {
                sync_pacientes_from_fichas($pdo, $id, $data, $profesional);
            }
        } catch (Throwable $e) {
            error_log('kinesica fichas sync_pacientes: ' . $e->getMessage());
        }
    }

    return ['version' => $nextVersion];
}
