<?php
/**
 * Auto-registro y actualización de paciente en MySQL desde api/send-confirmation.php.
 */

function kinesica_confirmation_upsert_patient(array $data, string $paciente, string $email, string $profesional, string $servicio): void
{
    $rawPhone = trim((string) ($data['telefono'] ?? ''));
    if ($rawPhone === '') {
        return;
    }

    try {
        require_once __DIR__ . '/../admin/api/lib.php';
        $db = db();

        // Auto-migración en caso de que la columna email aún no exista
        $cols = $db->query("SHOW COLUMNS FROM pacientes")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('email', $cols, true)) {
            $db->exec("ALTER TABLE pacientes ADD email VARCHAR(120) DEFAULT NULL AFTER dni");
            $db->exec("ALTER TABLE pacientes ADD INDEX idx_pacientes_email (email)");
        }

        @require_once dirname(__DIR__) . '/admin/api/pacientes_helpers.php';
        $phone = function_exists('clean_phone_number')
            ? clean_phone_number($rawPhone)
            : (preg_replace('/[^0-9]/', '', $rawPhone) ?? '');

        if (strlen($phone) < 6 || preg_match('/^(\d)\1+$/', $phone)) {
            return;
        }

        $fullName = mb_substr(sanitize_patient_name($paciente), 0, 120, 'UTF-8');
        $parts = preg_split('/\s+/u', $fullName, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nom = mb_substr($parts[0] ?? $fullName, 0, 60, 'UTF-8');
        $ape = mb_substr($parts[1] ?? '', 0, 60, 'UTF-8');
        $pila = function_exists('extract_first_name') ? extract_first_name($fullName) : $nom;
        $dniVal = !empty($data['dni']) && trim((string) $data['dni']) !== 'No provisto'
            ? mb_substr(trim((string) $data['dni']), 0, 20, 'UTF-8')
            : null;
        $motivoVal = !empty($data['motivo'])
            ? mb_substr(trim((string) $data['motivo']), 0, 255, 'UTF-8')
            : (!empty($servicio) ? mb_substr($servicio, 0, 255, 'UTF-8') : null);

        $profVal = 'indistinto';
        if (stripos($profesional, 'Norberto') !== false) {
            $profVal = 'norberto';
        } elseif (stripos($profesional, 'Mar') !== false) {
            $profVal = 'maria';
        }

        $contactoNombre = !empty($data['contactoNombre'])
            ? mb_substr(sanitize_patient_name((string) $data['contactoNombre']), 0, 120, 'UTF-8')
            : (!empty($data['contacto_nombre']) ? mb_substr(sanitize_patient_name((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null);
        $contactoTelRaw = !empty($data['contactoTelefono'])
            ? (string) $data['contactoTelefono']
            : (!empty($data['contacto_telefono']) ? (string) $data['contacto_telefono'] : '');
        $contactoTel = $contactoTelRaw !== ''
            ? (function_exists('clean_phone_number') ? clean_phone_number($contactoTelRaw) : (preg_replace('/[^0-9]/', '', $contactoTelRaw) ?? ''))
            : null;
        if ($contactoTel === '') {
            $contactoTel = null;
        }
        $contactoNotas = !empty($data['contactoNotas'])
            ? mb_substr(trim((string) $data['contactoNotas']), 0, 100, 'UTF-8')
            : (!empty($data['contacto_notas']) ? mb_substr(trim((string) $data['contacto_notas']), 0, 100, 'UTF-8') : null);

        $existing = null;
        if (function_exists('find_existing_patient_match')) {
            try {
                $existing = find_existing_patient_match($db, $phone, $fullName, $dniVal);
                if ($existing && function_exists('is_placeholder_phone') && is_placeholder_phone((string) ($existing['telefono'] ?? ''))) {
                    $existingId = (int) $existing['id'];
                    if (function_exists('kinesica_pacientes_release_soft_deleted_phone')) {
                        kinesica_pacientes_release_soft_deleted_phone($db, $phone, $existingId);
                    }
                    $db->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id')
                        ->execute(['tel' => $phone, 'id' => $existingId]);
                }
            } catch (Throwable) {
            }
        }

        $revivedSoft = false;
        if (function_exists('kinesica_pacientes_find_soft_deleted_by_phone')) {
            $softRow = kinesica_pacientes_find_soft_deleted_by_phone($db, $phone);
            if ($softRow && empty($existing)) {
                $db->prepare(
                    'UPDATE pacientes SET
                        deleted_at = NULL,
                        nombre = CASE WHEN :nom != "" THEN :nom2 ELSE nombre END,
                        apellido = CASE WHEN :ape != "" THEN :ape2 ELSE apellido END,
                        nombre_completo = :full,
                        nombre_pila = :pila,
                        dni = COALESCE(:dni, dni),
                        email = CASE WHEN email IS NULL OR email = "" THEN :email ELSE email END,
                        profesional_habitual = CASE WHEN :prof != "indistinto" THEN :prof2 ELSE profesional_habitual END,
                        motivo_consulta = COALESCE(:motivo, motivo_consulta),
                        contacto_nombre = COALESCE(:cnom, contacto_nombre),
                        contacto_telefono = COALESCE(:ctel, contacto_telefono),
                        contacto_notas = COALESCE(:cnot, contacto_notas)
                     WHERE id = :id'
                )->execute([
                    'nom' => $nom, 'nom2' => $nom, 'ape' => $ape, 'ape2' => $ape,
                    'full' => $fullName, 'pila' => $pila, 'dni' => $dniVal, 'email' => $email,
                    'prof' => $profVal, 'prof2' => $profVal, 'motivo' => $motivoVal,
                    'cnom' => $contactoNombre, 'ctel' => $contactoTel, 'cnot' => $contactoNotas,
                    'id' => (int) $softRow['id'],
                ]);
                $revivedSoft = true;
            }
        }

        if (!$revivedSoft) {
            $hasDeletedAt = in_array('deleted_at', $cols, true);
            $reviveOnDup = $hasDeletedAt ? ', deleted_at = NULL' : '';
            $stmtUpsert = $db->prepare("
                INSERT INTO pacientes (
                    telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email, profesional_habitual, motivo_consulta, origen,
                    contacto_nombre, contacto_telefono, contacto_notas
                ) VALUES (
                    :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :email, :profesional, :motivo, \"web\",
                    :contacto_nombre, :contacto_telefono, :contacto_notas
                )
                ON DUPLICATE KEY UPDATE
                    nombre = CASE WHEN VALUES(nombre) != \"\" THEN VALUES(nombre) ELSE nombre END,
                    apellido = CASE WHEN VALUES(apellido) != \"\" THEN VALUES(apellido) ELSE apellido END,
                    nombre_completo = VALUES(nombre_completo),
                    nombre_pila = VALUES(nombre_pila),
                    dni = COALESCE(VALUES(dni), dni),
                    email = CASE WHEN email IS NULL OR email = \"\" THEN VALUES(email) ELSE email END,
                    profesional_habitual = CASE WHEN VALUES(profesional_habitual) != \"indistinto\" THEN VALUES(profesional_habitual) ELSE profesional_habitual END,
                    motivo_consulta = COALESCE(VALUES(motivo_consulta), motivo_consulta),
                    contacto_nombre = COALESCE(VALUES(contacto_nombre), contacto_nombre),
                    contacto_telefono = COALESCE(VALUES(contacto_telefono), contacto_telefono),
                    contacto_notas = COALESCE(VALUES(contacto_notas), contacto_notas)
                    {$reviveOnDup}
            ");
            $stmtUpsert->execute([
                'telefono' => $phone, 'nombre' => $nom, 'apellido' => $ape,
                'nombre_completo' => $fullName, 'nombre_pila' => $pila, 'dni' => $dniVal,
                'email' => $email, 'profesional' => $profVal, 'motivo' => $motivoVal,
                'contacto_nombre' => $contactoNombre, 'contacto_telefono' => $contactoTel, 'contacto_notas' => $contactoNotas,
            ]);
        }
    } catch (Throwable $e) {
        error_log('kinesica send-confirmation auto-paciente error: ' . $e->getMessage());
    }
}
