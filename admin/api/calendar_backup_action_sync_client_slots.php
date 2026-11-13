<?php
declare(strict_types=1);

/**
 * Fragmento de calendar_backup ($action).
 */
    if ($action === 'sync_client_slots') {
        if (!kinesica_backup_can_sync_client_slots($params, $allowedOrigins)) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }

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
