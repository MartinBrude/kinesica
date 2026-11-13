<?php
declare(strict_types=1);

/**
 * Fragmento de calendar_backup ($action).
 */
    if ($action === 'book') {
        $stateSnapshot = kinesica_backup_read();
        if (!kinesica_backup_is_fresh($stateSnapshot)) {
            http_response_code(503);
            echo json_encode([
                'status' => 'error',
                'message' => 'El servicio de respaldo no está disponible en este momento.',
            ]);
            exit;
        }

        $dateStr = trim((string) ($params['date'] ?? ''));
        $timeStr = trim((string) ($params['time'] ?? ''));
        $nombre = mb_substr(trim((string) ($params['nombre'] ?? '')), 0, 120, 'UTF-8');
        $telefono = mb_substr(trim((string) ($params['telefono'] ?? '')), 0, 30, 'UTF-8');
        $email = mb_substr(trim((string) ($params['email'] ?? '')), 0, 120, 'UTF-8');
        $dni = mb_substr(trim((string) ($params['dni'] ?? 'No provisto')), 0, 30, 'UTF-8') ?: 'No provisto';
        $practitionerId = strtolower(trim((string) ($params['practitionerId'] ?? '')));
        $bookingRequestId = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($params['bookingRequestId'] ?? '')) ?? '';
        if ($bookingRequestId === '') {
            $bookingRequestId = 'bkp_' . time() . '_' . bin2hex(random_bytes(4));
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr) || !preg_match('/^([01]\d|2[0-3]):(00|30)$/', $timeStr)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Fecha y hora válidas son requeridas.']);
            exit;
        }
        if (mb_strlen($nombre, 'UTF-8') < 3) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nombre completo es requerido.']);
            exit;
        }
        $phoneDigits = preg_replace('/\D+/', '', $telefono) ?? '';
        if (strlen($phoneDigits) < 6 || strlen($phoneDigits) > 16) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Teléfono válido es requerido.']);
            exit;
        }
        // adminMode del cliente NO alcanza: hace falta sesión admin (proxy/turnera) o secret de sync.
        require_once __DIR__ . '/lib_booking_dni.php';
        $wantsAdmin = filter_var($params['adminMode'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $adminBooking = $wantsAdmin && (
            kinesica_backup_is_authorized_sync($params) || kinesica_backup_has_admin_session()
        );
        if (($email === '' && !$adminBooking) || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Correo electrónico válido es requerido.']);
            exit;
        }
        $dniCheck = trim((string) ($params['dni'] ?? ''));
        if (!$adminBooking) {
            if (!kinesica_is_valid_booking_dni($dniCheck)) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'DNI o documento es requerido.']);
                exit;
            }
        } elseif ($dniCheck !== '' && !kinesica_is_valid_booking_dni($dniCheck)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'DNI o documento inválido.']);
            exit;
        }

        $slotStartMs = kinesica_backup_parse_arg_ms($dateStr, $timeStr);
        $slotEndMs = $slotStartMs + (KINESICA_BACKUP_SESSION_DURATION_MIN * 60 * 1000);
        $summary = kinesica_backup_build_summary($params);

        $existingIdempotent = null;
        $hasConflict = false;
        $newEntry = null;

        $afterMutate = kinesica_backup_mutate(function (array $state) use (
            $dateStr,
            $timeStr,
            $practitionerId,
            $bookingRequestId,
            $slotStartMs,
            $slotEndMs,
            $summary,
            $params,
            &$existingIdempotent,
            &$hasConflict,
            &$newEntry
        ): array {
            foreach (($state['pending_bookings'] ?? []) as $p) {
                if (is_array($p) && ($p['bookingRequestId'] ?? '') === $bookingRequestId) {
                    $existingIdempotent = $p;
                    return $state;
                }
            }

            // Verificar que el horario esté entre los disponibles según las reglas y la ocupación actual
            $available = kinesica_backup_compute_day_slots($dateStr, $state, $practitionerId);
            $slotStillFree = false;
            foreach ($available as $s) {
                if (($s['time'] ?? '') === $timeStr) {
                    $slotStillFree = true;
                    break;
                }
            }

            if (!$slotStillFree) {
                $hasConflict = true;
                return $state;
            }

            $eventId = 'kin_' . substr(hash('sha256', $bookingRequestId . ':' . $dateStr . ':' . $timeStr), 0, 16);
            $newEntry = [
                'bookingRequestId' => $bookingRequestId,
                'eventId' => $eventId,
                'created_at' => gmdate('c'),
                'synced_to_google' => false,
                'synced_at' => null,
                'google_event_id' => null,
                'start' => $slotStartMs,
                'end' => $slotEndMs,
                'date' => $dateStr,
                'time' => $timeStr,
                'summary' => $summary,
                'payload' => [
                    'tipo' => (string) ($params['tipo'] ?? 'session'),
                    'appointmentType' => 'session',
                    'techniqueId' => (string) ($params['techniqueId'] ?? ''),
                    'practitionerId' => $practitionerId,
                    'date' => $dateStr,
                    'time' => $timeStr,
                    'nombre' => (string) ($params['nombre'] ?? ''),
                    'email' => (string) ($params['email'] ?? ''),
                    'telefono' => (string) ($params['telefono'] ?? ''),
                    'dni' => (string) ($params['dni'] ?? 'No provisto'),
                    'motivo' => (string) ($params['motivo'] ?? ''),
                    'especialidad' => (string) ($params['especialidad'] ?? ''),
                    'esParaTercero' => !empty($params['esParaTercero']),
                    'contactoNombre' => (string) ($params['contactoNombre'] ?? ''),
                    'contactoTelefono' => (string) ($params['contactoTelefono'] ?? ''),
                    'contactoNotas' => (string) ($params['contactoNotas'] ?? ''),
                    'isMenor' => !empty($params['isMenor']) && $params['isMenor'] !== 'false',
                    'nombreFamiliar' => (string) ($params['nombreFamiliar'] ?? ''),
                    'notas' => (string) ($params['notas'] ?? ''),
                    'bookingRequestId' => $bookingRequestId,
                ],
            ];

            $pending = is_array($state['pending_bookings'] ?? null) ? $state['pending_bookings'] : [];
            $pending[] = $newEntry;
            $state['pending_bookings'] = $pending;
            return $state;
        });

        if ($existingIdempotent !== null) {
            echo json_encode([
                'status' => 'success',
                'appointmentType' => 'session',
                'summary' => $existingIdempotent['summary'] ?? $summary,
                'date' => $dateStr,
                'time' => $timeStr,
                'eventId' => $existingIdempotent['google_event_id'] ?: $existingIdempotent['eventId'],
                'message' => 'Tu turno presencial ha sido agendado con éxito.',
            ]);
            exit;
        }

        if ($hasConflict || $newEntry === null) {
            http_response_code(409);
            echo json_encode([
                'status' => 'conflict',
                'message' => 'El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible.',
            ]);
            exit;
        }

        // Intentar inyección inmediata servidor-a-servidor hacia Google Apps Script
        $syncOutcome = kinesica_backup_try_push_booking_to_gas($newEntry['payload']);
        if (!empty($syncOutcome['synced'])) {
            $googleEvtId = (string) ($syncOutcome['google_event_id'] ?? $newEntry['eventId']);
            $newEntry['synced_to_google'] = true;
            $newEntry['google_event_id'] = $googleEvtId;
            try {
                kinesica_backup_mutate(function (array $state) use ($bookingRequestId, $googleEvtId): array {
                    foreach (($state['pending_bookings'] ?? []) as &$p) {
                        if (is_array($p) && ($p['bookingRequestId'] ?? '') === $bookingRequestId) {
                            $p['synced_to_google'] = true;
                            $p['synced_at'] = gmdate('c');
                            $p['google_event_id'] = $googleEvtId;
                        }
                    }
                    unset($p);
                    return $state;
                });
            } catch (Throwable $e) {
            }
        }

        // Notificar EXCLUSIVAMENTE a Norberto para auditoría
        kinesica_backup_notify_norberto_audit($newEntry, $afterMutate, $syncOutcome);

        // REL: espejo local turnos (best-effort; no afecta respuesta al paciente).
        try {
            require_once __DIR__ . '/lib_relational_turnos.php';
            $eventIdOut = (string) ($newEntry['google_event_id'] ?: $newEntry['eventId']);
            kinesica_rel_register_turno_from_booking(db(), [
                'eventId' => $eventIdOut,
                'date' => $dateStr,
                'time' => $timeStr,
                'nombre' => $nombre,
                'telefono' => $telefono,
                'dni' => $dni,
                'practitionerId' => $practitionerId,
                'summary' => $summary,
                'source' => 'backup',
            ]);
        } catch (Throwable $e) {
            error_log('kinesica calendar_backup turnos mirror: ' . $e->getMessage());
        }

        // Respuesta idéntica al flujo normal: el paciente nunca sabe que operó el modo respaldo
        echo json_encode([
            'status' => 'success',
            'appointmentType' => 'session',
            'summary' => $summary,
            'date' => $dateStr,
            'time' => $timeStr,
            'eventId' => $newEntry['google_event_id'] ?: $newEntry['eventId'],
            'message' => 'Tu turno presencial ha sido agendado con éxito.',
        ]);
        exit;
    }
