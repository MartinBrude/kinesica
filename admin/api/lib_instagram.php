<?php
declare(strict_types=1);

/**
 * Cliente Instagram: publica feed y/o story. Anti-duplicado vía guards + media/container IDs.
 */

require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_instagram_copy.php';
require_once __DIR__ . '/lib_instagram_guard.php';

const IG_API = 'https://graph.instagram.com/v21.0';

function ig_http(string $method, string $url, array $params): array
{
    $ch = curl_init();
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_CUSTOMREQUEST => $method];
    if ($method === 'GET') {
        $url .= '?' . http_build_query($params);
    } else {
        $opts[CURLOPT_POSTFIELDS] = http_build_query($params);
    }
    $opts[CURLOPT_URL] = $url;
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    if ($raw === false) throw new RuntimeException('Red: ' . $err);
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) throw new RuntimeException('Respuesta inválida de Instagram');
    if (isset($data['error'])) {
        throw new RuntimeException('Instagram: ' . ($data['error']['message'] ?? json_encode($data['error'])));
    }
    return $data;
}

function ig_call(string $method, string $path, array $params, string $token): array
{
    return ig_http($method, (cfg()['instagram_api_base'] ?? IG_API) . '/' . $path, $params + ['access_token' => $token]);
}

function ig_wait_ready(string $containerId, string $token, int $tries = 24, int $sleep = 5): void
{
    for ($i = 0; $i < $tries; $i++) {
        $status = (string) (ig_call('GET', $containerId, ['fields' => 'status_code'], $token)['status_code'] ?? '');
        if ($status === 'FINISHED') return;
        if ($status === 'ERROR' || $status === 'EXPIRED') throw new RuntimeException('Contenedor ' . $status);
        sleep($sleep);
    }
    throw new RuntimeException('Timeout procesando la imagen en Instagram');
}

function ig_create_container(string $userId, string $token, string $imageUrl, string $caption, string $type): string
{
    $params = ['image_url' => $imageUrl];
    if ($type === 'story') $params['media_type'] = 'STORIES';
    else $params['caption'] = $caption;
    return (string) ig_call('POST', $userId . '/media', $params, $token)['id'];
}

function ig_publish_container(string $userId, string $token, string $containerId): string
{
    ig_wait_ready($containerId, $token);
    return (string) ig_call('POST', $userId . '/media_publish', ['creation_id' => $containerId], $token)['id'];
}

/**
 * Publica un canal con lock permanente. Nunca crea un segundo container si el slot ya existe.
 * @return string|null media_id o null si el canal no aplica / ya estaba
 */
function ig_publish_channel(array $item, string $channel, string $userId, string $token): ?string
{
    $id = (string) ($item['creativo_id'] ?? '');
    if ($id === '') throw new RuntimeException('Falta creativo_id');
    $fresh = ig_queue_find($id) ?: $item;
    $mediaKey = $channel === 'story' ? 'story_media_id' : 'feed_media_id';
    $containerKey = $channel === 'story' ? 'story_container_id' : 'feed_container_id';
    $pathKey = $channel === 'story' ? 'story_path' : 'feed_path';

    if (!empty($fresh[$mediaKey])) return (string) $fresh[$mediaKey];
    if (empty($fresh[$pathKey])) return null;

    if (!ig_guard_acquire(ig_channel_slot($id, $channel), $id)) {
        $again = ig_queue_find($id);
        if ($again && !empty($again[$mediaKey])) return (string) $again[$mediaKey];
        throw new RuntimeException(ucfirst($channel) . ' ya tiene un intento reservado; no se republica');
    }

    $container = !empty($fresh[$containerKey]) ? (string) $fresh[$containerKey] : '';
    if ($container === '') {
        $caption = $channel === 'story' ? '' : (string) ($fresh['caption'] ?? '');
        $container = ig_create_container($userId, $token, ig_asset_url((string) $fresh[$pathKey]), $caption, $channel);
        if ($channel === 'story') ig_save_container($id, null, $container);
        else ig_save_container($id, $container, null);
    }

    $mediaId = ig_publish_container($userId, $token, $container);
    if ($channel === 'story') ig_save_partial_media($id, null, $mediaId);
    else ig_save_partial_media($id, $mediaId, null);
    return $mediaId;
}

function ig_publish_piece(array $item, bool $publishFeed = true, bool $publishStory = true): array
{
    $c = cfg();
    $userId = (string) ($c['instagram_user_id'] ?? '');
    if ($userId === '') throw new RuntimeException('Falta instagram_user_id en config.php');
    ig_token_refresh_if_needed();
    $token = ig_token_get()['token'];
    if ($token === '') throw new RuntimeException('Falta instagram_token en config.php');

    ig_ensure_guard_table();
    $feedError = null;
    $storyError = null;
    $feedId = null;
    $storyId = null;

    if ($publishFeed) {
        try { $feedId = ig_publish_channel($item, 'feed', $userId, $token); }
        catch (Throwable $e) { $feedError = 'Feed: ' . $e->getMessage(); }
    }
    if ($publishStory) {
        try { $storyId = ig_publish_channel($item, 'story', $userId, $token); }
        catch (Throwable $e) { $storyError = 'Story: ' . $e->getMessage(); }
    }

    if (!$feedId && !$storyId) {
        $err = trim(($feedError ? $feedError . '; ' : '') . ($storyError ?: ''));
        ig_mark_attempt_failed($item['creativo_id'], $err ?: 'Fallo al publicar');
        throw new RuntimeException($err ?: 'No se pudo publicar en Instagram');
    }

    $today = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
    $combinedError = trim(($feedError ? $feedError . '; ' : '') . ($storyError ?: ''));
    ig_mark_published($item['creativo_id'], $today, $feedId, $storyId, $combinedError ?: null);

    return [
        'feed_media_id' => $feedId,
        'story_media_id' => $storyId,
        'published_on' => $today,
        'last_error' => $combinedError ?: null,
    ];
}

function ig_token_refresh_if_needed(): void
{
    $row = ig_token_get();
    if ($row['token'] === '') return;
    $base = (string) (cfg()['instagram_api_base'] ?? IG_API);
    if (str_contains($base, 'graph.facebook.com')) return;
    $exp = $row['expires_at'] ? strtotime($row['expires_at'] . ' UTC') : 0;
    if ($exp > time() + 20 * 86400) return;
    try {
        $r = ig_http('GET', 'https://graph.instagram.com/refresh_access_token',
            ['grant_type' => 'ig_refresh_token', 'access_token' => $row['token']]);
        ig_token_save((string) $r['access_token'], gmdate('Y-m-d H:i:s', time() + (int) ($r['expires_in'] ?? 5184000)));
    } catch (Throwable $e) {
        error_log('No se pudo renovar el token de Instagram: ' . $e->getMessage());
    }
}
