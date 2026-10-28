<?php
declare(strict_types=1);

function kinesica_pacientes_upsert(PDO $pdo, array $data): void
{
    $rawPhone = (string) ($data['telefono'] ?? '');
    $phone = clean_phone_number($rawPhone);
    if (strlen($phone) < 6 || strlen($phone) > 16 || preg_match('/^(\d)\1+$/', $phone)) {
        json_out(422, ['status' => 'error', 'message' => 'Número de teléfono inválido o incompleto']);
    }

    $nombre = mb_substr(trim((string) ($data['nombre'] ?? '')), 0, 60, 'UTF-8');
    $apellido = mb_substr(trim((string) ($data['apellido'] ?? '')), 0, 60, 'UTF-8');
    $nombreCompleto = mb_substr(trim((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? '')), 0, 120, 'UTF-8');

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

    $nombrePila = mb_substr(trim((string) ($data['nombre_pila'] ?? '')), 0, 60, 'UTF-8');
    if ($nombrePila === '') $nombrePila = extract_first_name($nombreCompleto);

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
        ? mb_substr(trim((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null;
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

    $stmt = $pdo->prepare('
        INSERT INTO pacientes (
            telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email, profesional_habitual, 
            motivo_consulta, notas, origen, contacto_nombre, contacto_telefono, contacto_email, contacto_notas
        ) VALUES (
            :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :email, :profesional_habitual, 
            :motivo_consulta, :notas, :origen, :contacto_nombre, :contacto_telefono, :contacto_email, :contacto_notas
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
            contacto_notas = COALESCE(VALUES(contacto_notas), contacto_notas)
    ');

    $stmt->execute([
        'telefono' => $phone, 'nombre' => $nombre, 'apellido' => $apellido,
        'nombre_completo' => $nombreCompleto, 'nombre_pila' => $nombrePila,
        'dni' => $dni, 'email' => $email, 'profesional_habitual' => $profesional,
        'motivo_consulta' => $motivo, 'notas' => $notas, 'origen' => $origen,
        'contacto_nombre' => $contactoNombre, 'contacto_telefono' => $contactoTel,
        'contacto_email' => $contactoEmail, 'contacto_notas' => $contactoNotas,
    ]);

    json_out(200, [
        'status' => 'success', 'action' => 'upsert', 'phone' => $phone,
        'nombre' => $nombre, 'apellido' => $apellido, 'nombre_pila' => $nombrePila, 'email' => $email,
    ]);
}

function kinesica_pacientes_update(PDO $pdo, array $data): void
{
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);

    $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
    $nombre = mb_substr(trim((string) ($data['nombre'] ?? '')), 0, 60, 'UTF-8');
    $apellido = mb_substr(trim((string) ($data['apellido'] ?? '')), 0, 60, 'UTF-8');
    $nombreCompleto = mb_substr(trim((string) ($data['nombre_completo'] ?? '')), 0, 120, 'UTF-8');

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

    $check = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel AND id != :id');
    $check->execute(['tel' => $phone, 'id' => $id]);
    $existing = $check->fetch();
    if ($existing) {
        json_out(409, ['status' => 'error', 'message' => 'Ese teléfono ya está asignado al paciente ' . $existing['nombre_completo']]);
    }

    $nombrePila = extract_first_name($nombreCompleto);
    $dni = !empty($data['dni']) ? mb_substr(trim((string) $data['dni']), 0, 20, 'UTF-8') : null;
    $email = !empty($data['email']) ? trim((string) $data['email']) : null;
    if (!is_valid_email_strict($email)) {
        json_out(422, ['status' => 'error', 'message' => 'El formato del correo electrónico no es válido']);
    }
    $profesional = in_array($data['profesional_habitual'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional_habitual'] : 'indistinto';
    $motivo = !empty($data['motivo_consulta']) ? mb_substr(trim((string) $data['motivo_consulta']), 0, 255, 'UTF-8') : null;
    $notas = !empty($data['notas']) ? mb_substr(trim((string) $data['notas']), 0, 2000, 'UTF-8') : null;
    $contactoNombre = !empty($data['contacto_nombre']) ? mb_substr(trim((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null;
    $contactoTelRaw = (string) ($data['contacto_telefono'] ?? '');
    $contactoTel = $contactoTelRaw !== '' ? clean_phone_number($contactoTelRaw) : null;
    if ($contactoTel === '') $contactoTel = null;
    $contactoEmail = !empty($data['contacto_email']) ? trim((string) $data['contacto_email']) : null;
    if (!is_valid_email_strict($contactoEmail)) {
        json_out(422, ['status' => 'error', 'message' => 'El correo electrónico de contacto no es válido']);
    }
    $contactoNotas = !empty($data['contacto_notas']) ? mb_substr(trim((string) $data['contacto_notas']), 0, 100, 'UTF-8') : null;

    $stmt = $pdo->prepare('
        UPDATE pacientes SET
            telefono = :tel, nombre = :nombre, apellido = :apellido, nombre_completo = :nom,
            nombre_pila = :pila, dni = :dni, email = :email, profesional_habitual = :prof,
            motivo_consulta = :motivo, notas = :notas, contacto_nombre = :contacto_nombre,
            contacto_telefono = :contacto_telefono, contacto_email = :contacto_email, contacto_notas = :contacto_notas
        WHERE id = :id
    ');
    $stmt->execute([
        'tel' => $phone, 'nombre' => $nombre, 'apellido' => $apellido, 'nom' => $nombreCompleto,
        'pila' => $nombrePila, 'dni' => $dni, 'email' => $email, 'prof' => $profesional,
        'motivo' => $motivo, 'notas' => $notas, 'contacto_nombre' => $contactoNombre,
        'contacto_telefono' => $contactoTel, 'contacto_email' => $contactoEmail,
        'contacto_notas' => $contactoNotas, 'id' => $id,
    ]);

    json_out(200, ['status' => 'success', 'message' => 'Paciente actualizado con éxito']);
}

function kinesica_pacientes_waitlist_ops(PDO $pdo, string $action, array $data): void
{
    if ($action === 'waitlist_insert' || $action === 'insert_waitlist') {
        $phone = clean_phone_number((string) ($data['telefono'] ?? $data['paciente_telefono'] ?? ''));
        $nombre = trim((string) ($data['nombre'] ?? $data['paciente_nombre'] ?? ''));
        $horario = trim((string) ($data['rango_horario_preferido'] ?? ''));
        $dias = trim((string) ($data['dias_preferidos'] ?? ''));
        $profesional = in_array($data['profesional'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional'] : 'indistinto';

        if ($phone === '' || $nombre === '') {
            json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre requeridos']);
        }

        $stmt = $pdo->prepare('
            INSERT INTO lista_espera (paciente_telefono, paciente_nombre, rango_horario_preferido, dias_preferidos, profesional, estado)
            VALUES (:tel, :nom, :hor, :dias, :prof, "activa")
        ');
        $stmt->execute(['tel' => $phone, 'nom' => $nombre, 'hor' => $horario, 'dias' => $dias, 'prof' => $profesional]);
        json_out(200, ['status' => 'success', 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($action === 'waitlist_remove' || $action === 'remove_waitlist') {
        $id = (int) ($data['id'] ?? 0);
        $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
        if ($id > 0) {
            $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE id = :id')->execute(['id' => $id]);
        } elseif ($phone !== '') {
            $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel')->execute(['tel' => $phone]);
        }
        json_out(200, ['status' => 'success']);
    }
}
