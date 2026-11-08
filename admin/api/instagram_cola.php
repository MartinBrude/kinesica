<?php
declare(strict_types=1);

/**
 * Kinésica Admin — Cola de publicación en Instagram.
 * GET  → lista de piezas en cola/publicadas con orden personalizado.
 * POST {action: add|remove|reorder, id, title, caption, feed_path, story_path, ids}
 * Cualquier usuario autenticado (Norberto/Martín) puede agregar, quitar o reordenar.
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
    } else {
        json_out(422, ['error' => 'Acción inválida']);
    }
    json_out(200, ['ok' => true, 'items' => ig_queue_list()]);
} catch (Throwable $e) {
    json_out(500, ['error' => 'No se pudo actualizar la cola de Instagram']);
}
