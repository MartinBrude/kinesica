<?php
declare(strict_types=1);


/**
 * Guarda teléfono/email en el directorio de pacientes (sin cortar la request).
 *
 * @return array{ok:bool, phone?:string, email?:string, error?:string}
 */
function recordatorios_persist_directory_contact(string $patientName, string $phone, string $email): array
{
    $phone = recordatorios_normalize_phone_input($phone);
    $email = strtolower(trim($email));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'El correo electrónico no es válido'];
    }
    if ($phone === '' && $email === '') {
        return ['ok' => false, 'error' => 'Ingresá un teléfono o un correo'];
    }

    $name = trim($patientName);
    if ($name === '') {
        $name = 'Paciente';
    }
    if (is_tk3_or_blocked_name($name)) {
        return ['ok' => false, 'error' => 'El contacto no corresponde a un paciente válido'];
    }
    $parts = preg_split('/\s+/u', $name, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    $nombre = $parts[0] ?? $name;
    $apellido = $parts[1] ?? '';

    try {
        $pdo = recordatorios_pdo();
        ensure_pacientes_tables($pdo);

        if ($phone !== '') {
            if (strlen($phone) < 6 || strlen($phone) > 16) {
                return ['ok' => false, 'error' => 'Número de WhatsApp inválido o incompleto'];
            }
            $existing = function_exists('find_existing_patient_match')
                ? find_existing_patient_match($pdo, $phone, $name)
                : null;

            if ($existing) {
                $existingId = (int) $existing['id'];
                $targetPhone = function_exists('kinesica_resolve_merge_phone')
                    ? kinesica_resolve_merge_phone($pdo, $existing, $phone)
                    : $phone;
                // Cargar WhatsApp desde recordatorios debe reflejarse en el directorio.
                try {
                    if ($targetPhone !== '' && $targetPhone !== (string) ($existing['telefono'] ?? '')) {
                        $pdo->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id')
                            ->execute(['tel' => $targetPhone, 'id' => $existingId]);
                    }
                } catch (Throwable $dup) {
                    error_log('recordatorios persist contact phone collision: ' . $dup->getMessage());
                }
                if ($email !== '' && empty($existing['email'])) {
                    $pdo->prepare('UPDATE pacientes SET email = :email WHERE id = :id')
                        ->execute(['email' => $email, 'id' => $existingId]);
                }
                error_log('recordatorios persist contact merged id=' . $existingId . ' phone=' . $targetPhone);
                return ['ok' => true, 'phone' => $targetPhone !== '' ? $targetPhone : $phone, 'email' => $email, 'id' => $existingId];
            }

            // En colisión de teléfono: NO pisar nombre de un paciente existente; solo completar vacíos y email.
            $stmt = $pdo->prepare(
                'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, email, origen)
                 VALUES (:tel, :nombre, :apellido, :full, :pila, :email, :origen)
                 ON DUPLICATE KEY UPDATE
                    email = COALESCE(VALUES(email), email),
                    nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                    apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                    nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                    nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END'
            );
            $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($nombre) : $nombre;
            $cleanApe = function_exists('sanitize_patient_name') ? sanitize_patient_name($apellido) : $apellido;
            $cleanFull = function_exists('sanitize_patient_name') ? sanitize_patient_name($name) : $name;
            $stmt->execute([
                'tel' => $phone,
                'nombre' => mb_substr($cleanNom, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($cleanApe, 0, 60, 'UTF-8'),
                'full' => mb_substr($cleanFull, 0, 120, 'UTF-8'),
                'pila' => mb_substr($cleanNom !== '' ? $cleanNom : $nombre, 0, 60, 'UTF-8'),
                'email' => $email !== '' ? $email : null,
                'origen' => 'admin',
            ]);
            $newId = (int) $pdo->lastInsertId();
            if ($newId <= 0) {
                $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
                $find->execute(['tel' => $phone]);
                $newId = (int) ($find->fetchColumn() ?: 0);
            }
            error_log('recordatorios persist contact inserted id=' . $newId . ' phone=' . $phone);
            // No correr deduplicate_pacientes_table acá: es O(n) sobre todo el directorio
            // y en la carga manual de WhatsApp puede colgar/timeout el request.
            return ['ok' => true, 'phone' => $phone, 'email' => $email, 'id' => $newId];
        }

        // Solo email: actualizar paciente existente por nombre o crear placeholder no es posible sin teléfono único.
        $stmt = $pdo->prepare(
            'UPDATE pacientes SET email = :email
             WHERE LOWER(nombre_completo) = LOWER(:full) AND (email IS NULL OR email = "")
             LIMIT 1'
        );
        $stmt->execute(['email' => $email, 'full' => $name]);
        if ($stmt->rowCount() < 1) {
            $stmt2 = $pdo->prepare(
                'UPDATE pacientes SET email = :email WHERE LOWER(nombre_completo) = LOWER(:full) LIMIT 1'
            );
            $stmt2->execute(['email' => $email, 'full' => $name]);
            if ($stmt2->rowCount() < 1) {
                return [
                    'ok' => false,
                    'error' => 'Para guardar solo el mail, el paciente debe existir en el directorio o cargá también un WhatsApp',
                ];
            }
        }
        return ['ok' => true, 'phone' => '', 'email' => $email];
    } catch (Throwable $e) {
        error_log('recordatorios persist contact: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'No se pudo guardar el contacto en el directorio'];
    }
}

/**
 * Actualiza el recordatorio con el contacto cargado desde el admin.
 *
 * @return array{ok:bool, item?:array, message?:string, error?:string, directory?:array}
 */

/**
 * Actualiza el recordatorio con el contacto cargado desde el admin.
 *
 * @return array{ok:bool, item?:array, message?:string, error?:string, directory?:array}
 */
function recordatorios_save_contact(int $id, array $input, array $auth): array
{
    $item = recordatorios_find_item_by_id($id);
    if (!$item) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado'];
    }

    $rawPhone = trim((string) ($input['wa_id'] ?? $input['phone'] ?? ''));
    $phone = recordatorios_normalize_phone_input($rawPhone);
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'El correo electrónico no es válido'];
    }
    if ($phone === '' && $email === '') {
        return ['ok' => false, 'error' => 'Ingresá un número de WhatsApp o un correo electrónico'];
    }

    // Validar WhatsApp acá para fallar claro antes de tocar directorio/recordatorio.
    if ($phone !== '' && (strlen($phone) < 6 || strlen($phone) > 16)) {
        return ['ok' => false, 'error' => 'Número de WhatsApp inválido o incompleto'];
    }

    // 1) Primero el recordatorio (lo que el usuario ve). El directorio es secundario.
    $updates = [];
    if ($phone !== '') {
        $updates['wa_id'] = $phone;
    }
    $user = preg_replace('/[^\p{L}\p{N}._@\-\s]/u', '', (string) ($auth['username'] ?? $auth['name'] ?? 'admin')) ?: 'admin';
    $user = mb_substr($user, 0, 40, 'UTF-8');
    $status = (string) ($item['status'] ?? '');
    $prevErr = (string) ($item['error_message'] ?? '');
    if ($email !== '') {
        // Guardar email en el registro sin borrar el error Meta de un fallo previo.
        if (in_array($status, ['pending', 'missing_phone', 'skipped'], true)) {
            $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
        } elseif ($status === 'failed') {
            if (str_starts_with($prevErr, 'contact_email:')) {
                $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
            } elseif ($prevErr === '') {
                $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
            }
            // Si había un error Meta, se conserva; el email queda en el directorio / campo email de la vista.
        }
    } elseif ($phone !== '' && str_starts_with($prevErr, 'contact_email:')) {
        $updates['error_message'] = 'WhatsApp cargado por ' . $user;
    }

    if ($status === 'missing_phone' && ($phone !== '' || $email !== '')) {
        $updates['status'] = 'pending';
        $updates['error_code'] = '';
        if ($phone !== '' && empty($updates['error_message'])) {
            $updates['error_message'] = 'Contacto cargado por ' . $user;
        }
    }

    if ($updates) {
        $saved = recordatorios_update_outcome($id, $updates);
        if (!$saved) {
            return ['ok' => false, 'error' => 'No se pudo actualizar el recordatorio'];
        }
    }

    // 2) Directorio (best-effort): no debe tumbar la carga del WhatsApp en el turno.
    $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: ''));
    $dir = recordatorios_persist_directory_contact($patientName, $phone, $email);
    $dirOk = !empty($dir['ok']);

    $updated = recordatorios_find_item_by_id($id);
    $viewItem = recordatorios_format_item($updated ?: $item, $email !== '' ? $email : null);
    if ($phone !== '') {
        $viewItem['wa_id'] = $phone;
    }
    if ($email !== '') {
        $viewItem['email'] = $email;
    }

    $parts = [];
    if ($phone !== '') {
        $parts[] = 'WhatsApp ' . $phone;
    }
    if ($email !== '') {
        $parts[] = 'email ' . $email;
    }
    $msg = 'Contacto guardado (' . implode(' · ', $parts) . ') en este recordatorio';
    $msg .= $dirOk ? ' y en el directorio de pacientes.' : '.';
    if (!$dirOk && !empty($dir['error'])) {
        $msg .= ' Aviso: ' . $dir['error'] . '.';
    }
    return [
        'ok' => true,
        'status' => 'success',
        'message' => $msg,
        'item' => $viewItem,
        'directory' => $dir,
    ];
}

