<?php
declare(strict_types=1);

/**
 * Almacén durable de interacciones de WhatsApp.
 *
 * Principios:
 *  - Solo se AGREGA: los eventos (mensajes) son inmutables y tienen clave única (idempotencia).
 *  - Si la BD falla, el evento se guarda en un spool en disco y se reintegra luego: nunca se descarta.
 *  - La vista (conversaciones) se deriva de los eventos; ver lib_interacciones_view.php.
 */

require_once __DIR__ . '/lib_interacciones_spool.php';

const INTERACCIONES_MAX_BODY = 16000;
const INTERACCIONES_MAX_BATCH = 200;

function interacciones_dir(): string
{
    $dir = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    if ($dir === '') {
        $dir = __DIR__ . '/data';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function interacciones_media_dir(): string
{
    $custom = defined('KINESICA_INTERACCIONES_DIR') ? (string) KINESICA_INTERACCIONES_DIR : (string) getenv('KINESICA_INTERACCIONES_DIR');
    $dir = $custom !== '' ? ($custom . '/media') : (dirname(__DIR__) . '/uploads/interacciones');
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        if (!is_file($dir . '/.htaccess')) {
            @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        }
    }
    return $dir;
}

function interacciones_clean_media_id(string $raw): string
{
    $clean = preg_replace('/[^A-Za-z0-9_\-.]/', '', trim($raw)) ?? '';
    $clean = ltrim($clean, '.');
    return (strlen($clean) >= 3 && strlen($clean) <= 128) ? $clean : '';
}

function interacciones_tz(): DateTimeZone
{
    $name = 'America/Argentina/Buenos_Aires';
    if (function_exists('cfg')) {
        $configured = cfg()['interacciones_tz'] ?? '';
        if (is_string($configured) && $configured !== '') {
            $name = $configured;
        }
    }
    try {
        return new DateTimeZone($name);
    } catch (Throwable $e) {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    }
}

function interacciones_pdo(?PDO $pdo = null): PDO
{
    return $pdo ?? db();
}

function interacciones_ensure_schema(?PDO $pdo = null): void
{
    static $done = null;
    $pdo = interacciones_pdo($pdo);
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_eventos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(100) NOT NULL,
            wa_id VARCHAR(32) NOT NULL,
            direction VARCHAR(16) NOT NULL,
            body MEDIUMTEXT NOT NULL,
            ts_utc DATETIME NOT NULL,
            patient_name VARCHAR(120) NOT NULL DEFAULT \'\',
            source VARCHAR(24) NOT NULL DEFAULT \'\',
            exec_id VARCHAR(32) NULL,
            media_id VARCHAR(128) NULL,
            media_type VARCHAR(32) NULL,
            media_mime VARCHAR(100) NULL,
            media_filename VARCHAR(255) NULL,
            received_at DATETIME NOT NULL,
            UNIQUE KEY uq_event_key (event_key),
            KEY idx_wa_ts (wa_id, ts_utc),
            KEY idx_ts (ts_utc)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM interaccion_eventos LIKE 'media_id'");
        if ($cols && !$cols->fetchColumn()) {
            $pdo->exec(
                'ALTER TABLE interaccion_eventos
                 ADD COLUMN media_id VARCHAR(128) NULL AFTER exec_id,
                 ADD COLUMN media_type VARCHAR(32) NULL AFTER media_id,
                 ADD COLUMN media_mime VARCHAR(100) NULL AFTER media_type,
                 ADD COLUMN media_filename VARCHAR(255) NULL AFTER media_mime'
            );
        }
    } catch (Throwable $e) {
    }
    // Puente relacional (migración 002). Retirar tras etapa 10.
    try {
        require_once __DIR__ . '/lib_migrations.php';
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'interaccion_eventos',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
    } catch (Throwable $e) {
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS interaccion_estado (
            conversation_key VARCHAR(64) NOT NULL PRIMARY KEY,
            legacy_id VARCHAR(64) NULL,
            answered TINYINT(1) NOT NULL DEFAULT 0,
            answered_at DATETIME NULL,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            archived_at DATETIME NULL,
            category VARCHAR(40) NULL,
            category_label VARCHAR(80) NULL,
            summary VARCHAR(255) NULL,
            patient_name VARCHAR(120) NULL,
            updated_at DATETIME NOT NULL,
            updated_by VARCHAR(60) NOT NULL DEFAULT \'\',
            KEY idx_legacy (legacy_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $done[$pdo] = true;
}

/** Epoch desde epoch numérico, ISO-8601 o 'Y-m-d H:i:s' (UTC si no trae zona). */
function interacciones_parse_ts($value, int $fallback): int
{
    if (is_int($value) || (is_string($value) && preg_match('/^\d{9,13}(\.\d+)?$/', $value))) {
        $n = (float) $value;
        return (int) ($n > 99999999999 ? $n / 1000 : $n);
    }
    if (is_string($value) && trim($value) !== '') {
        try {
            return (new DateTimeImmutable(trim($value), new DateTimeZone('UTC')))->getTimestamp();
        } catch (Throwable $e) {
        }
    }
    return $fallback;
}

/**
 * Normaliza wa_id a dígitos. Para celulares AR unifica 54 11… → 549 11…
 * (Meta a veces manda sin el 9; el recordatorio/n8n con 549 → dos hilos si no se unifica).
 * No aplica clean_phone_number a números no AR (p. ej. +34).
 */
function interacciones_clean_wa_id(string $raw): string
{
    if (!function_exists('clean_phone_number')) {
        $helpers = __DIR__ . '/pacientes_helpers.php';
        if (is_file($helpers)) {
            require_once $helpers;
        }
    }
    $digits = preg_replace('/\D/', '', $raw) ?? '';
    if ($digits === '') {
        return '';
    }
    $isAr = str_starts_with($digits, '54')
        || str_starts_with($digits, '0')
        || (strlen($digits) === 10 && (str_starts_with($digits, '11') || str_starts_with($digits, '15')))
        || strlen($digits) === 8;
    if ($isAr && function_exists('clean_phone_number')) {
        $normalized = clean_phone_number($digits);
        if ($normalized !== '') {
            return $normalized;
        }
    }
    return $digits;
}

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
 *  - misma clave y texto distinto => se guarda como variante (nunca se descarta)
 * Lanza PDOException solo ante fallos reales de BD.
 *
 * @return string 'stored'|'duplicate'
 */
function interacciones_insert_event(PDO $pdo, array $ev): string
{
    $sql = 'INSERT INTO interaccion_eventos (event_key, wa_id, direction, body, ts_utc, patient_name, source, exec_id, media_id, media_type, media_mime, media_filename, received_at)
            VALUES (:k, :wa, :dir, :body, :ts, :name, :src, :exec, :mid, :mtype, :mmime, :mfile, :rcv)';
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
    try {
        $pdo->prepare($sql)->execute($params);
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
function interacciones_store_events(array $events, ?PDO $pdo = null): array
{
    $res = ['stored' => 0, 'duplicates' => 0, 'spooled' => 0, 'failed' => 0];
    $remaining = array_values($events);
    try {
        $pdo = interacciones_pdo($pdo);
        interacciones_ensure_schema($pdo);
        while ($remaining) {
            $outcome = interacciones_insert_event($pdo, $remaining[0]);
            $res[$outcome === 'stored' ? 'stored' : 'duplicates']++;
            array_shift($remaining);
        }
    } catch (Throwable $e) {
        error_log('interacciones: BD no disponible, enviando a spool: ' . $e->getMessage());
        if ($remaining) {
            if (interacciones_spool_append($remaining)) {
                $res['spooled'] += count($remaining);
            } else {
                $res['failed'] += count($remaining);
            }
        }
    }
    return $res;
}

/**
 * Mapa de MIME types permitidos para archivos adjuntos de pacientes en WhatsApp.
 *
 * @return array<string,string> mime => extensión segura
 */
function interacciones_allowed_media_mimes(): array
{
    return [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'application/pdf' => 'pdf',
        'audio/ogg' => 'ogg',
        'application/ogg' => 'ogg',
        'audio/mpeg' => 'mp3',
        'audio/mp3' => 'mp3',
        'audio/mp4' => 'm4a',
        'audio/x-m4a' => 'm4a',
        'audio/aac' => 'aac',
        'audio/amr' => 'amr',
        'video/mp4' => 'mp4',
        'video/3gpp' => '3gp',
        'video/webm' => 'webm',
        'text/plain' => 'txt',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    ];
}

/**
 * Persiste en disco el archivo binario de un adjunto de interacción y enlaza su metadata.
 *
 * @param array $in {media_id, data_base64?, raw_bytes?, mime_type?, filename?, media_type?, wa_id?, message_id?}
 * @return array{ok:bool,error?:string,status?:int,media_id?:string,mime_type?:string,filename?:string,size?:int}
 */
function interacciones_media_save(array $in, ?PDO $pdo = null): array
{
    $mid = interacciones_clean_media_id((string) ($in['media_id'] ?? ''));
    if ($mid === '') {
        return ['ok' => false, 'status' => 400, 'error' => 'media_id inválido o faltante'];
    }

    $bytes = null;
    if (isset($in['raw_bytes']) && is_string($in['raw_bytes'])) {
        $bytes = $in['raw_bytes'];
    } elseif (!empty($in['data_base64']) && is_string($in['data_base64'])) {
        $b64 = trim($in['data_base64']);
        if (str_contains($b64, ',')) {
            $b64 = substr($b64, strpos($b64, ',') + 1);
        }
        $decoded = base64_decode($b64, true);
        if (is_string($decoded)) {
            $bytes = $decoded;
        }
    }

    if (!is_string($bytes) || $bytes === '') {
        return ['ok' => false, 'status' => 400, 'error' => 'Contenido de archivo vacío o base64 inválido'];
    }

    $maxBytes = 20 * 1024 * 1024; // 20 MB
    $size = strlen($bytes);
    if ($size > $maxBytes) {
        return ['ok' => false, 'status' => 413, 'error' => 'El archivo supera el límite de 20 MB'];
    }

    $declaredMime = strtolower(trim(explode(';', (string) ($in['mime_type'] ?? ''))[0] ?? ''));
    $detectedMime = '';
    if (function_exists('finfo_open')) {
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $detectedMime = strtolower(trim((string) @finfo_buffer($finfo, $bytes)));
            @finfo_close($finfo);
        }
    }

    $allowed = interacciones_allowed_media_mimes();
    $mime = '';
    if ($detectedMime !== '' && isset($allowed[$detectedMime])) {
        $mime = $detectedMime;
    } elseif ($declaredMime !== '' && isset($allowed[$declaredMime]) && ($detectedMime === '' || $detectedMime === 'application/octet-stream')) {
        $mime = $declaredMime;
    }

    if ($mime === '') {
        return ['ok' => false, 'status' => 422, 'error' => 'Tipo de archivo no permitido (' . ($detectedMime ?: $declaredMime ?: 'desconocido') . ')'];
    }

    $ext = $allowed[$mime];
    $mediaType = trim((string) ($in['media_type'] ?? ''));
    if ($mediaType === '') {
        if (str_starts_with($mime, 'image/')) {
            $mediaType = 'imagen';
        } elseif (str_starts_with($mime, 'audio/')) {
            $mediaType = 'audio';
        } elseif (str_starts_with($mime, 'video/')) {
            $mediaType = 'video';
        } else {
            $mediaType = 'documento';
        }
    }

    $rawFilename = trim((string) ($in['filename'] ?? ''));
    $safeFilename = preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]/', '_', $rawFilename) ?? '';
    $safeFilename = trim($safeFilename, '. ');
    if ($safeFilename === '') {
        $safeFilename = $mediaType . '_' . $mid . '.' . $ext;
    } elseif (pathinfo($safeFilename, PATHINFO_EXTENSION) === '') {
        $safeFilename .= '.' . $ext;
    }
    $safeFilename = mb_substr($safeFilename, 0, 200, 'UTF-8');

    $dir = interacciones_media_dir();
    $storedFile = $mid . '.' . $ext;
    $binPath = $dir . '/' . $storedFile;
    $metaPath = $dir . '/' . $mid . '.json';

    if (@file_put_contents($binPath, $bytes, LOCK_EX) !== $size) {
        return ['ok' => false, 'status' => 500, 'error' => 'No se pudo guardar el archivo en disco'];
    }

    $meta = [
        'media_id' => $mid,
        'stored_file' => $storedFile,
        'mime_type' => $mime,
        'media_type' => $mediaType,
        'filename' => $safeFilename,
        'size' => $size,
        'wa_id' => interacciones_clean_wa_id((string) ($in['wa_id'] ?? '')),
        'message_id' => trim((string) ($in['message_id'] ?? '')),
        'saved_at' => gmdate('c'),
    ];
    @file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);

    // Enlazar en interaccion_eventos si existe el mensaje por message_id o media_id
    try {
        $dbConn = $pdo ?? (function_exists('db') ? db() : null);
        if ($dbConn instanceof PDO) {
            interacciones_ensure_schema($dbConn);
            $msgId = trim((string) ($in['message_id'] ?? ''));
            if ($msgId !== '') {
                $evKey = 'wa:' . substr(preg_replace('/[^A-Za-z0-9=_\-.]/', '', $msgId) ?? '', 0, 80);
                $stmt = $dbConn->prepare(
                    'UPDATE interaccion_eventos
                     SET media_id = COALESCE(NULLIF(media_id, \'\'), :mid),
                         media_type = COALESCE(NULLIF(media_type, \'\'), :mtype),
                         media_mime = COALESCE(NULLIF(media_mime, \'\'), :mmime),
                         media_filename = COALESCE(NULLIF(media_filename, \'\'), :mfile)
                     WHERE event_key = :k AND direction = \'patient\''
                );
                $stmt->execute([
                    'mid' => $mid,
                    'mtype' => $mediaType,
                    'mmime' => $mime,
                    'mfile' => $safeFilename,
                    'k' => $evKey,
                ]);
            }
        }
    } catch (Throwable $e) {
    }

    return [
        'ok' => true,
        'status' => 200,
        'media_id' => $mid,
        'mime_type' => $mime,
        'media_type' => $mediaType,
        'filename' => $safeFilename,
        'size' => $size,
    ];
}

/**
 * Resuelve un archivo adjunto por su media_id desde disco (o bajo demanda vía Graph API si hay WHATSAPP_TOKEN).
 *
 * @return array{path:string,mime_type:string,filename:string,size:int,media_id:string}|null
 */
function interacciones_media_resolve(string $rawMediaId): ?array
{
    $mid = interacciones_clean_media_id($rawMediaId);
    if ($mid === '') {
        return null;
    }

    $dir = interacciones_media_dir();
    $metaPath = $dir . '/' . $mid . '.json';
    if (is_file($metaPath)) {
        $meta = json_decode((string) @file_get_contents($metaPath), true);
        if (is_array($meta) && !empty($meta['stored_file'])) {
            $candidate = $dir . '/' . basename((string) $meta['stored_file']);
            if (is_file($candidate)) {
                return [
                    'path' => $candidate,
                    'mime_type' => (string) ($meta['mime_type'] ?? 'application/octet-stream'),
                    'filename' => (string) ($meta['filename'] ?? basename($candidate)),
                    'size' => (int) filesize($candidate),
                    'media_id' => $mid,
                ];
            }
        }
    }

    // Fallback: buscar archivo {mid}.{ext} directamente en el directorio
    $allowed = interacciones_allowed_media_mimes();
    foreach (array_unique(array_values($allowed)) as $ext) {
        $candidate = $dir . '/' . $mid . '.' . $ext;
        if (is_file($candidate)) {
            $mime = array_search($ext, $allowed, true) ?: 'application/octet-stream';
            return [
                'path' => $candidate,
                'mime_type' => (string) $mime,
                'filename' => $mid . '.' . $ext,
                'size' => (int) filesize($candidate),
                'media_id' => $mid,
            ];
        }
    }

    // Fallback bajo demanda: si existe WHATSAPP_TOKEN en el servidor, descargar de Meta Graph API y cachear
    if (function_exists('curl_init')) {
        if (!function_exists('whatsapp_credentials') && is_file(__DIR__ . '/lib_whatsapp.php')) {
            require_once __DIR__ . '/lib_whatsapp.php';
        }
        $token = function_exists('whatsapp_credentials') ? (whatsapp_credentials()['token'] ?? '') : '';
        if ($token !== '') {
            $ch = curl_init('https://graph.facebook.com/v21.0/' . rawurlencode($mid));
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
                CURLOPT_TIMEOUT => 10,
            ]);
            $infoResp = curl_exec($ch);
            $infoCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $infoJson = is_string($infoResp) ? json_decode($infoResp, true) : null;
            $dlUrl = is_array($infoJson) ? (string) ($infoJson['url'] ?? '') : '';
            if ($infoCode === 200 && $dlUrl !== '') {
                $ch2 = curl_init($dlUrl);
                curl_setopt_array($ch2, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_HTTPHEADER => [
                        'Authorization: Bearer ' . $token,
                        'User-Agent: curl/7.68.0',
                    ],
                    CURLOPT_TIMEOUT => 15,
                ]);
                $rawBytes = curl_exec($ch2);
                $dlCode = (int) curl_getinfo($ch2, CURLINFO_HTTP_CODE);
                curl_close($ch2);
                if ($dlCode === 200 && is_string($rawBytes) && $rawBytes !== '') {
                    $saved = interacciones_media_save([
                        'media_id' => $mid,
                        'raw_bytes' => $rawBytes,
                        'mime_type' => (string) ($infoJson['mime_type'] ?? ''),
                    ]);
                    if (!empty($saved['ok'])) {
                        return interacciones_media_resolve($mid);
                    }
                }
            }
        }
    }

    return null;
}
