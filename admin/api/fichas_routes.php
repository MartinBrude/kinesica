<?php
declare(strict_types=1);

/**
 * Rutas GET/POST/DELETE de fichas.php.
 */

if ($method === 'GET') {
    kinesica_fichas_get_all($pdo);
}

if ($method === 'POST') {
    require __DIR__ . '/fichas_post.php';
}

if ($method === 'DELETE') {
    if (is_colaborador($auth)) {
        json_out(403, ['error' => 'Los usuarios con rol Colaborador no tienen permisos para eliminar historias clínicas.']);
    }
    $id = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
        json_out(422, ['error' => 'Ficha inválida']);
    }
    $stmt = $pdo->prepare('SELECT payload, profesional FROM fichas WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if ($row) {
        $owner = $row['profesional'] ?? '';
        if ($owner !== false && $owner !== '' && !is_admin($auth) && $auth['username'] !== (string) $owner) {
            json_out(403, ['error' => 'No tienes permiso para eliminar esta ficha']);
        }
        $prevData = json_decode((string) ($row['payload'] ?? ''), true);
        if (is_array($prevData)) {
            foreach (kinesica_extract_ficha_photos($prevData) as $fName) {
                $fileTarget = __DIR__ . '/../uploads/' . $fName;
                if (is_file($fileTarget)) @unlink($fileTarget);
            }
        }
    }
    $pdo->prepare('DELETE FROM fichas WHERE id = :id')->execute(['id' => $id]);
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
