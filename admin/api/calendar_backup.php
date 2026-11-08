<?php
declare(strict_types=1);

/**
 * Kinésica - Endpoint de Respaldo de Calendario y Sincronización
 * URL: /admin/api/calendar_backup.php
 *
 * Acciones soportadas:
 * - GET/POST action=get_slots         -> Devuelve horarios libres desde el respaldo local
 * - GET/POST action=get_slots_range   -> Devuelve mapa de días con horarios libres desde el respaldo local
 * - POST     action=book              -> Agenda en modo respaldo, bloquea el hueco y alerta SOLO a Norberto para auditar
 * - POST     action=sync_client_slots -> Piggyback pasivo: guarda horarios recién leídos de Google Calendar en vivo
 * - POST     action=push_snapshot     -> Recibe desde Google Apps Script / n8n los bloques ocupados (busy_intervals)
 *                                        y devuelve reservas pendientes de conciliar en Google Calendar
 */

require_once __DIR__ . '/lib_calendar_backup.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://www.kinesica.com.ar',
    'https://kinesica.com.ar',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Webhook-Secret');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input');
$jsonBody = is_string($rawBody) && $rawBody !== '' ? json_decode($rawBody, true) : null;
$params = array_merge($_GET, $_POST, is_array($jsonBody) ? $jsonBody : []);
$action = trim((string) ($params['action'] ?? 'get_slots'));

/**
 * Verifica token para acciones privilegiadas de sincronización directa (push_snapshot / mark_synced).
 */
function kinesica_backup_is_authorized_sync(array $params): bool
{
    $cfg = function_exists('cfg') ? cfg() : [];
    $expected = trim((string) (
        getenv('KINESICA_BACKUP_SECRET')
        ?: ($_SERVER['KINESICA_BACKUP_SECRET'] ?? $_ENV['KINESICA_BACKUP_SECRET'] ?? $cfg['webhook_secret'] ?? $cfg['install_token'] ?? '')
    ));
    $given = trim((string) (
        $params['secret']
        ?? $_SERVER['HTTP_X_WEBHOOK_SECRET']
        ?? ''
    ));
    $authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($given === '' && str_starts_with($authHeader, 'Bearer ')) {
        $given = trim(substr($authHeader, 7));
    }
    if ($expected !== '' && $given !== '' && hash_equals($expected, $given)) {
        return true;
    }
    $botHashFile = __DIR__ . '/bot_token.sha256';
    if ($given !== '' && is_file($botHashFile)) {
        $expectedHash = trim((string) @file_get_contents($botHashFile));
        if ($expectedHash !== '' && hash_equals($expectedHash, hash('sha256', $given))) {
            return true;
        }
    }
    return false;
}

try {
    // -------------------------------------------------------------------------
    // 1. PUSH SNAPSHOT DESDE GOOGLE APPS SCRIPT / N8N (Google -> Espejo Local)
    // -------------------------------------------------------------------------
    if ($action === 'push_snapshot') {
        if (!kinesica_backup_is_authorized_sync($params)) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }

        $rawBusy = is_array($params['busy_intervals'] ?? null) ? $params['busy_intervals'] : [];
        $syncedIds = is_array($params['synced_request_ids'] ?? null) ? $params['synced_request_ids'] : [];
        $cleanBusy = [];
        foreach ($rawBusy as $item) {
            if (!is_array($item)) {
                continue;
            }
            $s = (int) ($item['start'] ?? 0);
            $e = (int) ($item['end'] ?? 0);
            if ($s > 0 && $e > $s) {
                $cleanBusy[] = ['start' => $s, 'end' => $e];
            }
        }

        $pendingToReconcile = [];
        $updated = kinesica_backup_mutate(function (array $state) use ($cleanBusy, $syncedIds, &$pendingToReconcile): array {
            $now = time();
            $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
            $state['updated_ts'] = $now;
            $state['updated_at'] = (new DateTimeImmutable('now', $tz))->format(DateTimeInterface::ATOM);
            $state['source'] = 'gas_snapshot';
            $state['busy_intervals'] = $cleanBusy;

            $syncedSet = array_fill_keys(array_map('strval', $syncedIds), true);
            $nextPending = [];
            foreach (($state['pending_bookings'] ?? []) as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $reqId = (string) ($entry['bookingRequestId'] ?? '');
                $startMs = (int) ($entry['start'] ?? 0);
                $endMs = (int) ($entry['end'] ?? 0);

                // Si ya pasó hace más de 24h, limpiar del buffer pendiente
                if ($endMs > 0 && $endMs < ($now - 86400) * 1000) {
                    continue;
                }

                // Verificar si ya fue marcado como sincronizado o si ya aparece el bloque exacto en Google Calendar
                $alreadyInGoogle = false;
                foreach ($cleanBusy as $b) {
                    if ($b['start'] === $startMs && $b['end'] === $endMs) {
                        $alreadyInGoogle = true;
                        break;
                    }
                }

                if (isset($syncedSet[$reqId]) || $alreadyInGoogle) {
                    $entry['synced_to_google'] = true;
                    $entry['synced_at'] = $entry['synced_at'] ?? gmdate('c', $now);
                }

                if (empty($entry['synced_to_google'])) {
                    $pendingToReconcile[] = $entry;
                }
                $nextPending[] = $entry;
            }
            $state['pending_bookings'] = $nextPending;
            return $state;
        });

        echo json_encode([
            'status' => 'success',
            'updated_at' => $updated['updated_at'],
            'busy_count' => count($cleanBusy),
            'pending_to_reconcile' => $pendingToReconcile,
        ]);
        exit;
    }

    // -------------------------------------------------------------------------
    // 2. PIGGYBACK PASIVO DESDE EL NAVEGADOR (Cuando Google respondió OK)
    // -------------------------------------------------------------------------
    if ($action === 'sync_client_slots') {
        $incomingDays = [];
        if (isset($params['days']) && is_array($params['days'])) {
            $incomingDays = $params['days'];
        } elseif (isset($params['date'], $params['availableSlots']) && is_string($params['date']) && is_array($params['availableSlots'])) {
            $incomingDays[$params['date']] = $params['availableSlots'];
        }

        $validDays = [];
        foreach ($incomingDays as $dateKey => $slotsList) {
            if (!is_string($dateKey) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey) || !is_array($slotsList)) {
                continue;
            }
            if (count($validDays) >= 20) {
                break;
            }
            $cleanSlots = [];
            foreach ($slotsList as $slot) {
                if (!is_array($slot)) {
                    continue;
                }
                $t = trim((string) ($slot['time'] ?? ''));
                if (!preg_match('/^([01]\d|2[0-3]):(00|30)$/', $t)) {
                    continue;
                }
                $cleanSlots[] = [
                    'time' => $t,
                    'startIso' => (string) ($slot['startIso'] ?? ''),
                    'endIso' => (string) ($slot['endIso'] ?? ''),
                ];
            }
            $validDays[$dateKey] = $cleanSlots;
        }

        if ($validDays === []) {
            echo json_encode(['status' => 'ignored']);
            exit;
        }

        $updated = kinesica_backup_mutate(function (array $state) use ($validDays): array {
            $now = time();
            $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
            $todayArg = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
            $clientDays = is_array($state['client_days'] ?? null) ? $state['client_days'] : [];

            foreach ($validDays as $d => $slots) {
                $clientDays[$d] = [
                    'at' => $now,
                    'slots' => $slots,
                ];
            }
            // Limpiar días pasados
            foreach (array_keys($clientDays) as $dKey) {
                if ($dKey < $todayArg) {
                    unset($clientDays[$dKey]);
                }
            }

            $state['client_days'] = $clientDays;
            $state['updated_ts'] = $now;
            $state['updated_at'] = (new DateTimeImmutable('now', $tz))->format(DateTimeInterface::ATOM);
            if (($state['source'] ?? 'none') === 'none') {
                $state['source'] = 'client_slots';
            }
            return $state;
        });

        echo json_encode([
            'status' => 'success',
            'synced_days' => count($validDays),
            'updated_at' => $updated['updated_at'],
        ]);
        exit;
    }

    // -------------------------------------------------------------------------
    // 3. CONSULTA DE HORARIOS EN MODO RESPALDO (get_slots / get_slots_range)
    // -------------------------------------------------------------------------
    if ($action === 'get_slots' || $action === 'get_slots_range') {
        $state = kinesica_backup_read();
        if (!kinesica_backup_is_fresh($state)) {
            http_response_code(503);
            echo json_encode([
                'status' => 'error',
                'message' => 'Copia de respaldo no disponible o vencida.',
            ]);
            exit;
        }

        $practitionerId = trim((string) ($params['practitioner'] ?? $params['practitionerId'] ?? ''));

        if ($action === 'get_slots') {
            $dateStr = trim((string) ($params['date'] ?? ''));
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => "Parámetro 'date' inválido (YYYY-MM-DD)"]);
                exit;
            }
            $slots = kinesica_backup_compute_day_slots($dateStr, $state, $practitionerId);
            kinesica_backup_notify_norberto_read_fallback("Consulta de fecha {$dateStr}");

            echo json_encode([
                'status' => 'success',
                'version' => 'v2-timezone-fixed',
                'date' => $dateStr,
                'type' => 'session',
                'availableSlots' => $slots,
            ]);
            exit;
        }

        // get_slots_range
        $fromStr = trim((string) ($params['from'] ?? ''));
        $toStr = trim((string) ($params['to'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromStr) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $toStr)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => "Parámetros 'from' y 'to' inválidos (YYYY-MM-DD)"]);
            exit;
        }
        $fromMs = kinesica_backup_parse_arg_ms($fromStr, '12:00');
        $toMs = kinesica_backup_parse_arg_ms($toStr, '12:00');
        if ($toMs < $fromMs || ($toMs - $fromMs) > KINESICA_BACKUP_MAX_DAYS * 86400 * 1000) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Rango de fechas inválido']);
            exit;
        }

        $tzArg = new DateTimeZone('America/Argentina/Buenos_Aires');
        $cursorDt = new DateTimeImmutable($fromStr . ' 12:00:00', $tzArg);
        $endDt = new DateTimeImmutable($toStr . ' 12:00:00', $tzArg);
        $days = [];
        while ($cursorDt <= $endDt) {
            $dIso = $cursorDt->format('Y-m-d');
            $days[$dIso] = kinesica_backup_compute_day_slots($dIso, $state, $practitionerId);
            $cursorDt = $cursorDt->modify('+1 day');
        }

        kinesica_backup_notify_norberto_read_fallback("Consulta de rango {$fromStr} a {$toStr}");

        echo json_encode([
            'status' => 'success',
            'version' => 'v3-slots-range',
            'from' => $fromStr,
            'to' => $toStr,
            'days' => $days,
        ]);
        exit;
    }

    // -------------------------------------------------------------------------
    // 4. RESERVAR TURNO EN MODO RESPALDO (action=book)
    // -------------------------------------------------------------------------
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
        // Email opcional solo en la turnera de admin. En la reserva pública es obligatorio.
        $adminBooking = filter_var($params['adminMode'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if (($email === '' && !$adminBooking) || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Correo electrónico válido es requerido.']);
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

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Acción no reconocida']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error interno en el servicio de respaldo']);
}
