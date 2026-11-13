<?php
declare(strict_types=1);

/**
 * Fragmento de calendar_backup ($action).
 */
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
