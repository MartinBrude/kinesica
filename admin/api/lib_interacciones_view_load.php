<?php
declare(strict_types=1);

/**
 * Construye el descriptor de archivo adjunto para un mensaje a partir de la BD y/o el sidecar en disco.
 *
 * @return array{media_id:string,type:string,mime:string,filename:string,available:bool,url:string,download_url:string}|null
 */
function interacciones_build_attachment_view(?string $mediaId, ?string $mediaType, ?string $mediaMime, ?string $mediaFilename): ?array
{
    $mid = interacciones_clean_media_id((string) ($mediaId ?? ''));
    if ($mid === '') {
        return null;
    }
    $type = trim((string) ($mediaType ?? ''));
    $mime = trim((string) ($mediaMime ?? ''));
    $filename = trim((string) ($mediaFilename ?? ''));
    $available = false;

    $dir = interacciones_media_dir();
    $metaFile = $dir . '/' . $mid . '.json';
    if (is_file($metaFile)) {
        $meta = json_decode((string) @file_get_contents($metaFile), true);
        if (is_array($meta)) {
            if ($mime === '' && !empty($meta['mime_type'])) {
                $mime = (string) $meta['mime_type'];
            }
            if ($filename === '' && !empty($meta['filename'])) {
                $filename = (string) $meta['filename'];
            }
            if ($type === '' && !empty($meta['media_type'])) {
                $type = (string) $meta['media_type'];
            }
            $storedFile = isset($meta['stored_file']) ? basename((string) $meta['stored_file']) : '';
            if ($storedFile !== '' && is_file($dir . '/' . $storedFile)) {
                $available = true;
            }
        }
    }

    if ($type === '') {
        if (str_starts_with($mime, 'image/')) {
            $type = 'imagen';
        } elseif (str_starts_with($mime, 'audio/')) {
            $type = 'audio';
        } elseif (str_starts_with($mime, 'video/')) {
            $type = 'video';
        } else {
            $type = 'documento';
        }
    }
    if ($mime === '') {
        $mime = match ($type) {
            'imagen' => 'image/jpeg',
            'audio' => 'audio/ogg',
            'video' => 'video/mp4',
            default => 'application/pdf',
        };
    }
    if ($filename === '') {
        $filename = match ($type) {
            'imagen' => 'imagen_adjunta.jpg',
            'audio' => 'audio_voz.ogg',
            'video' => 'video_adjunto.mp4',
            default => 'documento.pdf',
        };
    }

    $q = rawurlencode($mid);
    return [
        'media_id' => $mid,
        'type' => $type,
        'mime' => $mime,
        'filename' => $filename,
        'available' => $available,
        'url' => '/admin/api/interacciones_media.php?media_id=' . $q,
        'download_url' => '/admin/api/interacciones_media.php?media_id=' . $q . '&download=1',
    ];
}

/**
 * Oculta (solo en la vista) eventos "gemelos": el mismo mensaje registrado por una fuente sin id de WhatsApp
 * y por otra con id. Empareja 1 a 1; nada se borra.
 *
 * @param list<array> $events
 * @return array<int,true> ids de eventos ocultos
 */
function interacciones_hidden_twins(array $events): array
{
    $hidden = [];
    foreach ($events as $a) {
        if (strncmp($a['event_key'], 'wa:', 3) !== 0) {
            continue;
        }
        $bestId = null;
        $bestDiff = 181;
        foreach ($events as $b) {
            if (isset($hidden[$b['id']]) || strncmp($b['event_key'], 'wa:', 3) === 0) {
                continue;
            }
            if ($b['direction'] !== $a['direction'] || $b['body'] !== $a['body']) {
                continue;
            }
            $diff = abs($b['ts'] - $a['ts']);
            if ($diff < $bestDiff) {
                $bestDiff = $diff;
                $bestId = $b['id'];
            }
        }
        if ($bestId !== null) {
            $hidden[$bestId] = true;
        }
    }
    return $hidden;
}
