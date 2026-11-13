<?php
declare(strict_types=1);

/** @return array{items:list<array>,answered_count:int,unanswered_count:int,archived_count:int,grouped:array,days:?int,since_utc:?string,events_capped:bool} */
function interacciones_load_view(?PDO $pdo = null, ?int $days = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $tz = interacciones_tz();
    $sinceUtc = null;
    $daysOut = null;
    if ($days !== null) {
        $daysOut = max(1, min(INTERACCIONES_MAX_DAYS, $days));
        // Inicio del día local hace (N-1) días → N días calendario completos, sin partir conversaciones.
        $sinceLocal = (new DateTimeImmutable('today', $tz))->modify('-' . ($daysOut - 1) . ' days');
        $sinceUtc = $sinceLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    // Más recientes primero + tope; luego se reordenan ASC para armar el hilo.
    $hasPacienteCol = false;
    try {
        require_once __DIR__ . '/lib_migrations.php';
        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id');
    } catch (Throwable) {
    }
    $sql = 'SELECT id, event_key, wa_id, direction, body, ts_utc, patient_name, source, media_id, media_type, media_mime, media_filename'
        . ($hasPacienteCol ? ', paciente_id' : '')
        . ' FROM interaccion_eventos';
    $params = [];
    if ($sinceUtc !== null) {
        $sql .= ' WHERE ts_utc >= :since';
        $params['since'] = $sinceUtc;
    }
    $sql .= ' ORDER BY ts_utc DESC, id DESC LIMIT ' . (int) INTERACCIONES_MAX_EVENTS;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $eventsCapped = count($rows) >= INTERACCIONES_MAX_EVENTS;
    $rows = array_reverse($rows);

    // REL: nombres canónicos por paciente_id si REL_READ_IDS (lib_relational_read.php).
    $pacienteIdsForRead = [];
    $pacientesById = [];
    try {
        require_once __DIR__ . '/lib_relational_read.php';
        if (kinesica_rel_read_ids() && $hasPacienteCol) {
            foreach ($rows as $row) {
                $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
                if ($pid > 0) {
                    $pacienteIdsForRead[] = $pid;
                }
            }
            $pacientesById = kinesica_rel_fetch_pacientes_map($pdo, $pacienteIdsForRead);
        }
    } catch (Throwable) {
        $pacientesById = [];
    }

    $convs = [];
    foreach ($rows as $row) {
        $ts = (new DateTimeImmutable((string) $row['ts_utc'], new DateTimeZone('UTC')))->getTimestamp();
        $local = (new DateTimeImmutable('@' . $ts))->setTimezone($tz);
        // Canonicaliza 54 11… → 549 11… para no duplicar el mismo contacto el mismo día.
        $wa = interacciones_clean_wa_id((string) $row['wa_id']);
        if ($wa === '') {
            $wa = (string) $row['wa_id'];
        }
        $key = $wa . '_' . $local->format('Y-m-d');
        $isIg = (string) ($row['source'] ?? '') === 'instagram' || str_starts_with($wa, 'ig_');
        $convs[$key]['channel'] = $isIg ? 'instagram' : ($convs[$key]['channel'] ?? 'whatsapp');
        $convs[$key]['wa_id'] = $wa;
        $convs[$key]['date'] = $local->format('Y-m-d');
        $eventName = (string) $row['patient_name'];
        $pid = $hasPacienteCol && isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
        if ($pid > 0 && isset($pacientesById[$pid])) {
            $disp = kinesica_rel_display_from_paciente($pacientesById[$pid]);
            if ($disp['name'] !== '') {
                $eventName = $disp['name'];
            }
            $convs[$key]['paciente_id'] = $pid;
        }
        $convs[$key]['events'][] = [
            'id' => (int) $row['id'], 'event_key' => (string) $row['event_key'], 'direction' => (string) $row['direction'],
            'body' => (string) $row['body'], 'ts' => $ts, 'name' => $eventName,
            'media_id' => isset($row['media_id']) ? (string) $row['media_id'] : '',
            'media_type' => isset($row['media_type']) ? (string) $row['media_type'] : '',
            'media_mime' => isset($row['media_mime']) ? (string) $row['media_mime'] : '',
            'media_filename' => isset($row['media_filename']) ? (string) $row['media_filename'] : '',
        ];
    }

    $estado = [];
    foreach ($pdo->query('SELECT * FROM interaccion_estado') as $st) {
        $estado[(string) $st['conversation_key']] = $st;
    }

    $dirNames = [];
    $reminderNames = [];
    try {
        if (!function_exists('clean_phone_number') || !function_exists('ensure_pacientes_tables')) {
            $helpers = __DIR__ . '/pacientes_helpers.php';
            if (is_file($helpers)) {
                require_once $helpers;
            }
        }
        $waList = array_values(array_unique(array_map(static fn(array $c): string => (string) $c['wa_id'], $convs)));
        $dirNames = interacciones_lookup_directory_names($pdo, $waList);
        $reminderNames = interacciones_lookup_recordatorio_names($pdo, $waList);
    } catch (Throwable $e) {
        $dirNames = [];
        $reminderNames = [];
    }

    $items = [];
    $counts = ['answered' => 0, 'unanswered' => 0, 'archived' => 0];
    foreach ($convs as $key => $c) {
        $hidden = interacciones_hidden_twins($c['events']);
        $messages = [];
        $firstPatient = '';
        $lastName = '';
        $lastTs = 0;
        $hasAttachment = false;
        foreach ($c['events'] as $ev) {
            if (isset($hidden[$ev['id']])) {
                continue;
            }
            $msgItem = [
                'from' => $ev['direction'],
                'time' => (new DateTimeImmutable('@' . $ev['ts']))->setTimezone($tz)->format('H:i'),
                'text' => $ev['body'],
                'ts' => gmdate('Y-m-d\TH:i:s\Z', $ev['ts']),
            ];
            if ($ev['direction'] === 'patient' && !empty($ev['media_id'])) {
                $att = interacciones_build_attachment_view(
                    $ev['media_id'],
                    $ev['media_type'] ?? '',
                    $ev['media_mime'] ?? '',
                    $ev['media_filename'] ?? ''
                );
                if ($att !== null) {
                    $msgItem['attachment'] = $att;
                    $hasAttachment = true;
                }
            }
            $messages[] = $msgItem;
            if ($firstPatient === '' && $ev['direction'] === 'patient') {
                $firstPatient = $ev['body'];
            }
            if ($ev['name'] !== '') {
                $lastName = $ev['name'];
            }
            $lastTs = max($lastTs, $ev['ts']);
        }
        $st = $estado[$key] ?? [];
        $isTurnConfirm = interacciones_thread_is_turn_confirmation($messages);
        $name = '';
        // REL: preferir paciente_id de la conversación (estado) sobre el derivado de eventos.
        $convPid = isset($st['paciente_id']) ? (int) $st['paciente_id'] : 0;
        if ($convPid <= 0) {
            $convPid = isset($c['paciente_id']) ? (int) $c['paciente_id'] : 0;
        }
        if ($convPid > 0 && !isset($pacientesById[$convPid]) && function_exists('kinesica_rel_fetch_pacientes_map')) {
            try {
                $extra = kinesica_rel_fetch_pacientes_map($pdo, [$convPid]);
                $pacientesById += $extra;
            } catch (Throwable) {
            }
        }
        if ($convPid > 0 && isset($pacientesById[$convPid])) {
            $name = kinesica_rel_display_from_paciente($pacientesById[$convPid])['name'];
        }
        if ($name === '') {
            if (function_exists('kinesica_rel_read_ids') && kinesica_rel_read_ids()) {
                kinesica_rel_note_read_fallback('interacciones', 'sin_paciente_id');
            }
            $name = interacciones_known_name((string) $c['wa_id']);
        }
        if ($name === '') {
            $name = (string) (($st['patient_name'] ?? '') !== '' ? $st['patient_name'] : $lastName);
        }
        if ($name === '') {
            $matchKey = interacciones_phone_match_key((string) $c['wa_id']);
            $name = (string) ($dirNames[$matchKey] ?? $reminderNames[$matchKey] ?? '');
        }
        $isDiagNoise = interacciones_thread_is_diagnostic_noise($messages, $name);
        [$cat, $catLabel] = interacciones_classify($firstPatient, (string) $c['wa_id']);
        if ($isTurnConfirm) {
            $cat = 'confirmacion_turno';
            $catLabel = '✅ Confirmación de turno';
        } elseif ($isDiagNoise) {
            $cat = 'prueba_admin';
            $catLabel = '🧪 Prueba Técnica';
        }
        $archived = !empty($st['archived']);
        // Confirmación del recordatorio o ruido de prueba: no quedan pendientes.
        $answered = !empty($st['answered']) || $isTurnConfirm || $isDiagNoise;
        $counts[$archived ? 'archived' : ($answered ? 'answered' : 'unanswered')]++;
        $isIgConv = ($c['channel'] ?? 'whatsapp') === 'instagram' || str_starts_with((string) $c['wa_id'], 'ig_');
        if ($isIgConv && ($cat === 'consulta_general' || empty($st['category_label']))) {
            $cat = 'instagram_dm';
            $catLabel = '📸 Instagram Direct';
        }
        $item = [
            'id' => $key,
            'channel' => $isIgConv ? 'instagram' : 'whatsapp',
            'wa_id' => $c['wa_id'],
            'phone_formatted' => interacciones_phone_format((string) $c['wa_id']),
            'patient_name' => $name,
            'date' => $c['date'],
            'time' => (new DateTimeImmutable('@' . $lastTs))->setTimezone($tz)->format('H:i'),
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z', $lastTs),
            'answered' => $answered,
            'answered_at' => interacciones_iso($st['answered_at'] ?? null),
            'archived' => $archived,
            'archived_at' => interacciones_iso($st['archived_at'] ?? null),
            'category' => (string) (($st['category'] ?? '') !== '' ? $st['category'] : $cat),
            'category_label' => (string) (($st['category_label'] ?? '') !== '' ? $st['category_label'] : $catLabel),
            'summary' => (string) (($st['summary'] ?? '') !== '' ? $st['summary'] : mb_substr($firstPatient, 0, 120, 'UTF-8')),
            'has_attachment' => $hasAttachment,
            'messages' => $messages,
        ];
        // REL: exponer paciente_id canónico (estado > eventos) para UI / link_paciente.
        if ($convPid > 0) {
            $item['paciente_id'] = $convPid;
        }
        $items[] = $item;
    }
    usort($items, static fn(array $a, array $b): int => strcmp($b['timestamp'], $a['timestamp']));
    $grouped = [];
    foreach ($items as $it) {
        $grouped[$it['date']][] = $it;
    }
    return [
        'items' => $items,
        'answered_count' => $counts['answered'],
        'unanswered_count' => $counts['unanswered'],
        'archived_count' => $counts['archived'],
        'grouped' => $grouped,
        'days' => $daysOut,
        'since_utc' => $sinceUtc,
        'events_capped' => $eventsCapped,
    ];
}
