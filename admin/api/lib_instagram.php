<?php
declare(strict_types=1);

/**
 * Kinésica — Cliente mínimo de la API de Instagram (Instagram Login, graph.instagram.com).
 * Publica un post de feed y/o una story a partir de URLs públicas de imagen.
 */

require_once __DIR__ . '/lib_instagram_store.php';

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

/** Publica una imagen. $type: 'feed' | 'story'. Devuelve el media id. */
function ig_publish_image(string $userId, string $token, string $imageUrl, string $caption, string $type): string
{
    $params = ['image_url' => $imageUrl];
    if ($type === 'story') {
        $params['media_type'] = 'STORIES';
    } else {
        $params['caption'] = $caption;
    }
    $container = (string) ig_call('POST', $userId . '/media', $params, $token)['id'];
    ig_wait_ready($container, $token);
    return (string) ig_call('POST', $userId . '/media_publish', ['creation_id' => $container], $token)['id'];
}

/**
 * Publica una pieza en Instagram (Feed, Story o ambos) y actualiza su registro en instagram_cola.
 */
function ig_publish_piece(array $item, bool $publishFeed = true, bool $publishStory = true): array
{
    $c = cfg();
    $userId = (string) ($c['instagram_user_id'] ?? '');
    if ($userId === '') throw new RuntimeException('Falta instagram_user_id en config.php');
    ig_token_refresh_if_needed();
    $token = ig_token_get()['token'];
    if ($token === '') throw new RuntimeException('Falta instagram_token en config.php');

    $feedId = null;
    $storyId = null;
    $feedError = null;
    $storyError = null;

    if ($publishFeed && !empty($item['feed_path'])) {
        try {
            $feedId = ig_publish_image($userId, $token, ig_asset_url($item['feed_path']), $item['caption'] ?? '', 'feed');
        } catch (Throwable $e) {
            $feedError = 'Feed: ' . $e->getMessage();
        }
    }

    if ($publishStory && !empty($item['story_path'])) {
        try {
            $storyId = ig_publish_image($userId, $token, ig_asset_url($item['story_path']), '', 'story');
        } catch (Throwable $e) {
            $storyError = 'Story: ' . $e->getMessage();
        }
    }

    if (!$feedId && !$storyId) {
        $err = trim(($feedError ? $feedError . '; ' : '') . ($storyError ?: ''));
        ig_mark_attempt_failed($item['creativo_id'], $err ?: 'Fallo al publicar');
        throw new RuntimeException($err ?: 'No se pudo publicar en Instagram');
    }

    $now = new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires'));
    $today = $now->format('Y-m-d');
    $combinedError = trim(($feedError ? $feedError . '; ' : '') . ($storyError ?: ''));
    ig_mark_published($item['creativo_id'], $today, $feedId, $storyId, $combinedError ?: null);

    return [
        'feed_media_id' => $feedId,
        'story_media_id' => $storyId,
        'published_on' => $today,
        'last_error' => $combinedError ?: null,
    ];
}

/** Renueva el token si vence en menos de 20 días (o no se conoce el vencimiento). */
function ig_token_refresh_if_needed(): void
{
    $row = ig_token_get();
    if ($row['token'] === '') return;
    $exp = $row['expires_at'] ? strtotime($row['expires_at'] . ' UTC') : 0;
    if ($exp > time() + 20 * 86400) return;
    try {
        $r = ig_http('GET', 'https://graph.instagram.com/refresh_access_token',
            ['grant_type' => 'ig_refresh_token', 'access_token' => $row['token']]);
        ig_token_save((string) $r['access_token'], gmdate('Y-m-d H:i:s', time() + (int) ($r['expires_in'] ?? 5184000)));
    } catch (Throwable $e) {
        fwrite(STDERR, 'No se pudo renovar el token de Instagram: ' . $e->getMessage() . "\n");
    }
}
