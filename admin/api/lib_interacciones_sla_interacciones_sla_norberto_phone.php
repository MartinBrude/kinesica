<?php
declare(strict_types=1);


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
