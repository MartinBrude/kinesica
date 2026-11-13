<?php
declare(strict_types=1);


/**
 * Normaliza un evento entrante. Devuelve null si no es válido (nunca lanza).
 *
 * @return array{event_key:string,wa_id:string,direction:string,body:string,ts:int,patient_name:string,source:string,exec_id:?string}|null
 */
function interacciones_normalize_event(array $in, string $defaultSource = 'push', ?int $now = null): ?array
{
    $now = $now ?? time();
    $wa = interacciones_clean_wa_id((string) ($in['wa_id'] ?? ''));
    $dir = strtolower(trim((string) ($in['direction'] ?? $in['from'] ?? '')));
    $body = trim((string) ($in['body'] ?? $in['text'] ?? ''));
    if (strlen($wa) < 6 || ($dir !== 'patient' && $dir !== 'clara') || $body === '') {
        return null;
    }
    if (mb_strlen($body, 'UTF-8') > INTERACCIONES_MAX_BODY) {
        $body = mb_substr($body, 0, INTERACCIONES_MAX_BODY, 'UTF-8');
    }
    $ts = interacciones_parse_ts($in['ts'] ?? $in['timestamp'] ?? null, $now);
    $msgId = trim((string) ($in['message_id'] ?? ''));
    $execId = trim((string) ($in['exec_id'] ?? ''));
    $explicit = trim((string) ($in['event_key'] ?? ''));
    $suffix = $dir === 'clara' ? ':r' : '';
    if ($explicit !== '') {
        $key = substr(preg_replace('/[^A-Za-z0-9:_\-.|]/', '', $explicit) ?? '', 0, 100);
    } elseif ($msgId !== '') {
        $key = 'wa:' . substr(preg_replace('/[^A-Za-z0-9=_\-.]/', '', $msgId) ?? '', 0, 80) . $suffix;
    } elseif ($execId !== '') {
        $key = 'ex:' . substr(preg_replace('/[^A-Za-z0-9_\-]/', '', $execId) ?? '', 0, 40) . ':' . $dir;
    } else {
        $key = '';
    }
    if ($key === '') {
        $key = 'h:' . sha1($wa . '|' . $dir . '|' . $ts . '|' . $body);
    }
    $mediaId = $dir === 'patient'
        ? interacciones_clean_media_id((string) ($in['media_id'] ?? $in['attachment_id'] ?? $in['audio_id'] ?? ''))
        : '';
    $mediaType = $mediaId !== ''
        ? substr(preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) ($in['media_type'] ?? $in['attachment_type'] ?? ''))) ?? '', 0, 32)
        : '';
    $mediaMime = $mediaId !== ''
        ? substr(preg_replace('/[^a-zA-Z0-9\/+.\-]/', '', (string) ($in['media_mime'] ?? $in['attachment_mime'] ?? '')) ?? '', 0, 100)
        : '';
    $mediaFilename = $mediaId !== ''
        ? mb_substr(preg_replace('/[\x00-\x1F\x7F\/\\\\]/', '_', trim((string) ($in['media_filename'] ?? $in['attachment_filename'] ?? ''))) ?? '', 0, 255, 'UTF-8')
        : '';
    return [
        'event_key' => $key,
        'wa_id' => $wa,
        'direction' => $dir,
        'body' => $body,
        'ts' => $ts,
        'patient_name' => mb_substr(trim((string) ($in['patient_name'] ?? '')), 0, 120, 'UTF-8'),
        'source' => substr(preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) ($in['source'] ?? $defaultSource))) ?? '', 0, 24),
        'exec_id' => $execId !== '' ? substr($execId, 0, 32) : null,
        'media_id' => $mediaId !== '' ? $mediaId : null,
        'media_type' => $mediaType !== '' ? $mediaType : null,
        'media_mime' => $mediaMime !== '' ? $mediaMime : null,
        'media_filename' => $mediaFilename !== '' ? $mediaFilename : null,
    ];
}

/**
 * Inserta un evento. Idempotente y sin pérdida:
 *  - misma clave y mismo texto => duplicado (se ignora)
 *  - misma clave y texto contenido/subconjunto => duplicado (evita fantasma live+reconcile)
 *  - misma clave y texto distinto no relacionado => se guarda como variante
 * Lanza PDOException solo ante fallos reales de BD.
 *
 * @return string 'stored'|'duplicate'
 */

/**
 * Inserta un evento. Idempotente y sin pérdida:
 *  - misma clave y mismo texto => duplicado (se ignora)
 *  - misma clave y texto contenido/subconjunto => duplicado (evita fantasma live+reconcile)
 *  - misma clave y texto distinto no relacionado => se guarda como variante
 * Lanza PDOException solo ante fallos reales de BD.
 *
 * @return string 'stored'|'duplicate'
 */
function interacciones_insert_event(PDO $pdo, array $ev): string
{
    // REL: paciente_id en insert WA solo con REL_WRITE_IDS (lib_relational_resolve.php).
    $pacienteId = null;
    try {
        require_once __DIR__ . '/lib_relational_resolve.php';
        require_once __DIR__ . '/lib_migrations.php';
        if (kinesica_rel_write_ids() && kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id')) {
            $pacienteId = kinesica_rel_resolve_paciente_id_or_note($pdo, 'interacciones', [
                'wa_id' => (string) ($ev['wa_id'] ?? ''),
                'nombre' => (string) ($ev['patient_name'] ?? ''),
            ]);
        }
    } catch (Throwable) {
    }

    $hasPacienteCol = false;
    try {
        require_once __DIR__ . '/lib_migrations.php';
        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id');
    } catch (Throwable) {
    }

    if ($hasPacienteCol) {
        $sql = 'INSERT INTO interaccion_eventos (event_key, wa_id, paciente_id, direction, body, ts_utc, patient_name, source, exec_id, media_id, media_type, media_mime, media_filename, received_at)
                VALUES (:k, :wa, :pid, :dir, :body, :ts, :name, :src, :exec, :mid, :mtype, :mmime, :mfile, :rcv)';
    } else {
        $sql = 'INSERT INTO interaccion_eventos (event_key, wa_id, direction, body, ts_utc, patient_name, source, exec_id, media_id, media_type, media_mime, media_filename, received_at)
                VALUES (:k, :wa, :dir, :body, :ts, :name, :src, :exec, :mid, :mtype, :mmime, :mfile, :rcv)';
    }
    $params = [
        'k' => $ev['event_key'], 'wa' => $ev['wa_id'], 'dir' => $ev['direction'], 'body' => $ev['body'],
        'ts' => gmdate('Y-m-d H:i:s', (int) $ev['ts']), 'name' => $ev['patient_name'], 'src' => $ev['source'],
        'exec' => $ev['exec_id'],
        'mid' => $ev['media_id'] ?? null,
        'mtype' => $ev['media_type'] ?? null,
        'mmime' => $ev['media_mime'] ?? null,
        'mfile' => $ev['media_filename'] ?? null,
        'rcv' => gmdate('Y-m-d H:i:s'),
    ];
    if ($hasPacienteCol) {
        $params['pid'] = $pacienteId;
    }
    try {
        $pdo->prepare($sql)->execute($params);
        // REL: tocar conversación (estado) con paciente_id / wa_id (mig 007).
        try {
            require_once __DIR__ . '/lib_relational_interacciones.php';
            kinesica_rel_touch_interaccion_estado_paciente(
                $pdo,
                (string) ($ev['wa_id'] ?? ''),
                (int) ($ev['ts'] ?? time()),
                $pacienteId,
                (string) ($ev['patient_name'] ?? '')
            );
        } catch (Throwable) {
        }
        return 'stored';
    } catch (PDOException $e) {
        if (!interacciones_is_duplicate_error($e)) {
            throw $e;
        }
    }
    $stmt = $pdo->prepare('SELECT body, media_id FROM interaccion_eventos WHERE event_key = :k LIMIT 1');
    $stmt->execute(['k' => $ev['event_key']]);
    $existingRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $existing = is_array($existingRow) ? ($existingRow['body'] ?? false) : false;
    if ($existing === $ev['body']) {
        if (!empty($ev['media_id']) && empty($existingRow['media_id'])) {
            $upd = $pdo->prepare('UPDATE interaccion_eventos SET media_id = :mid, media_type = :mtype, media_mime = :mmime, media_filename = :mfile WHERE event_key = :k');
            $upd->execute([
                'mid' => $ev['media_id'],
                'mtype' => $ev['media_type'] ?? null,
                'mmime' => $ev['media_mime'] ?? null,
                'mfile' => $ev['media_filename'] ?? null,
                'k' => $ev['event_key'],
            ]);
        }
        return 'duplicate';
    }
    // Misma clave con texto relacionado (p. ej. live push concatenó followup y
    // reconcile reimporta solo final_message): no crear variante fantasma.
    $existingBody = is_string($existing) ? trim($existing) : '';
    $incomingBody = trim((string) ($ev['body'] ?? ''));
    if ($existingBody !== '' && $incomingBody !== '') {
        $existingHasIncoming = str_contains($existingBody, $incomingBody);
        $incomingHasExisting = str_contains($incomingBody, $existingBody);
        if ($existingHasIncoming || $incomingHasExisting) {
            if ($incomingHasExisting && mb_strlen($incomingBody, 'UTF-8') > mb_strlen($existingBody, 'UTF-8')) {
                $updBody = $pdo->prepare('UPDATE interaccion_eventos SET body = :body WHERE event_key = :k');
                $updBody->execute(['body' => $incomingBody, 'k' => $ev['event_key']]);
            }
            return 'duplicate';
        }
    }
    $params['k'] = substr($ev['event_key'], 0, 90) . '~' . substr(sha1($ev['body']), 0, 8);
    try {
        $pdo->prepare($sql)->execute($params);
        return 'stored';
    } catch (PDOException $e) {
        if (interacciones_is_duplicate_error($e)) {
            return 'duplicate';
        }
        throw $e;
    }
}


function interacciones_is_duplicate_error(PDOException $e): bool
{
    return (string) $e->getCode() === '23000' || (int) ($e->errorInfo[1] ?? 0) === 1062;
}

/**
 * Guarda eventos de forma durable. Si la BD falla, los pasa al spool en disco.
 *
 * @param list<array> $events eventos YA normalizados
 * @return array{stored:int,duplicates:int,spooled:int,failed:int}
 */
