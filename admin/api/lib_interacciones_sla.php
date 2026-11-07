<?php
declare(strict_types=1);

/**
 * SLA de interacciones: si un mensaje de paciente queda sin respuesta (pending en
 * /admin/interacciones) más de 3 horas, notificar a Norberto. Como máximo una
 * notificación por mensaje (event_key del primer mensaje del paciente en el hilo).
 * Las alertas WhatsApp solo se envían entre las 10:00 y las 20:00 (hora Argentina).
 */

require_once __DIR__ . '/lib_interacciones_view.php';
require_once __DIR__ . '/lib_interacciones_state.php';

/** Segundos sin marcar respondida antes de alertar. */
const INTERACCIONES_SLA_SECONDS = 10800; // 3 horas
/** Ventana de conversaciones a revisar (días locales). */
const INTERACCIONES_SLA_LOOKBACK_DAYS = 3;
/** No correr el chequeo más de una vez cada N segundos (housekeeping). */
const INTERACCIONES_SLA_THROTTLE_SECONDS = 600; // 10 min
/** Inicio inclusive de la ventana de envío (hora local Argentina, 0–23). */
const INTERACCIONES_SLA_NOTIFY_HOUR_FROM = 10;
/** Fin exclusive de la ventana de envío (10:00–20:00 → hasta 19:59). */
const INTERACCIONES_SLA_NOTIFY_HOUR_TO = 20;

/**
 * @return string Teléfono E.164-ish de Norberto para alertas WhatsApp.
 */
function interacciones_sla_norberto_phone(): string
{
    $raw = (string) (
        getenv('NORBERTO_PHONE')
        ?: ($_SERVER['NORBERTO_PHONE'] ?? $_ENV['NORBERTO_PHONE'] ?? '')
    );
    if ($raw === '' && function_exists('cfg')) {
        $raw = (string) (cfg()['norberto_phone'] ?? '');
    }
    // Celular oficial de Norberto con prefijo móvil 9 para WhatsApp Argentina (Meta Graph API).
    if ($raw === '') {
        $raw = '5491161564311';
    }
    if (!function_exists('clean_phone_number')) {
        @require_once __DIR__ . '/pacientes_helpers.php';
    }
    if (function_exists('clean_phone_number')) {
        $normalized = clean_phone_number($raw);
        if ($normalized !== '') {
            return $normalized;
        }
    }
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    return $digits !== '' ? $digits : '5491161564311';
}

function interacciones_sla_state_file(): string
{
    return interacciones_dir() . '/sla_state.json';
}

/**
 * @return array{last_run:?string,last_ok:?string,notified_last_run:int,checked_last_run:int,skipped_throttle?:bool}
 */
function interacciones_sla_read_state(): array
{
    $file = interacciones_sla_state_file();
    if (!is_file($file)) {
        return [
            'last_run' => null,
            'last_ok' => null,
            'notified_last_run' => 0,
            'checked_last_run' => 0,
        ];
    }
    $decoded = json_decode((string) @file_get_contents($file), true);
    return is_array($decoded) ? $decoded : [
        'last_run' => null,
        'last_ok' => null,
        'notified_last_run' => 0,
        'checked_last_run' => 0,
    ];
}

function interacciones_sla_write_state(array $state): void
{
    $file = interacciones_sla_state_file();
    @file_put_contents(
        $file,
        json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n",
        LOCK_EX
    );
}

function interacciones_sla_due(bool $force = false, int $minSeconds = INTERACCIONES_SLA_THROTTLE_SECONDS): bool
{
    if ($force) {
        return true;
    }
    $state = interacciones_sla_read_state();
    $last = (string) ($state['last_run'] ?? '');
    if ($last === '') {
        return true;
    }
    try {
        $ts = (new DateTimeImmutable($last))->getTimestamp();
    } catch (Throwable) {
        return true;
    }
    return (time() - $ts) >= $minSeconds;
}

/**
 * ¿Estamos en la ventana 10:00–20:00 hora Argentina?
 * [from, to) — a las 20:00 ya no se envía; se retoma a las 10:00 del día siguiente.
 */
function interacciones_sla_in_notify_window(?int $nowTs = null): bool
{
    $tz = interacciones_tz();
    $local = (new DateTimeImmutable('@' . ($nowTs ?? time())))->setTimezone($tz);
    $hour = (int) $local->format('G');
    return $hour >= INTERACCIONES_SLA_NOTIFY_HOUR_FROM && $hour < INTERACCIONES_SLA_NOTIFY_HOUR_TO;
}

/**
 * Primer mensaje del paciente en el hilo (event_key + ts), ignorando gemelos ocultos.
 *
 * @param list<array{id:int,event_key:string,direction:string,body:string,ts:int,name:string}> $events
 * @return array{event_key:string,ts:int,body:string}|null
 */
function interacciones_sla_first_patient_message(array $events): ?array
{
    $hidden = interacciones_hidden_twins($events);
    foreach ($events as $ev) {
        if (isset($hidden[$ev['id']])) {
            continue;
        }
        if (($ev['direction'] ?? '') !== 'patient') {
            continue;
        }
        $key = trim((string) ($ev['event_key'] ?? ''));
        $ts = (int) ($ev['ts'] ?? 0);
        if ($key === '' || $ts <= 0) {
            continue;
        }
        return [
            'event_key' => $key,
            'ts' => $ts,
            'body' => (string) ($ev['body'] ?? ''),
        ];
    }
    return null;
}

/**
 * Reclama el derecho a notificar este mensaje (idempotente). Devuelve true si este proceso gana.
 */
function interacciones_sla_claim(PDO $pdo, string $conversationKey, string $eventKey): bool
{
    interacciones_ensure_schema($pdo);
    $now = gmdate('Y-m-d H:i:s');
    $chk = $pdo->prepare(
        'SELECT sla_notified_event_key FROM interaccion_estado WHERE conversation_key = :k LIMIT 1'
    );
    $chk->execute(['k' => $conversationKey]);
    $existing = $chk->fetchColumn();
    if ($existing !== false && (string) $existing === $eventKey) {
        return false;
    }

    if ($existing === false) {
        $ins = $pdo->prepare(
            'INSERT INTO interaccion_estado
                (conversation_key, answered, archived, sla_notified_at, sla_notified_event_key, updated_at, updated_by)
             VALUES (:k, 0, 0, :at, :ek, :now, :by)'
        );
        try {
            $ins->execute([
                'k' => $conversationKey,
                'at' => $now,
                'ek' => mb_substr($eventKey, 0, 100, 'UTF-8'),
                'now' => $now,
                'by' => 'sla',
            ]);
            return true;
        } catch (Throwable) {
            // Carrera: otro proceso insertó; re-chequear.
            $chk->execute(['k' => $conversationKey]);
            return (string) $chk->fetchColumn() !== $eventKey
                ? interacciones_sla_claim_update($pdo, $conversationKey, $eventKey, $now)
                : false;
        }
    }

    return interacciones_sla_claim_update($pdo, $conversationKey, $eventKey, $now);
}

function interacciones_sla_claim_update(PDO $pdo, string $conversationKey, string $eventKey, string $now): bool
{
    $upd = $pdo->prepare(
        'UPDATE interaccion_estado
         SET sla_notified_at = :at, sla_notified_event_key = :ek, updated_at = :now, updated_by = :by
         WHERE conversation_key = :k
           AND (sla_notified_event_key IS NULL OR sla_notified_event_key = \'\' OR sla_notified_event_key <> :ek2)'
    );
    $upd->execute([
        'at' => $now,
        'ek' => mb_substr($eventKey, 0, 100, 'UTF-8'),
        'ek2' => mb_substr($eventKey, 0, 100, 'UTF-8'),
        'now' => $now,
        'by' => 'sla',
        'k' => $conversationKey,
    ]);
    return $upd->rowCount() > 0;
}

function interacciones_sla_release_claim(PDO $pdo, string $conversationKey, string $eventKey): void
{
    $pdo->prepare(
        'UPDATE interaccion_estado
         SET sla_notified_at = NULL, sla_notified_event_key = NULL, updated_at = :now, updated_by = :by
         WHERE conversation_key = :k AND sla_notified_event_key = :ek'
    )->execute([
        'now' => gmdate('Y-m-d H:i:s'),
        'by' => 'sla-rollback',
        'k' => $conversationKey,
        'ek' => mb_substr($eventKey, 0, 100, 'UTF-8'),
    ]);
}

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
