<?php
declare(strict_types=1);

/**
 * Operaciones de lista de espera (`waitlist_insert`, `waitlist_remove`) para pacientes.
 */
function kinesica_pacientes_waitlist_ops(PDO $pdo, string $action, array $data): void
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_table_exists($pdo, 'lista_espera')) {
        json_out(200, ['status' => 'success', 'message' => 'Lista de espera desactivada']);
    }
    if ($action === 'waitlist_insert' || $action === 'insert_waitlist') {
        $phone = clean_phone_number((string) ($data['telefono'] ?? $data['paciente_telefono'] ?? ''));
        $nombre = sanitize_patient_name(trim((string) ($data['nombre'] ?? $data['paciente_nombre'] ?? '')));
        $horario = trim((string) ($data['rango_horario_preferido'] ?? ''));
        $dias = trim((string) ($data['dias_preferidos'] ?? ''));
        $profesional = in_array($data['profesional'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional'] : 'indistinto';
        require_once __DIR__ . '/lib_migrations.php';
        require_once __DIR__ . '/lib_relational_resolve.php';
        $pacienteIdExplicit = kinesica_rel_parse_positive_id($data['paciente_id'] ?? null);
        $pacienteId = null;
        $profesionalId = null;

        if ($pacienteIdExplicit > 0) {
            $hasDel = kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at');
            $cols = 'id, telefono, nombre_completo, nombre, apellido' . ($hasDel ? ', deleted_at' : '');
            $find = $pdo->prepare("SELECT {$cols} FROM pacientes WHERE id = :id LIMIT 1");
            $find->execute(['id' => $pacienteIdExplicit]);
            $prow = $find->fetch(PDO::FETCH_ASSOC);
            if (!is_array($prow) || ($hasDel && kinesica_rel_paciente_row_is_deleted($prow))) {
                json_out(422, ['status' => 'error', 'message' => 'paciente_id inválido']);
            }
            $pacienteId = (int) $prow['id'];
            if ($phone === '') {
                $phone = clean_phone_number((string) ($prow['telefono'] ?? ''));
            }
            if ($nombre === '') {
                $nombre = sanitize_patient_name(trim((string) (
                    $prow['nombre_completo'] !== ''
                        ? $prow['nombre_completo']
                        : trim(($prow['nombre'] ?? '') . ' ' . ($prow['apellido'] ?? ''))
                )));
            }
        }

        if ($phone === '' || $nombre === '') {
            json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre requeridos (o un paciente_id válido del directorio)']);
        }

        if ($pacienteId === null) {
            try {
                $res = kinesica_rel_resolve_paciente($pdo, ['phone' => $phone, 'nombre' => $nombre], ['ignore_flag' => true]);
                if (($res['status'] ?? '') === 'matched' && !empty($res['paciente_id'])) {
                    $pacienteId = (int) $res['paciente_id'];
                } elseif (kinesica_rel_write_ids()) {
                    kinesica_rel_resolve_paciente_id_or_note($pdo, 'lista_espera', ['phone' => $phone, 'nombre' => $nombre]);
                }
            } catch (Throwable $e) {
                error_log('kinesica waitlist resolve paciente: ' . $e->getMessage());
                $pacienteId = null;
            }
        }
        try {
            $profesionalId = kinesica_rel_resolve_profesional_id($pdo, (string) $profesional, ['ignore_flag' => true]);
        } catch (Throwable $e) {
            error_log('kinesica waitlist resolve profesional: ' . $e->getMessage());
            $profesionalId = null;
        }

        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id');
        $hasProfCol = kinesica_migrations_column_exists($pdo, 'lista_espera', 'profesional_id');
        if ($hasPacienteCol || $hasProfCol) {
            $cols = 'paciente_telefono, paciente_nombre, rango_horario_preferido, dias_preferidos, profesional, estado';
            $vals = ':tel, :nom, :hor, :dias, :prof, "activa"';
            $params = ['tel' => $phone, 'nom' => $nombre, 'hor' => $horario, 'dias' => $dias, 'prof' => $profesional];
            if ($hasPacienteCol) {
                $cols .= ', paciente_id';
                $vals .= ', :paciente_id';
                $params['paciente_id'] = $pacienteId;
            }
            if ($hasProfCol) {
                $cols .= ', profesional_id';
                $vals .= ', :profesional_id';
                $params['profesional_id'] = $profesionalId;
            }
            $pdo->prepare("INSERT INTO lista_espera ({$cols}) VALUES ({$vals})")->execute($params);
        } else {
            $pdo->prepare(
                'INSERT INTO lista_espera (paciente_telefono, paciente_nombre, rango_horario_preferido, dias_preferidos, profesional, estado)
                 VALUES (:tel, :nom, :hor, :dias, :prof, "activa")'
            )->execute(['tel' => $phone, 'nom' => $nombre, 'hor' => $horario, 'dias' => $dias, 'prof' => $profesional]);
        }
        json_out(200, ['status' => 'success', 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($action === 'waitlist_remove' || $action === 'remove_waitlist') {
        $id = (int) ($data['id'] ?? 0);
        $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
        require_once __DIR__ . '/lib_relational_resolve.php';
        $pacienteId = kinesica_rel_parse_positive_id($data['paciente_id'] ?? null);
        if ($id > 0) {
            $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE id = :id')->execute(['id' => $id]);
        } elseif ($pacienteId > 0) {
            require_once __DIR__ . '/lib_migrations.php';
            if (kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id')) {
                $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_id = :pid AND estado = "activa"')->execute(['pid' => $pacienteId]);
            } elseif ($phone !== '') {
                $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel')->execute(['tel' => $phone]);
            }
        } elseif ($phone !== '') {
            require_once __DIR__ . '/lib_migrations.php';
            $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel')->execute(['tel' => $phone]);
            if (kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id')) {
                try {
                    require_once __DIR__ . '/lib_relational_resolve.php';
                    $resolved = kinesica_rel_resolve_paciente($pdo, ['phone' => $phone], ['ignore_flag' => true]);
                    if (($resolved['status'] ?? '') === 'matched' && !empty($resolved['paciente_id'])) {
                        $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_id = :pid AND estado = "activa"')
                            ->execute(['pid' => (int) $resolved['paciente_id']]);
                    }
                } catch (Throwable $e) {
                    error_log('kinesica waitlist_remove resolve: ' . $e->getMessage());
                }
            }
        }
        json_out(200, ['status' => 'success']);
    }
}
