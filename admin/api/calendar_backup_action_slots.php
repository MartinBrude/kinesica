<?php
declare(strict_types=1);

/**
 * Fragmento de calendar_backup ($action).
 */
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
