<?php
declare(strict_types=1);

/**
 * Kinésica Admin — Cola de publicación en Instagram.
 * GET  → lista de piezas en cola/publicadas con orden personalizado y estado de canales.
 * POST {action: add|remove|reorder|publish_now, id, title, caption, feed_path, story_path, ids, channel}
 * Cualquier usuario autenticado (Norberto/Martín) puede agregar, quitar, reordenar o publicar.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_instagram_store.php';

require_header();
$auth = require_auth();
$user = (string) ($auth['username'] ?? $auth['user'] ?? '');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        json_out(200, ['items' => ig_queue_list()]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(405, ['error' => 'Método no permitido']);
    }
    $body = read_json();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'add') {
        if (!ig_queue_add($body, $user)) {
            json_out(422, ['error' => 'Datos de la pieza inválidos']);
        }
    } elseif ($action === 'remove') {
        ig_queue_remove((string) ($body['id'] ?? ''));
    } elseif ($action === 'reorder') {
        $ids = is_array($body['ids'] ?? null) ? $body['ids'] : [];
        ig_queue_reorder($ids);
    } elseif ($action === 'publish_now') {
        $id = (string) ($body['id'] ?? '');
        $channel = (string) ($body['channel'] ?? 'both');
        if (!ig_queue_find($id)) {
            if (!ig_queue_add($body, $user)) {
                json_out(422, ['error' => 'Datos de la pieza inválidos']);
            }
        }
        $item = ig_queue_find($id);
        if (!$item) json_out(404, ['error' => 'Pieza no encontrada']);
        @set_time_limit(180);
        require_once __DIR__ . '/lib_instagram.php';
        $res = ig_publish_piece($item, $channel !== 'story', $channel !== 'feed');
        json_out(200, ['ok' => true, 'result' => $res, 'items' => ig_queue_list()]);
    } else {
        json_out(422, ['error' => 'Acción inválida']);
    }
    json_out(200, ['ok' => true, 'items' => ig_queue_list()]);
} catch (Throwable $e) {
    json_out(500, ['error' => $e->getMessage() ?: 'Error al procesar la cola de Instagram']);
}
