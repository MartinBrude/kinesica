<?php
declare(strict_types=1);


/**
 * @param list<array> $items ya normalizados
 * @return array{stored:int,duplicates:int,failed:int}
 */
function recordatorios_store_items(array $items, ?PDO $pdo = null): array
{
    $res = ['stored' => 0, 'duplicates' => 0, 'failed' => 0];
    try {
        $pdo = recordatorios_pdo($pdo);
        recordatorios_ensure_schema($pdo);
        foreach ($items as $ev) {
            $cal = (string) ($ev['calendar_event_id'] ?? '');
            // Si admin ya cargó WhatsApp en un pending, no pisarlo con un missing_phone vacío de n8n.
            if (
                $cal !== '' &&
                $cal !== '_run' &&
                ($ev['wa_id'] ?? '') === '' &&
                in_array((string) ($ev['status'] ?? ''), ['missing_phone', 'failed', 'skipped', 'pending'], true)
            ) {
                try {
                    $keptStmt = $pdo->prepare(
                        'SELECT wa_id FROM recordatorio_eventos
                         WHERE calendar_event_id = :cal AND wa_id IS NOT NULL AND wa_id != ""
                         ORDER BY id DESC LIMIT 1'
                    );
                    $keptStmt->execute(['cal' => $cal]);
                    $keptWa = $keptStmt->fetchColumn();
                    if (is_string($keptWa) && $keptWa !== '') {
                        if (($ev['status'] ?? '') === 'missing_phone') {
                            // Contacto manual ya resuelve el caso: no insertar otro missing_phone vacío.
                            $res['duplicates']++;
                            continue;
                        }
                        $ev['wa_id'] = substr($keptWa, 0, 32);
                    }
                } catch (Throwable $keepEx) {
                }
            }
            if ($ev['status'] !== 'pending' && $cal !== '' && $cal !== '_run') {
                try {
                    // Preservar pending con WhatsApp cargado a mano; solo limpiar pending vacíos.
                    $pdo->prepare(
                        'DELETE FROM recordatorio_eventos
                         WHERE calendar_event_id = :cal AND status = "pending"
                           AND (wa_id IS NULL OR wa_id = "")'
                    )->execute(['cal' => $cal]);
                } catch (Throwable $delEx) {
                }
            }
            $outcome = recordatorios_insert_item($pdo, $ev);
            $res[$outcome === 'stored' ? 'stored' : 'duplicates']++;

            // Auto-sincronización con el directorio de pacientes (teléfono/DNI + nombre).
            $rawName = trim((string) ($ev['patient_name'] ?? ''));
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
            $hasIdentity = ($rawPhone !== '' && strlen($rawPhone) >= 6 && strlen($rawPhone) <= 16) || $rawDni !== '';
            if ($hasIdentity && $rawName !== '' && $rawName !== 'Estimado/a paciente' && $rawName !== 'Paciente') {
                if (!function_exists('is_tk3_or_blocked_name') || !is_tk3_or_blocked_name($rawName)) {
                    try {
                        ensure_pacientes_tables($pdo);
                        $existing = function_exists('find_existing_patient_match')
                            ? find_existing_patient_match(
                                $pdo,
                                $rawPhone !== '' ? $rawPhone : null,
                                $rawName,
                                $rawDni !== '' ? $rawDni : null
                            )
                            : null;

                        $profInferred = function_exists('infer_practitioner_from_schedule')
                            ? infer_practitioner_from_schedule(
                                (string) ($ev['appointment_date'] ?? ''),
                                (string) ($ev['appointment_time'] ?? ''),
                                (string) (($ev['event_summary'] ?? '') . ' ' . ($ev['creator'] ?? ''))
                            )
                            : 'indistinto';

                        if ($existing) {
                            $existingId = (int) $existing['id'];
                            $updates = [];
                            $params = ['id' => $existingId];
                            if (
                                $rawPhone !== ''
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
                            if (!empty($updates)) {
                                $pdo->prepare('UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id')->execute($params);
                            }
                        } else {
                            $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($rawName) : $rawName;
                            $parts = preg_split('/\s+/u', $cleanNom, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                            $nom = $parts[0] ?? $cleanNom;
                            $ape = $parts[1] ?? '';
                            $pila = function_exists('extract_first_name') ? extract_first_name($cleanNom) : $nom;
                            $tel = $rawPhone !== '' ? $rawPhone : ('sin-tel-dni-' . substr($rawDni, 0, 18));

                            $stmtPac = $pdo->prepare(
                                'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, origen)
                                 VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, "admin")
                                 ON DUPLICATE KEY UPDATE
                                    nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
                                    apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
                                    nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
                                    nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END,
                                    dni = COALESCE(dni, VALUES(dni)),
                                    profesional_habitual = CASE WHEN profesional_habitual = "indistinto" AND VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END'
                            );
                            $stmtPac->execute([
                                'tel' => $tel,
                                'nombre' => mb_substr($nom, 0, 60, 'UTF-8'),
                                'apellido' => mb_substr($ape, 0, 60, 'UTF-8'),
                                'full' => mb_substr($cleanNom, 0, 120, 'UTF-8'),
                                'pila' => mb_substr($pila, 0, 60, 'UTF-8'),
                                'dni' => $rawDni !== '' ? mb_substr($rawDni, 0, 20, 'UTF-8') : null,
                                'prof' => $profInferred,
                            ]);
                        }
                    } catch (Throwable $pacEx) {
                    }
                }
            }
        }
    } catch (Throwable $e) {
        error_log('recordatorios store: ' . $e->getMessage());
        $res['failed'] = count($items) - $res['stored'] - $res['duplicates'];
    }
    return $res;
}


function recordatorios_find_item_by_id(int $id, ?PDO $pdo = null): ?array
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT * FROM recordatorio_eventos WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}


function recordatorios_update_outcome(int $id, array $updates, ?PDO $pdo = null): bool
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $existing = recordatorios_find_item_by_id($id, $pdo);
    if (!$existing) {
        return false;
    }
    $allowed = ['status', 'wa_id', 'error_code', 'error_message', 'run_at', 'received_at', 'event_key'];
    $set = [];
    $params = ['id' => $id];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $updates)) {
            $set[] = "$f = :$f";
            $params[$f] = $updates[$f];
        }
    }
    if (!$set) {
        return false;
    }
    $sql = 'UPDATE recordatorio_eventos SET ' . implode(', ', $set) . ' WHERE id = :id';
    return $pdo->prepare($sql)->execute($params);
}
