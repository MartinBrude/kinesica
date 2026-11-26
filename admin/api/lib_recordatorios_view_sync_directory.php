<?php
declare(strict_types=1);

/**
 * Sincroniza un ítem de recordatorio con la tabla `pacientes` si falta en el directorio.
 *
 * @param array<string,mixed> $item
 * @param array<string,mixed> $r
 * @param array{by_phone:array<string,string>,by_name:array<string,string>,phone_by_name:array<string,string>} $directory
 */
function recordatorios_sync_item_to_directory(PDO $pdo, array $item, array $r, string $email, array &$directory): void
{
    if (empty($item['wa_id']) || empty($item['patient_name'])) {
        return;
    }
    $rawPhone = clean_phone_number((string) $item['wa_id']);
    $rawName = trim((string) $item['patient_name']);
    if (strlen($rawPhone) < 6 || strlen($rawPhone) > 16 || $rawName === '' || $rawName === 'Estimado/a paciente' || $rawName === 'Paciente') {
        return;
    }
    if (!function_exists('is_tk3_or_blocked_name') || is_tk3_or_blocked_name($rawName)) {
        return;
    }
    $phoneEndCheck = substr($rawPhone, -10);
    if (isset($directory['by_phone'][$phoneEndCheck])) {
        return;
    }

    try {
        ensure_pacientes_tables($pdo);
        $existing = function_exists('find_existing_patient_match')
            ? find_existing_patient_match($pdo, $rawPhone, $rawName)
            : null;

        if ($existing && function_exists('kinesica_names_compatible')) {
            $candName = (string) ($existing['nombre_completo'] ?? trim(($existing['nombre'] ?? '') . ' ' . ($existing['apellido'] ?? '')));
            if ($candName !== '' && !kinesica_names_compatible($rawName, $candName)) {
                $existing = function_exists('kinesica_match_patient')
                    ? kinesica_match_patient($pdo, ['name' => $rawName], 'strict')
                    : null;
            }
        }

        $profInferred = function_exists('infer_practitioner_from_schedule')
            ? infer_practitioner_from_schedule(
                (string) ($item['appointment_date'] ?? $r['appointment_date'] ?? ''),
                (string) ($item['appointment_time'] ?? $r['appointment_time'] ?? ''),
                (string) (($item['event_summary'] ?? $r['event_summary'] ?? '') . ' ' . ($item['creator'] ?? ''))
            )
            : 'indistinto';

        if ($existing) {
            $updates = [];
            $params = ['id' => (int) $existing['id']];
            if (function_exists('is_placeholder_phone') && is_placeholder_phone((string) ($existing['telefono'] ?? ''))) {
                $updates[] = 'telefono = :tel';
                $params['tel'] = $rawPhone;
            }
            if (($existing['profesional_habitual'] ?? 'indistinto') === 'indistinto' && $profInferred !== 'indistinto') {
                $updates[] = 'profesional_habitual = :prof';
                $params['prof'] = $profInferred;
            }
            if (!empty($updates)) {
                $pdo->prepare('UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id')->execute($params);
            }
        } else {
            $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($rawName) : $rawName;
            $parts = preg_split('/\s+/u', $cleanNom, 2, PREG_SPLIT_NO_EMPTY) ?: [];
            $nom = $parts[0] ?? $cleanNom;
            $ape = $parts[1] ?? '';
            $pila = function_exists('extract_first_name') ? extract_first_name($cleanNom) : $nom;

            $targetTel = $rawPhone;
            if (function_exists('kinesica_names_compatible')) {
                $stmtOther = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel LIMIT 1');
                $stmtOther->execute(['tel' => $rawPhone]);
                $rowOther = $stmtOther->fetch(PDO::FETCH_ASSOC);
                if ($rowOther) {
                    $otherName = (string) ($rowOther['nombre_completo'] ?? '');
                    if ($otherName !== '' && !kinesica_names_compatible($rawName, $otherName)) {
                        $targetTel = 'sin-tel-cal-' . substr(md5(canonical_patient_name_key($rawName)), 0, 18);
                    }
                }
            }

            $stmtPac = $pdo->prepare(
                'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, profesional_habitual, origen)
                 VALUES (:tel, :nombre, :apellido, :full, :pila, :prof, "admin")
                 ON DUPLICATE KEY UPDATE
                    nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                    apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                    nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                    nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END,
                    profesional_habitual = CASE WHEN profesional_habitual = "indistinto" AND VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END'
            );
            $stmtPac->execute([
                'tel' => $targetTel,
                'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
                'full' => mb_substr($cleanNom, 0, 120, 'UTF-8'),
                'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
                'prof' => $profInferred,
            ]);
        }
        $directory['by_phone'][$phoneEndCheck] = $email;
    } catch (Throwable $syncEx) {
        error_log('kinesica recordatorios view: directory sync: ' . $syncEx->getMessage());
    }
}
