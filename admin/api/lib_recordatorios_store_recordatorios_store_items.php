<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_recordatorios_store_recordatorios_sync_paciente.php';

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
            $status = (string) ($ev['status'] ?? '');

            // Previsión / re-ingest: no recrear pending/missing_phone si ya hubo envío OK.
            if (
                $cal !== '' &&
                $cal !== '_run' &&
                in_array($status, ['pending', 'missing_phone'], true) &&
                recordatorios_was_sent_for_event($cal, $pdo)
            ) {
                $res['duplicates']++;
                continue;
            }

            // Si admin ya cargó WhatsApp en un pending, no pisarlo con un missing_phone vacío de n8n.
            if (
                $cal !== '' &&
                $cal !== '_run' &&
                ($ev['wa_id'] ?? '') === '' &&
                in_array($status, ['missing_phone', 'failed', 'skipped', 'pending'], true)
            ) {
                try {
                    if (!function_exists('kinesica_calendar_event_id_variants')) {
                        require_once __DIR__ . '/lib_relational_turnos_turnos_ready.php';
                    }
                    $variants = kinesica_calendar_event_id_variants($cal);
                    if ($variants === []) {
                        $variants = [$cal];
                    }
                    $ph = [];
                    $keepParams = [];
                    foreach ($variants as $i => $vid) {
                        $key = 'c' . $i;
                        $ph[] = ':' . $key;
                        $keepParams[$key] = $vid;
                    }
                    $keptStmt = $pdo->prepare(
                        'SELECT wa_id FROM recordatorio_eventos
                         WHERE calendar_event_id IN (' . implode(', ', $ph) . ')
                           AND wa_id IS NOT NULL AND wa_id != ""
                         ORDER BY id DESC LIMIT 1'
                    );
                    $keptStmt->execute($keepParams);
                    $keptWa = $keptStmt->fetchColumn();
                    if (is_string($keptWa) && $keptWa !== '') {
                        if ($status === 'missing_phone') {
                            // Contacto manual ya resuelve el caso: no insertar otro missing_phone vacío.
                            $res['duplicates']++;
                            continue;
                        }
                        $ev['wa_id'] = substr($keptWa, 0, 32);
                    }
                } catch (Throwable $keepEx) {
                }
            }

            if ($cal !== '' && $cal !== '_run') {
                $baseCal = str_replace('@google.com', '', $cal);
                try {
                    if (in_array($status, ['sent', 'sent_email'], true)) {
                        // Cualquier pending (con o sin WA) queda obsoleto tras envío real.
                        $pdo->prepare(
                            'DELETE FROM recordatorio_eventos
                             WHERE (calendar_event_id = :cal OR calendar_event_id = :baseCal OR calendar_event_id = :withGoogle)
                               AND status = "pending"'
                        )->execute([
                            'cal' => $cal,
                            'baseCal' => $baseCal,
                            'withGoogle' => $baseCal . '@google.com',
                        ]);
                    } elseif ($status !== 'pending') {
                        $pdo->prepare(
                            'DELETE FROM recordatorio_eventos
                             WHERE (calendar_event_id = :cal OR calendar_event_id = :baseCal OR calendar_event_id = :withGoogle)
                               AND status = "pending"
                               AND (wa_id IS NULL OR wa_id = "")'
                        )->execute([
                            'cal' => $cal,
                            'baseCal' => $baseCal,
                            'withGoogle' => $baseCal . '@google.com',
                        ]);
                    }
                } catch (Throwable $delEx) {
                }
            }

            $outcome = recordatorios_insert_item($pdo, $ev);
            $res[$outcome === 'stored' ? 'stored' : 'duplicates']++;

            try {
                recordatorios_sync_paciente_from_event($ev, $pdo);
            } catch (Throwable $pacEx) {
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
