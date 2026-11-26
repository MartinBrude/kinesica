<?php
declare(strict_types=1);

/**
 * Alta/actualización en directorio pacientes desde un outcome de recordatorio.
 * Con teléfono/DNI reales, o placeholder sin-tel-cal-* si solo hay nombre (badge "Sin teléfono").
 */
function recordatorios_sync_paciente_from_event(array $ev, PDO $pdo): void
{
    $rawName = trim((string) ($ev['patient_name'] ?? ''));
    if ($rawName === '' || $rawName === 'Estimado/a paciente' || $rawName === 'Paciente') {
        return;
    }
    if (function_exists('is_tk3_or_blocked_name') && is_tk3_or_blocked_name($rawName)) {
        return;
    }

    $rawPhone = clean_phone_number((string) ($ev['wa_id'] ?? ''));
    $rawDni = clean_patient_dni((string) ($ev['dni'] ?? ''));
    if ($rawDni === '' || $rawPhone === '') {
        $parsedContact = kinesica_extract_calendar_contacts(
            trim($rawName . ' ' . (string) ($ev['event_summary'] ?? '')),
            (string) ($ev['event_description'] ?? '')
        );
        if ($rawPhone === '' && $parsedContact['phone'] !== '') {
            $rawPhone = $parsedContact['phone'];
        }
        if ($rawDni === '' && $parsedContact['dni'] !== '') {
            $rawDni = $parsedContact['dni'];
        }
    }

    $hasRealPhone = $rawPhone !== '' && strlen($rawPhone) >= 6 && strlen($rawPhone) <= 16
        && (!function_exists('is_placeholder_phone') || !is_placeholder_phone($rawPhone));
    $status = (string) ($ev['status'] ?? '');
    $needsPlaceholder = !$hasRealPhone && $rawDni === ''
        && in_array($status, ['missing_phone', 'pending'], true);

    if (!$hasRealPhone && $rawDni === '' && !$needsPlaceholder) {
        return;
    }

    ensure_pacientes_tables($pdo);
    $existing = function_exists('find_existing_patient_match')
        ? find_existing_patient_match(
            $pdo,
            $hasRealPhone ? $rawPhone : null,
            $rawName,
            $rawDni !== '' ? $rawDni : null
        )
        : null;

    if ($existing && function_exists('kinesica_names_compatible')) {
        $candName = (string) ($existing['nombre_completo'] ?? trim(($existing['nombre'] ?? '') . ' ' . ($existing['apellido'] ?? '')));
        if ($candName !== '' && !kinesica_names_compatible($rawName, $candName)) {
            // Teléfono compartido (cónyuge/familiar): buscar si existe el paciente por nombre
            $existing = function_exists('kinesica_match_patient')
                ? kinesica_match_patient($pdo, ['name' => $rawName], 'strict')
                : null;
        }
    }

    $profInferred = function_exists('infer_practitioner_from_schedule')
        ? infer_practitioner_from_schedule(
            (string) ($ev['appointment_date'] ?? ''),
            (string) ($ev['appointment_time'] ?? ''),
            (string) (($ev['event_summary'] ?? '') . ' ' . ($ev['creator'] ?? ''))
        )
        : 'indistinto';

    $cal = trim((string) ($ev['calendar_event_id'] ?? ''));
    $nameSeed = function_exists('canonical_patient_name_key')
        ? canonical_patient_name_key($rawName)
        : mb_strtolower($rawName, 'UTF-8');
    if ($nameSeed === '') {
        $nameSeed = $cal !== '' && $cal !== '_run' ? $cal : 'desconocido';
    }

    $tel = $hasRealPhone
        ? $rawPhone
        : ($rawDni !== ''
            ? 'sin-tel-dni-' . substr($rawDni, 0, 18)
            : 'sin-tel-cal-' . substr(md5($nameSeed), 0, 18));

    // Si el teléfono real ya está ocupado por otro paciente con nombre incompatible (ej. cónyuge/familiar),
    // usar placeholder para no colisionar con la restricción UNIQUE de MySQL.
    if ($hasRealPhone && !$existing) {
        $stmtOther = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel LIMIT 1');
        $stmtOther->execute(['tel' => $rawPhone]);
        $rowOther = $stmtOther->fetch(PDO::FETCH_ASSOC);
        if ($rowOther && function_exists('kinesica_names_compatible')) {
            $otherName = (string) ($rowOther['nombre_completo'] ?? '');
            if ($otherName !== '' && !kinesica_names_compatible($rawName, $otherName)) {
                $tel = 'sin-tel-cal-' . substr(md5($nameSeed), 0, 18);
            }
        }
    }

    if ($existing) {
        $existingId = (int) $existing['id'];
        $updates = [];
        $params = ['id' => $existingId];
        if (
            $hasRealPhone
            && function_exists('is_placeholder_phone')
            && is_placeholder_phone((string) ($existing['telefono'] ?? ''))
        ) {
            $updates[] = 'telefono = :tel';
            $params['tel'] = $rawPhone;
        }
        if ($rawDni !== '' && clean_patient_dni((string) ($existing['dni'] ?? '')) === '') {
            $updates[] = 'dni = :dni';
            $params['dni'] = mb_substr($rawDni, 0, 20, 'UTF-8');
        }
        if (($existing['profesional_habitual'] ?? 'indistinto') === 'indistinto' && $profInferred !== 'indistinto') {
            $updates[] = 'profesional_habitual = :prof';
            $params['prof'] = $profInferred;
        }
        if ($updates) {
            $pdo->prepare('UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id')->execute($params);
        }
        return;
    }

    $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($rawName) : $rawName;
    if (function_exists('kinesica_correct_inverted_patient_name')) {
        $cleanNom = kinesica_correct_inverted_patient_name($cleanNom);
    }
    $parts = preg_split('/\s+/u', $cleanNom, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    $nom = $parts[0] ?? $cleanNom;
    $ape = $parts[1] ?? '';
    $pila = function_exists('extract_first_name') ? extract_first_name($cleanNom) : $nom;

    $pdo->prepare(
        'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, origen)
         VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, "admin")
         ON DUPLICATE KEY UPDATE
            nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
            apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
            nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
            nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END,
            dni = COALESCE(dni, VALUES(dni)),
            profesional_habitual = CASE WHEN profesional_habitual = "indistinto" AND VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END'
    )->execute([
        'tel' => mb_substr($tel, 0, 30, 'UTF-8'),
        'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
        'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
        'full' => mb_substr($cleanNom, 0, 120, 'UTF-8'),
        'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
        'dni' => $rawDni !== '' ? mb_substr($rawDni, 0, 20, 'UTF-8') : null,
        'prof' => $profInferred,
    ]);

    $newId = (int) $pdo->lastInsertId();
    if ($newId <= 0) {
        $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
        $find->execute(['tel' => mb_substr($tel, 0, 30, 'UTF-8')]);
        $newId = (int) ($find->fetchColumn() ?: 0);
    }
    if ($newId > 0) {
        require_once __DIR__ . '/pacientes_helpers_dedupe_schedule.php';
        kinesica_pacientes_try_dedupe_after_create($pdo, $newId);
    }
}
