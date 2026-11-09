<?php
declare(strict_types=1);

function kinesica_pacientes_upsert(PDO $pdo, array $data): void
{
    $rawPhone = (string) ($data['telefono'] ?? '');
    $phone = clean_phone_number($rawPhone);
    if (strlen($phone) < 6 || strlen($phone) > 16 || preg_match('/^(\d)\1+$/', $phone)) {
        json_out(422, ['status' => 'error', 'message' => 'Número de teléfono inválido o incompleto']);
    }

    $nombre = mb_substr(sanitize_patient_name((string) ($data['nombre'] ?? '')), 0, 60, 'UTF-8');
    $apellido = mb_substr(sanitize_patient_name((string) ($data['apellido'] ?? '')), 0, 60, 'UTF-8');
    $nombreCompleto = mb_substr(sanitize_patient_name((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? '')), 0, 120, 'UTF-8');

    if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) {
        $nombreCompleto = trim($nombre . ' ' . $apellido);
    } elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
        $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nombre = $parts[0] ?? $nombreCompleto;
        $apellido = $parts[1] ?? '';
    }

    if ($nombreCompleto === '') {
        json_out(422, ['status' => 'error', 'message' => 'El nombre y apellido son obligatorios']);
    }

    if (is_tk3_or_blocked_name($nombreCompleto) || is_tk3_or_blocked_name($nombre)) {
        json_out(422, ['status' => 'error', 'message' => 'El nombre no corresponde a un paciente válido']);
    }

    $nombrePila = mb_substr(trim((string) ($data['nombre_pila'] ?? '')), 0, 60, 'UTF-8');
    if ($nombrePila === '') {
        $nombrePila = extract_first_name($nombreCompleto);
    } else {
        $nombrePila = sanitize_patient_name($nombrePila);
    }

    $dni = isset($data['dni']) && trim((string) $data['dni']) !== '' && trim((string) $data['dni']) !== 'No provisto' 
        ? mb_substr(trim((string) $data['dni']), 0, 20, 'UTF-8') : null;

    $email = isset($data['email']) && trim((string) $data['email']) !== '' ? trim((string) $data['email']) : null;
    if (!is_valid_email_strict($email)) {
        json_out(422, ['status' => 'error', 'message' => 'El formato del correo electrónico no es válido']);
    }

    $profesional = in_array($data['profesional_habitual'] ?? '', ['norberto', 'maria', 'indistinto'], true)
        ? $data['profesional_habitual'] : 'indistinto';

    $motivo = isset($data['motivo_consulta']) ? mb_substr(trim((string) $data['motivo_consulta']), 0, 255, 'UTF-8') : null;
    $notas = isset($data['notas']) ? mb_substr(trim((string) $data['notas']), 0, 2000, 'UTF-8') : null;
    $origen = in_array($data['origen'] ?? '', ['whatsapp', 'web', 'admin'], true) ? $data['origen'] : 'whatsapp';

    $contactoNombre = isset($data['contacto_nombre']) && trim((string) $data['contacto_nombre']) !== '' 
        ? mb_substr(sanitize_patient_name((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null;
    $contactoTelRaw = (string) ($data['contacto_telefono'] ?? '');
    $contactoTel = $contactoTelRaw !== '' ? clean_phone_number($contactoTelRaw) : null;
    if ($contactoTel === '') $contactoTel = null;
    $contactoEmail = isset($data['contacto_email']) && trim((string) $data['contacto_email']) !== '' 
        ? trim((string) $data['contacto_email']) : null;
    if (!is_valid_email_strict($contactoEmail)) {
        json_out(422, ['status' => 'error', 'message' => 'El correo electrónico de contacto no es válido']);
    }
    $contactoNotas = isset($data['contacto_notas']) && trim((string) $data['contacto_notas']) !== '' 
        ? mb_substr(trim((string) $data['contacto_notas']), 0, 100, 'UTF-8') : null;
    $dejoReview = isset($data['dejo_review']) ? (!empty($data['dejo_review']) ? 1 : 0) : 0;

    // Buscar si ya existe el paciente por teléfono, DNI o coincidencia de nombre (prevención de duplicados)
    $existing = find_existing_patient_match($pdo, $phone, $nombreCompleto, $dni);

    if ($existing) {
        $existingId = (int) $existing['id'];
        $isExistingPlaceholder = is_placeholder_phone((string) ($existing['telefono'] ?? ''));

        // Regla: si uno dice con review y otro sin, queda que si
        $finalReview = (!empty($existing['dejo_review']) || $dejoReview === 1) ? 1 : 0;

        // Regla: si uno dice indistinto y otro dice con tal, queda tal
        $finalProf = merge_prof_values((string) ($existing['profesional_habitual'] ?? 'indistinto'), $profesional);

        $finalDni = ($dni !== null && $dni !== '') ? $dni : clean_patient_dni($existing['dni'] ?? null);
        $finalEmail = ($email !== null && $email !== '') ? $email : ($existing['email'] ?? null);

        $existingMotivo = trim((string) ($existing['motivo_consulta'] ?? ''));
        if ($motivo !== null && $motivo !== '') {
            $finalMotivo = $motivo;
        } elseif ($existingMotivo !== '') {
            $finalMotivo = $existingMotivo;
        } else {
            $finalMotivo = null;
        }

        $existingNotas = trim((string) ($existing['notas'] ?? ''));
        if ($notas !== null && $notas !== '') {
            $finalNotas = ($existingNotas !== '' && !str_contains($existingNotas, $notas)) ? $existingNotas . "\n" . $notas : $notas;
        } else {
            $finalNotas = $existingNotas !== '' ? $existingNotas : null;
        }

        $finalContactoNom = $contactoNombre ?: ($existing['contacto_nombre'] ?? null);
        $finalContactoTel = $contactoTel ?: ($existing['contacto_telefono'] ?? null);
        $finalContactoEmail = $contactoEmail ?: ($existing['contacto_email'] ?? null);
        $finalContactoNotas = $contactoNotas ?: ($existing['contacto_notas'] ?? null);

        // No descartar el WhatsApp que acaba de cargar el admin (match por nombre/DNI).
        $targetPhone = function_exists('kinesica_resolve_merge_phone')
            ? kinesica_resolve_merge_phone($pdo, $existing, $phone)
            : ($isExistingPlaceholder ? $phone : (string) ($existing['telefono'] ?? $phone));

        // Resolver campos en PHP: con ATTR_EMULATE_PREPARES=false no se puede
        // reutilizar el mismo named param dos veces (CASE WHEN :x THEN :x rompe).
        $mergeNombre = $nombre !== '' ? $nombre : (string) ($existing['nombre'] ?? '');
        $mergeApellido = $apellido !== '' ? $apellido : (string) ($existing['apellido'] ?? '');
        $mergeFull = $nombreCompleto !== '' ? $nombreCompleto : (string) ($existing['nombre_completo'] ?? '');
        $mergePila = $nombrePila !== '' ? $nombrePila : (string) ($existing['nombre_pila'] ?? '');
        $mergeOrigen = kinesica_prefer_origen((string) ($existing['origen'] ?? 'whatsapp'), $origen);

        $stmtUpd = $pdo->prepare('
            UPDATE pacientes SET
                telefono = :tel,
                nombre = :nom,
                apellido = :ape,
                nombre_completo = :full,
                nombre_pila = :pila,
                dni = :dni,
                email = :email,
                profesional_habitual = :prof,
                motivo_consulta = :motivo,
                notas = :notas,
                origen = :origen,
                contacto_nombre = :cnom,
                contacto_telefono = :ctel,
                contacto_email = :cemail,
                contacto_notas = :cnot,
                dejo_review = :rev
            WHERE id = :id
        ');
        try {
            $stmtUpd->execute([
                'tel' => $targetPhone,
                'nom' => $mergeNombre,
                'ape' => $mergeApellido,
                'full' => $mergeFull,
                'pila' => $mergePila,
                'dni' => $finalDni ?: null,
                'email' => $finalEmail ?: null,
                'prof' => $finalProf,
                'motivo' => $finalMotivo ? mb_substr($finalMotivo, 0, 255, 'UTF-8') : null,
                'notas' => $finalNotas ? mb_substr($finalNotas, 0, 2000, 'UTF-8') : null,
                'origen' => $mergeOrigen,
                'cnom' => $finalContactoNom,
                'ctel' => $finalContactoTel,
                'cemail' => $finalContactoEmail,
                'cnot' => $finalContactoNotas,
                'rev' => $finalReview,
                'id' => $existingId,
            ]);
        } catch (Throwable $e) {
            error_log('kinesica pacientes upsert merge: ' . $e->getMessage());
            json_out(500, ['status' => 'error', 'message' => 'No se pudo guardar el paciente: ' . $e->getMessage()]);
        }

        error_log('kinesica pacientes upsert merged id=' . $existingId . ' phone=' . $targetPhone);
        // REL: espejo legacy → paciente_contactos (lib_relational_contactos.php).
        require_once __DIR__ . '/lib_relational_contactos.php';
        kinesica_rel_sync_paciente_contactos_safe($pdo, $existingId, [
            'telefono' => $targetPhone,
            'email' => (string) ($finalEmail ?? ''),
            'contacto_telefono' => (string) ($finalContactoTel ?? ''),
            'contacto_email' => (string) ($finalContactoEmail ?? ''),
        ]);
        json_out(200, [
            'status' => 'success',
            'action' => 'upsert',
            'merged' => true,
            'id' => $existingId,
            'phone' => $targetPhone,
            'nombre' => $nombre,
            'apellido' => $apellido,
            'nombre_pila' => $nombrePila,
            'email' => $finalEmail,
            'profesional_habitual' => $finalProf,
            'dejo_review' => $finalReview,
        ]);
    }

    $stmt = $pdo->prepare('
        INSERT INTO pacientes (
            telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email, profesional_habitual, 
            motivo_consulta, notas, origen, contacto_nombre, contacto_telefono, contacto_email, contacto_notas, dejo_review
        ) VALUES (
            :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :email, :profesional_habitual, 
            :motivo_consulta, :notas, :origen, :contacto_nombre, :contacto_telefono, :contacto_email, :contacto_notas, :dejo_review
        )
        ON DUPLICATE KEY UPDATE
            nombre = CASE WHEN VALUES(nombre) != "" THEN VALUES(nombre) ELSE nombre END,
            apellido = CASE WHEN VALUES(apellido) != "" THEN VALUES(apellido) ELSE apellido END,
            nombre_completo = VALUES(nombre_completo),
            nombre_pila = VALUES(nombre_pila),
            dni = COALESCE(VALUES(dni), dni),
            email = COALESCE(VALUES(email), email),
            profesional_habitual = CASE WHEN VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END,
            motivo_consulta = COALESCE(VALUES(motivo_consulta), motivo_consulta),
            notas = COALESCE(VALUES(notas), notas),
            contacto_nombre = COALESCE(VALUES(contacto_nombre), contacto_nombre),
            contacto_telefono = COALESCE(VALUES(contacto_telefono), contacto_telefono),
            contacto_email = COALESCE(VALUES(contacto_email), contacto_email),
            contacto_notas = COALESCE(VALUES(contacto_notas), contacto_notas),
            dejo_review = CASE WHEN VALUES(dejo_review) = 1 THEN 1 ELSE dejo_review END
    ');

    try {
        $stmt->execute([
            'telefono' => $phone, 'nombre' => $nombre, 'apellido' => $apellido,
            'nombre_completo' => $nombreCompleto, 'nombre_pila' => $nombrePila,
            'dni' => $dni, 'email' => $email, 'profesional_habitual' => $profesional,
            'motivo_consulta' => $motivo, 'notas' => $notas, 'origen' => $origen,
            'contacto_nombre' => $contactoNombre, 'contacto_telefono' => $contactoTel,
            'contacto_email' => $contactoEmail, 'contacto_notas' => $contactoNotas,
            'dejo_review' => $dejoReview,
        ]);
    } catch (Throwable $e) {
        error_log('kinesica pacientes upsert insert: ' . $e->getMessage());
        json_out(500, ['status' => 'error', 'message' => 'No se pudo crear el paciente: ' . $e->getMessage()]);
    }

    $newId = (int) $pdo->lastInsertId();
    if ($newId <= 0) {
        // ON DUPLICATE KEY UPDATE no genera lastInsertId; recuperar por teléfono.
        $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
        $find->execute(['tel' => $phone]);
        $newId = (int) ($find->fetchColumn() ?: 0);
    }
    error_log('kinesica pacientes upsert inserted/updated id=' . $newId . ' phone=' . $phone);
    if ($newId > 0) {
        // REL: sync contactos tras alta/upsert (lib_relational_contactos.php).
        require_once __DIR__ . '/lib_relational_contactos.php';
        kinesica_rel_sync_paciente_contactos_safe($pdo, $newId, [
            'telefono' => $phone,
            'email' => (string) ($email ?? ''),
            'contacto_telefono' => (string) ($contactoTel ?? ''),
            'contacto_email' => (string) ($contactoEmail ?? ''),
        ]);
    }
    json_out(200, [
        'status' => 'success',
        'action' => 'upsert',
        'merged' => false,
        'id' => $newId,
        'phone' => $phone,
        'nombre' => $nombre,
        'apellido' => $apellido,
        'nombre_pila' => $nombrePila,
        'email' => $email,
    ]);
}

function kinesica_pacientes_update(PDO $pdo, array $data): void
{
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);

    $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
    $nombre = mb_substr(sanitize_patient_name((string) ($data['nombre'] ?? '')), 0, 60, 'UTF-8');
    $apellido = mb_substr(sanitize_patient_name((string) ($data['apellido'] ?? '')), 0, 60, 'UTF-8');
    $nombreCompleto = mb_substr(sanitize_patient_name((string) ($data['nombre_completo'] ?? '')), 0, 120, 'UTF-8');

    if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) {
        $nombreCompleto = trim($nombre . ' ' . $apellido);
    } elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
        $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nombre = $parts[0] ?? $nombreCompleto;
        $apellido = $parts[1] ?? '';
    }

    if (strlen($phone) < 6 || strlen($phone) > 16 || preg_match('/^(\d)\1+$/', $phone) || $nombreCompleto === '') {
        json_out(422, ['status' => 'error', 'message' => 'Nombre, apellido y teléfono son obligatorios']);
    }

    if (is_tk3_or_blocked_name($nombreCompleto) || is_tk3_or_blocked_name($nombre)) {
        json_out(422, ['status' => 'error', 'message' => 'El nombre no corresponde a un paciente válido']);
    }

    $check = $pdo->prepare('SELECT id, nombre_completo, dni FROM pacientes WHERE telefono = :tel AND id != :id');
    $check->execute(['tel' => $phone, 'id' => $id]);
    $existing = $check->fetch();
    if ($existing) {
        json_out(409, ['status' => 'error', 'message' => 'Ese teléfono ya está asignado al paciente ' . $existing['nombre_completo']]);
    }

    $current = $pdo->prepare('SELECT dni FROM pacientes WHERE id = :id LIMIT 1');
    $current->execute(['id' => $id]);
    $currentRow = $current->fetch(PDO::FETCH_ASSOC) ?: [];

    $nombrePila = extract_first_name($nombreCompleto);
    // No perder DNI existente al actualizar contacto sin documento (merge / formulario incompleto).
    $incomingDni = !empty($data['dni']) && strcasecmp(trim((string) $data['dni']), 'No provisto') !== 0
        ? mb_substr(trim((string) $data['dni']), 0, 20, 'UTF-8')
        : '';
    $existingDni = clean_patient_dni($currentRow['dni'] ?? null);
    $dni = $incomingDni !== '' ? $incomingDni : ($existingDni !== '' ? mb_substr($existingDni, 0, 20, 'UTF-8') : null);
    $email = !empty($data['email']) ? trim((string) $data['email']) : null;
    if (!is_valid_email_strict($email)) {
        json_out(422, ['status' => 'error', 'message' => 'El formato del correo electrónico no es válido']);
    }
    $profesional = in_array($data['profesional_habitual'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional_habitual'] : 'indistinto';
    $motivo = !empty($data['motivo_consulta']) ? mb_substr(trim((string) $data['motivo_consulta']), 0, 255, 'UTF-8') : null;
    $notas = !empty($data['notas']) ? mb_substr(trim((string) $data['notas']), 0, 2000, 'UTF-8') : null;
    $contactoNombre = !empty($data['contacto_nombre']) ? mb_substr(sanitize_patient_name((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null;
    $contactoTelRaw = (string) ($data['contacto_telefono'] ?? '');
    $contactoTel = $contactoTelRaw !== '' ? clean_phone_number($contactoTelRaw) : null;
    if ($contactoTel === '') $contactoTel = null;
    $contactoEmail = !empty($data['contacto_email']) ? trim((string) $data['contacto_email']) : null;
    if (!is_valid_email_strict($contactoEmail)) {
        json_out(422, ['status' => 'error', 'message' => 'El correo electrónico de contacto no es válido']);
    }
    $contactoNotas = !empty($data['contacto_notas']) ? mb_substr(trim((string) $data['contacto_notas']), 0, 100, 'UTF-8') : null;
    $dejoReview = isset($data['dejo_review']) ? (!empty($data['dejo_review']) ? 1 : 0) : null;

    $stmt = $pdo->prepare('
        UPDATE pacientes SET
            telefono = :tel, nombre = :nombre, apellido = :apellido, nombre_completo = :nom,
            nombre_pila = :pila, dni = :dni, email = :email, profesional_habitual = :prof,
            motivo_consulta = :motivo, notas = :notas, contacto_nombre = :contacto_nombre,
            contacto_telefono = :contacto_telefono, contacto_email = :contacto_email, contacto_notas = :contacto_notas' .
            ($dejoReview !== null ? ', dejo_review = :dejo_review' : '') . '
        WHERE id = :id
    ');
    $params = [
        'tel' => $phone, 'nombre' => $nombre, 'apellido' => $apellido, 'nom' => $nombreCompleto,
        'pila' => $nombrePila, 'dni' => $dni, 'email' => $email, 'prof' => $profesional,
        'motivo' => $motivo, 'notas' => $notas, 'contacto_nombre' => $contactoNombre,
        'contacto_telefono' => $contactoTel, 'contacto_email' => $contactoEmail,
        'contacto_notas' => $contactoNotas, 'id' => $id,
    ];
    if ($dejoReview !== null) {
        $params['dejo_review'] = $dejoReview;
    }
    $stmt->execute($params);

    // REL: sync contactos tras edición (lib_relational_contactos.php).
    require_once __DIR__ . '/lib_relational_contactos.php';
    kinesica_rel_sync_paciente_contactos_safe($pdo, $id, [
        'telefono' => $phone,
        'email' => (string) ($email ?? ''),
        'contacto_telefono' => (string) ($contactoTel ?? ''),
        'contacto_email' => (string) ($contactoEmail ?? ''),
    ]);

    json_out(200, ['status' => 'success', 'message' => 'Paciente actualizado con éxito']);
}

function kinesica_pacientes_waitlist_ops(PDO $pdo, string $action, array $data): void
{
    if ($action === 'waitlist_insert' || $action === 'insert_waitlist') {
        $phone = clean_phone_number((string) ($data['telefono'] ?? $data['paciente_telefono'] ?? ''));
        $nombre = sanitize_patient_name(trim((string) ($data['nombre'] ?? $data['paciente_nombre'] ?? '')));
        $horario = trim((string) ($data['rango_horario_preferido'] ?? ''));
        $dias = trim((string) ($data['dias_preferidos'] ?? ''));
        $profesional = in_array($data['profesional'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional'] : 'indistinto';
        require_once __DIR__ . '/lib_migrations.php';
        // REL: identidad preferida = paciente_id; teléfono/nombre denormalizados para vista.
        require_once __DIR__ . '/lib_relational_resolve.php';
        $pacienteIdExplicit = kinesica_rel_parse_positive_id($data['paciente_id'] ?? null);
        $pacienteId = null;
        $profesionalId = null;

        if ($pacienteIdExplicit > 0) {
            $hasDel = kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at');
            $cols = 'id, telefono, nombre_completo, nombre, apellido'
                . ($hasDel ? ', deleted_at' : '');
            $find = $pdo->prepare(
                "SELECT {$cols} FROM pacientes WHERE id = :id LIMIT 1"
            );
            $find->execute(['id' => $pacienteIdExplicit]);
            $prow = $find->fetch(PDO::FETCH_ASSOC);
            if (!is_array($prow)
                || ($hasDel && kinesica_rel_paciente_row_is_deleted($prow))
            ) {
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
            json_out(422, [
                'status' => 'error',
                'message' => 'Teléfono y nombre requeridos (o un paciente_id válido del directorio)',
            ]);
        }

        if ($pacienteId === null) {
            // Resolver aunque WRITE_IDS esté off (igual que profesional_id): IDs en paralelo.
            try {
                $res = kinesica_rel_resolve_paciente($pdo, [
                    'phone' => $phone,
                    'nombre' => $nombre,
                ], ['ignore_flag' => true]);
                if (($res['status'] ?? '') === 'matched' && !empty($res['paciente_id'])) {
                    $pacienteId = (int) $res['paciente_id'];
                } elseif (kinesica_rel_write_ids()) {
                    kinesica_rel_resolve_paciente_id_or_note($pdo, 'lista_espera', [
                        'phone' => $phone,
                        'nombre' => $nombre,
                    ]);
                }
            } catch (Throwable $e) {
                error_log('kinesica waitlist resolve paciente: ' . $e->getMessage());
                $pacienteId = null;
            }
        }
        try {
            $profesionalId = kinesica_rel_resolve_profesional_id(
                $pdo,
                (string) $profesional,
                ['ignore_flag' => true]
            );
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
            $stmt = $pdo->prepare("INSERT INTO lista_espera ({$cols}) VALUES ({$vals})");
            $stmt->execute($params);
        } else {
            $stmt = $pdo->prepare('
                INSERT INTO lista_espera (paciente_telefono, paciente_nombre, rango_horario_preferido, dias_preferidos, profesional, estado)
                VALUES (:tel, :nom, :hor, :dias, :prof, "activa")
            ');
            $stmt->execute(['tel' => $phone, 'nom' => $nombre, 'hor' => $horario, 'dias' => $dias, 'prof' => $profesional]);
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
            // REL: preferir paciente_id (cambio de teléfono no pierde el vínculo).
            require_once __DIR__ . '/lib_migrations.php';
            if (kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id')) {
                $pdo->prepare(
                    'UPDATE lista_espera SET estado = "asignado" WHERE paciente_id = :pid AND estado = "activa"'
                )->execute(['pid' => $pacienteId]);
            } elseif ($phone !== '') {
                $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel')->execute(['tel' => $phone]);
            }
        } elseif ($phone !== '') {
            // Fallback legacy por teléfono; si hay paciente_id en filas, también marcarlas.
            require_once __DIR__ . '/lib_migrations.php';
            $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel')->execute(['tel' => $phone]);
            if (kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id')) {
                try {
                    require_once __DIR__ . '/lib_relational_resolve.php';
                    $resolved = kinesica_rel_resolve_paciente($pdo, ['phone' => $phone], ['ignore_flag' => true]);
                    if (($resolved['status'] ?? '') === 'matched' && !empty($resolved['paciente_id'])) {
                        $pdo->prepare(
                            'UPDATE lista_espera SET estado = "asignado"
                             WHERE paciente_id = :pid AND estado = "activa"'
                        )->execute(['pid' => (int) $resolved['paciente_id']]);
                    }
                } catch (Throwable $e) {
                    error_log('kinesica waitlist_remove resolve: ' . $e->getMessage());
                }
            }
        }
        json_out(200, ['status' => 'success']);
    }
}
