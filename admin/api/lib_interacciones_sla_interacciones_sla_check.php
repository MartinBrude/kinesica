<?php
declare(strict_types=1);


/**
 * @param callable|null $sender function(array $payload): array{ok:bool,...}
 * @return array{ok:bool,checked:int,due:int,notified:int,skipped:int,errors:list<string>,throttled:bool,outside_hours:bool}
 */
function interacciones_sla_check(?PDO $pdo = null, bool $force = false, ?callable $sender = null, ?int $nowTs = null): array
{
    $out = [
        'ok' => true,
        'checked' => 0,
        'due' => 0,
        'notified' => 0,
        'skipped' => 0,
        'errors' => [],
        'throttled' => false,
        'outside_hours' => false,
    ];
    if (!interacciones_sla_due($force)) {
        $out['throttled'] = true;
        return $out;
    }

    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $now = $nowTs ?? time();
    $prevState = interacciones_sla_read_state();
    // Primera ejecución: marcar vencidos existentes sin enviar (evitar ráfaga histórica a Norberto).
    $bootstrap = empty($prevState['bootstrapped']);
    $inWindow = interacciones_sla_in_notify_window($now);
    // Fuera de 10–20 AR: no enviar ni reclamar (el aviso espera a las 10). Bootstrap sí puede silenciar backlog.
    if (!$inWindow && !$bootstrap) {
        $out['outside_hours'] = true;
        return $out;
    }
    $view = interacciones_load_view($pdo, INTERACCIONES_SLA_LOOKBACK_DAYS);
    $out['checked'] = count($view['items']);
    if (!$inWindow) {
        $out['outside_hours'] = true;
    }

    // Releer eventos con event_key para claim por mensaje.
    $tz = interacciones_tz();
    foreach ($view['items'] as $item) {
        if (!empty($item['answered']) || !empty($item['archived'])) {
            continue;
        }
        $convKey = (string) ($item['id'] ?? '');
        if ($convKey === '' || !preg_match('/^(\d{6,32})_(\d{4}-\d{2}-\d{2})$/', $convKey, $m)) {
            continue;
        }
        $wa = $m[1];
        $day = $m[2];
        $from = (new DateTimeImmutable($day . ' 00:00:00', $tz))->setTimezone(new DateTimeZone('UTC'));
        $to = $from->modify('+1 day');
        $stmt = $pdo->prepare(
            'SELECT id, event_key, direction, body, ts_utc, patient_name
             FROM interaccion_eventos
             WHERE wa_id = :wa AND ts_utc >= :a AND ts_utc < :b
             ORDER BY ts_utc ASC, id ASC'
        );
        $stmt->execute([
            'wa' => $wa,
            'a' => $from->format('Y-m-d H:i:s'),
            'b' => $to->format('Y-m-d H:i:s'),
        ]);
        $events = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $ts = (new DateTimeImmutable((string) $row['ts_utc'], new DateTimeZone('UTC')))->getTimestamp();
            $events[] = [
                'id' => (int) $row['id'],
                'event_key' => (string) $row['event_key'],
                'direction' => (string) $row['direction'],
                'body' => (string) $row['body'],
                'ts' => $ts,
                'name' => (string) $row['patient_name'],
            ];
        }
        $first = interacciones_sla_first_patient_message($events);
        if ($first === null) {
            continue;
        }
        $age = $now - $first['ts'];
        if ($age < INTERACCIONES_SLA_SECONDS) {
            continue;
        }
        $out['due']++;

        $st = $pdo->prepare('SELECT sla_notified_event_key FROM interaccion_estado WHERE conversation_key = :k LIMIT 1');
        $st->execute(['k' => $convKey]);
        $already = $st->fetchColumn();
        if ($already !== false && (string) $already === $first['event_key']) {
            $out['skipped']++;
            continue;
        }

        if (!interacciones_sla_claim($pdo, $convKey, $first['event_key'])) {
            $out['skipped']++;
            continue;
        }

        if ($bootstrap) {
            // Ya reclamado: no notificar backlog al activar el SLA.
            $out['skipped']++;
            continue;
        }

        $name = trim((string) ($item['patient_name'] ?? '')) ?: 'Paciente';
        $phoneFmt = (string) ($item['phone_formatted'] ?? $wa);
        $waLink = 'wa.me/' . $wa;
        $hours = max(3, (int) floor($age / 3600));
        $snippet = mb_substr(trim($first['body']), 0, 160, 'UTF-8');
        $summary = trim((string) ($item['summary'] ?? $snippet));
        $adminUrl = 'https://www.kinesica.com.ar/admin/interacciones';
        $body = "⏰ *[SLA · SIN RESPUESTA > {$hours} h]*\n"
            . "Hay un mensaje pendiente en Interacciones sin marcar como respondido.\n\n"
            . "• *Paciente:* {$name}\n"
            . "• *WhatsApp:* {$waLink}\n"
            . "• *Teléfono:* {$phoneFmt}\n"
            . "• *Resumen:* \"{$summary}\"\n"
            . "• *Panel:* {$adminUrl}\n\n"
            . "Respondé al paciente y marcá la consulta como respondida en el admin.";

        $payload = [
            'to' => interacciones_sla_norberto_phone(),
            'body' => $body,
            'tpl_patient' => $name,
            'tpl_whatsapp' => $wa,
            'tpl_motivo' => "SLA · sin respuesta > {$hours} h",
            'tpl_detalle' => mb_substr($summary !== '' ? $summary : $snippet, 0, 300, 'UTF-8'),
            'tpl_btn_phone' => $wa,
        ];

        $send = $sender ?? static function (array $p): array {
            if (!function_exists('send_whatsapp_alert_payload')) {
                require_once __DIR__ . '/lib_whatsapp.php';
            }
            return send_whatsapp_alert_payload($p);
        };

        try {
            $result = $send($payload);
        } catch (Throwable $e) {
            $result = ['ok' => false, 'error' => $e->getMessage()];
        }

        if (empty($result['ok'])) {
            interacciones_sla_release_claim($pdo, $convKey, $first['event_key']);
            $err = (string) ($result['error'] ?? 'envio_fallido');
            $out['errors'][] = $convKey . ': ' . $err;
            $out['ok'] = false;
            continue;
        }
        $out['notified']++;
    }

    $iso = gmdate('c');
    interacciones_sla_write_state([
        'last_run' => $iso,
        'last_ok' => $out['ok'] ? $iso : ($out['notified'] > 0 ? $iso : null),
        'notified_last_run' => $out['notified'],
        'checked_last_run' => $out['checked'],
        'due_last_run' => $out['due'],
        'errors_last_run' => $out['errors'],
        'bootstrapped' => true,
        'bootstrapped_at' => $bootstrap ? $iso : ($prevState['bootstrapped_at'] ?? $iso),
    ]);

    return $out;
}
