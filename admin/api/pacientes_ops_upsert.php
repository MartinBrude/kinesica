<?php
declare(strict_types=1);

/**
 * Upsert pacientes (merge + insert).
 */
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

    kinesica_pacientes_upsert_insert(
        $pdo, $phone, $nombre, $apellido, $nombreCompleto, $nombrePila, $dni, $email, $profesional,
        $motivo, $notas, $origen, $contactoNombre, $contactoTel, $contactoEmail, $contactoNotas, $dejoReview
    );
}

