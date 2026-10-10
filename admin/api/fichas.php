<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    require_header();
}
$auth = require_auth();
$pdo = db();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT payload FROM fichas ORDER BY updated_at DESC')->fetchAll();
    $items = [];
    foreach ($rows as $row) {
        $item = json_decode($row['payload'], true);
        if (is_array($item)) {
            $items[] = $item;
        }
    }
    json_out(200, $items);
}

if ($method === 'POST') {
    $data = read_json();
    $id = (string) ($data['id'] ?? '');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id) || trim((string) ($data['nombre'] ?? '')) === '') {
        json_out(422, ['error' => 'La ficha necesita un nombre']);
    }
    $names = ['norberto' => 'Norberto', 'maria' => 'María', 'martin' => 'Martín'];
    $profesional = (string) ($data['profesional'] ?? '');
    if (!isset($names[$profesional])) {
        $profesional = $auth['username'];
    }
    $data['profesional'] = $profesional;
    $data['profesionalNombre'] = $names[$profesional];
    $data['savedAt'] = gmdate('c');
    $stmt = $pdo->prepare(
        'INSERT INTO fichas (id, payload, profesional, updated_at, updated_by)
         VALUES (:id, :payload, :profesional, UTC_TIMESTAMP(), :user)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)'
    );
    $stmt->execute([
        'id' => $id,
        'payload' => json_encode($data, JSON_UNESCAPED_UNICODE),
        'profesional' => $profesional,
        'user' => $auth['username'],
    ]);
    json_out(200, $data);
}

if ($method === 'DELETE') {
    $id = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        json_out(422, ['error' => 'Ficha inválida']);
    }
    $pdo->prepare('DELETE FROM fichas WHERE id = :id')->execute(['id' => $id]);
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
