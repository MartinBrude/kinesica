<?php
declare(strict_types=1);


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
