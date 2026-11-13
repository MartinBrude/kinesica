<?php
declare(strict_types=1);


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
