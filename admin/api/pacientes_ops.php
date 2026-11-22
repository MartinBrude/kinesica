<?php
declare(strict_types=1);

require_once __DIR__ . '/pacientes_ops_upsert.php';
require_once __DIR__ . '/pacientes_ops_upsert_insert.php';
require_once __DIR__ . '/pacientes_ops_waitlist.php';

function kinesica_pacientes_update(PDO $pdo, array $data): void
{
    $id = (int) ($data['id'] ?? 0);
    require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
    $currentRow = kinesica_pacientes_require_alive($pdo, $id);

    $rawPhone = (string) ($data['telefono'] ?? '');
    $phone = clean_phone_number($rawPhone);
    $existingTel = (string) ($currentRow['telefono'] ?? '');

    if ($phone === '' && is_placeholder_phone($existingTel)) {
        $phone = $existingTel;
    } elseif (strlen($phone) < 6 || strlen($phone) > 16 || preg_match('/^(\d)\1+$/', $phone)) {
        json_out(422, ['status' => 'error', 'message' => 'Nombre, apellido y teléfono son obligatorios']);
    }

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

    if ($nombreCompleto === '') {
        json_out(422, ['status' => 'error', 'message' => 'Nombre, apellido y teléfono son obligatorios']);
    }

    if (is_tk3_or_blocked_name($nombreCompleto) || is_tk3_or_blocked_name($nombre)) {
        json_out(422, ['status' => 'error', 'message' => 'El nombre no corresponde a un paciente válido']);
    }

    if (!is_placeholder_phone($phone)) {
        // UNIQUE(telefono) incluye soft-deleted: cualquier otra fila bloquea.
        $check = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel AND id != :id LIMIT 1');
        $check->execute(['tel' => $phone, 'id' => $id]);
        $existing = $check->fetch();
        if ($existing) {
            json_out(409, [
                'status' => 'error',
                'message' => 'Ese teléfono ya está asignado a otro paciente',
                'conflict_id' => (int) $existing['id'],
            ]);
        }
    }

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

    $alive = kinesica_pacientes_alive_sql($pdo);
    $stmt = $pdo->prepare('
        UPDATE pacientes SET
            telefono = :tel, nombre = :nombre, apellido = :apellido, nombre_completo = :nom,
            nombre_pila = :pila, dni = :dni, email = :email, profesional_habitual = :prof,
            motivo_consulta = :motivo, notas = :notas, contacto_nombre = :contacto_nombre,
            contacto_telefono = :contacto_telefono, contacto_email = :contacto_email, contacto_notas = :contacto_notas' .
            ($dejoReview !== null ? ', dejo_review = :dejo_review' : '') . "
        WHERE id = :id AND ({$alive})
    ");
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
    // rowCount=0 si no hubo cambio de valores; solo 404 si ya no está activo.
    if ($stmt->rowCount() < 1 && !kinesica_pacientes_fetch_alive($pdo, $id)) {
        json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
    }

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
