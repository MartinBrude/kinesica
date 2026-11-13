<?php
declare(strict_types=1);


/**
 * Normaliza teléfono vía fuente de verdad compartida (no argentiniza extranjeros).
 */
function recordatorios_normalize_phone_input(string $raw): string
{
    if (function_exists('clean_phone_number')) {
        return clean_phone_number($raw);
    }
    return recordatorios_clean_wa_id($raw);
}


function recordatorios_is_test_case(array $item): bool
{
    $cal = (string) ($item['calendar_event_id'] ?? '');
    return str_starts_with($cal, 'test:');
}

/**
 * Crea (o reutiliza) un recordatorio pending configurable para probar el envío manual.
 *
 * @param array{patient_name?:string,phone?:string,wa_id?:string} $input
 * @return array{ok:bool,item?:array,created?:bool,error?:string,message?:string}
 */

/**
 * Crea (o reutiliza) un recordatorio pending configurable para probar el envío manual.
 *
 * @param array{patient_name?:string,phone?:string,wa_id?:string} $input
 * @return array{ok:bool,item?:array,created?:bool,error?:string,message?:string}
 */
function recordatorios_create_manual_test_case(array $auth, array $input = []): array
{
    $role = (string) ($auth['role'] ?? '');
    if ($role !== 'admin') {
        return ['ok' => false, 'error' => 'Solo admin puede crear el caso de prueba'];
    }

    $name = trim((string) ($input['patient_name'] ?? $input['name'] ?? ''));
    $rawPhone = (string) ($input['phone'] ?? $input['wa_id'] ?? '');
    $wa = recordatorios_normalize_phone_input($rawPhone);
    if ($name === '') {
        return ['ok' => false, 'error' => 'Ingresá el nombre del destinatario'];
    }
    if ($wa === '' || strlen($wa) < 8) {
        return ['ok' => false, 'error' => 'Ingresá un WhatsApp válido (con código de país)'];
    }

    try {
        $pdo = recordatorios_pdo();
        recordatorios_ensure_schema($pdo);

        // Reutilizar un pending de prueba aún no enviado al mismo número (evita acumular filas).
        $stmt = $pdo->prepare(
            'SELECT * FROM recordatorio_eventos
             WHERE calendar_event_id LIKE :pfx
               AND status = \'pending\'
               AND wa_id = :wa
             ORDER BY id DESC
             LIMIT 1'
        );
        $stmt->execute([
            'pfx' => 'test:%',
            'wa' => $wa,
        ]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            // Actualizar nombre si cambió en el formulario.
            if (trim((string) ($existing['patient_name'] ?? '')) !== $name) {
                $upd = $pdo->prepare(
                    'UPDATE recordatorio_eventos
                     SET patient_name = :name, event_summary = :summary
                     WHERE id = :id'
                );
                $upd->execute([
                    'name' => $name,
                    'summary' => '[PRUEBA] ' . $name,
                    'id' => (int) $existing['id'],
                ]);
                $existing['patient_name'] = $name;
                $existing['event_summary'] = '[PRUEBA] ' . $name;
            }
            $existingEmail = recordatorios_resolve_contact_email($wa, $name);
            return [
                'ok' => true,
                'created' => false,
                'message' => 'Ya tenés un caso de prueba pendiente para ese número. Usá «Enviar ahora».',
                'item' => recordatorios_format_item($existing, $existingEmail !== '' ? $existingEmail : null),
            ];
        }

        $tz = recordatorios_tz();
        $nowLocal = new DateTimeImmutable('now', $tz);
        $apptDate = $nowLocal->modify('+1 day')->format('Y-m-d');
        $apptTime = '11:00';
        $stamp = $nowLocal->format('Ymd-His');
        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($user !== '' ? $user : 'admin')) ?: 'admin';
        $calId = 'test:' . $slug . ':' . $stamp;
        $eventKey = 'test:' . $slug . ':' . bin2hex(random_bytes(8));
        $runAt = time();

        $ev = [
            'event_key' => $eventKey,
            'exec_id' => 'manual-test',
            'run_at' => $runAt,
            'appointment_date' => $apptDate,
            'appointment_time' => $apptTime,
            'calendar_event_id' => $calId,
            'patient_name' => $name,
            'wa_id' => $wa,
            'status' => 'pending',
            'skip_reason' => '',
            'error_code' => '',
            'error_message' => 'Caso de prueba manual',
            'event_summary' => '[PRUEBA] ' . $name,
        ];
        $outcome = recordatorios_insert_item($pdo, $ev);
        if ($outcome === 'duplicate') {
            return ['ok' => false, 'error' => 'No se pudo crear el caso de prueba (clave duplicada). Reintentá.'];
        }

        $created = recordatorios_find_item_by_id((int) $pdo->lastInsertId());
        if (!$created) {
            $q = $pdo->prepare('SELECT * FROM recordatorio_eventos WHERE event_key = :k LIMIT 1');
            $q->execute(['k' => $eventKey]);
            $created = $q->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if (!$created) {
            return ['ok' => false, 'error' => 'Se insertó el caso pero no se pudo releer'];
        }

        $createdEmail = recordatorios_resolve_contact_email($wa, $name);
        return [
            'ok' => true,
            'created' => true,
            'message' => 'Caso de prueba listo: ' . $name . ' · ' . $wa . '. Usá «Enviar ahora».',
            'item' => recordatorios_format_item($created, $createdEmail !== '' ? $createdEmail : null),
        ];
    } catch (Throwable $e) {
        error_log('recordatorios create_test_case: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'Error al crear el caso de prueba'];
    }
}

/**
 * Guarda teléfono/email en el directorio de pacientes (sin cortar la request).
 *
 * @return array{ok:bool, phone?:string, email?:string, error?:string}
 */
