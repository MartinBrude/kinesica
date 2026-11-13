<?php
declare(strict_types=1);


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
