<?php
declare(strict_types=1);

/**
 * Kinésica Admin — Cola de publicación en Instagram.
 * GET  → lista de piezas en cola/publicadas con orden personalizado y estado de canales.
 * POST {action: add|remove|reorder|publish_now|update_caption|update_channels|set_enabled, ...}
 * Cualquier usuario autenticado (Norberto/Martín) puede gestionar cola, canales y activar/pausar el servicio.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_instagram_copy.php';
require_once __DIR__ . '/lib_instagram_guard.php';

require_header();
$auth = require_auth();
$user = (string) ($auth['username'] ?? $auth['user'] ?? '');

function ig_cola_payload(array $extra = []): array
{
    return $extra + [
        'ok' => true,
        'items' => ig_queue_list(),
        'copies' => ig_copy_map(),
        'enabled' => ig_service_enabled(),
    ];
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        json_out(200, ig_cola_payload());
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(405, ['error' => 'Método no permitido']);
    }
    $body = read_json();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'add') {
        $id = (string) ($body['id'] ?? '');
        $ex = ig_queue_find($id);
        if ($ex && ($ex['status'] ?? '') === 'published') {
            json_out(409, ['error' => 'Esta pieza ya fue publicada; no se puede re-encolar']);
        }
        if ($ex && ($ex['status'] ?? '') === 'publishing') {
            json_out(409, ['error' => 'Hay una publicación en curso para esta pieza']);
        }
        if ($id !== '' && ig_has_publish_progress($id)) {
            json_out(409, ['error' => 'Esta pieza ya tiene un intento de publicación reservado; no se reencola']);
        }
        if (!ig_queue_add($body, $user)) {
            json_out(422, ['error' => 'Datos de la pieza inválidos']);
        }
    } elseif ($action === 'remove') {
        ig_queue_remove((string) ($body['id'] ?? ''));
    } elseif ($action === 'reorder') {
        $ids = is_array($body['ids'] ?? null) ? $body['ids'] : [];
        ig_queue_reorder($ids);
    } elseif ($action === 'update_caption') {
        $id = (string) ($body['id'] ?? '');
        $caption = (string) ($body['caption'] ?? '');
        if (!ig_caption_save($id, $caption, $user)) {
            json_out(422, ['error' => 'Caption inválido (vacío o > ' . IG_CAPTION_MAX . ' caracteres)']);
        }
    } elseif ($action === 'update_channels') {
        $id = (string) ($body['id'] ?? '');
        $channel = (string) ($body['channel'] ?? $body['channels'] ?? 'both');
        if (!ig_queue_set_channels($id, $channel)) {
            json_out(422, ['error' => 'Canal inválido o pieza no está en cola']);
        }
    } elseif ($action === 'set_enabled') {
        ig_service_set_enabled(!empty($body['enabled']), $user);
    } elseif ($action === 'publish_now') {
        $id = (string) ($body['id'] ?? '');
        if (!ig_queue_find($id)) {
            if ($id !== '' && ig_has_publish_progress($id)) {
                json_out(409, ['error' => 'Esta pieza ya tiene un intento de publicación reservado']);
            }
            if (!ig_queue_add($body, $user)) {
                json_out(422, ['error' => 'Datos de la pieza inválidos']);
            }
        }
        $existing = ig_queue_find($id);
        if (!$existing) json_out(404, ['error' => 'Pieza no encontrada']);
        if (($existing['status'] ?? '') === 'published') {
            json_out(409, ['error' => 'Esta pieza ya fue publicada']);
        }
        $channel = ig_normalize_channel((string) ($body['channel'] ?? $existing['channels'] ?? 'both'));
        if ($channel !== ig_normalize_channel((string) ($existing['channels'] ?? 'both'))) {
            ig_queue_set_channels($id, $channel);
        }
        $item = ig_queue_claim($id);
        if (!$item) {
            json_out(409, ['error' => 'Ya hay una publicación en curso para esta pieza']);
        }
        $item['channels'] = $channel;
        // Feed+Story: hasta ~2×120s de wait Meta + HTTP; margen sobre el timeout cliente 300s.
        @set_time_limit(300);
        ig_release_stale_publishing();
        require_once __DIR__ . '/lib_instagram.php';
        try {
            $res = ig_publish_piece($item, $channel !== 'story', $channel !== 'feed');
            json_out(200, ig_cola_payload(['result' => $res]));
        } catch (Throwable $e) {
            ig_queue_release_claim($id);
            throw $e;
        }
    } else {
        json_out(422, ['error' => 'Acción inválida']);
    }
    json_out(200, ig_cola_payload());
} catch (Throwable $e) {
    json_out(500, ['error' => $e->getMessage() ?: 'Error al procesar la cola de Instagram']);
}
