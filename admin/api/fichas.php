<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
require_header();
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
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        json_out(422, ['error' => 'La ficha no es válida']);
    }
    // Autocálculo de resguardo de edad a partir de fecha de nacimiento y fecha de sesión
    if (trim((string) ($data['edad'] ?? '')) === '' && !empty($data['nacimiento']) && !empty($data['fechaSesion'])) {
        try {
            $birth = new DateTimeImmutable((string) $data['nacimiento']);
            $session = new DateTimeImmutable((string) $data['fechaSesion']);
            $data['edad'] = (string) $session->diff($birth)->y;
        } catch (Throwable) {
            // Ignorar formato inválido para que falle la validación posterior
        }
    }
    $required = [
        'nombre' => 'el nombre completo',
        'dni' => 'el DNI / Pasaporte',
        'fechaSesion' => 'la fecha de la sesión',
        'nacimiento' => 'la fecha de nacimiento',
        'edad' => 'la edad',
        'motivo' => 'el motivo de consulta',
        'antecedentes' => 'los antecedentes clínicos',
    ];
    $missing = [];
    foreach ($required as $key => $label) {
        if (trim((string) ($data[$key] ?? '')) === '') {
            $missing[] = $label;
        }
    }
    if ($missing) {
        json_out(422, ['error' => 'Falta completar: ' . implode(', ', $missing) . '.']);
    }
    $clinicians = ['norberto' => 'Norberto', 'maria' => 'María'];
    $existing = $pdo->prepare('SELECT profesional FROM fichas WHERE id = :id');
    $existing->execute(['id' => $id]);
    $previous = $existing->fetchColumn();
    if ($auth['username'] === 'martin') {
        $requested = (string) ($data['profesional'] ?? '');
        if (isset($clinicians[$requested])) {
            $profesional = $requested;
        } elseif ($previous !== false && $previous !== '' && isset($clinicians[(string) $previous])) {
            $profesional = (string) $previous;
        } else {
            $profesional = 'norberto';
        }
    } elseif ($previous !== false && $previous !== '') {
        if ($auth['username'] !== (string) $previous) {
            json_out(403, ['error' => 'No tienes permiso para modificar esta ficha']);
        }
        $profesional = (string) $previous;
    } elseif ($auth['username'] === 'maria') {
        $profesional = 'maria';
    } else {
        $profesional = 'norberto';
    }

    // Asegurar tipos de datos estrictos en el payload
    $edadRaw = trim((string) ($data['edad'] ?? ''));
    if (!ctype_digit($edadRaw) || (int) $edadRaw < 1 || (int) $edadRaw > 120) {
        json_out(422, ['error' => 'La edad debe ser un número entero entre 1 y 120']);
    }
    $data['edad'] = (string) ((int) $edadRaw);
    $data['eva'] = max(0, min(10, (int) ($data['eva'] ?? 0)));
    $data['cdi'] = is_array($data['cdi'] ?? null) ? array_values(array_filter($data['cdi'], 'is_string')) : [];
    $data['profesional'] = $profesional;
    $data['profesionalNombre'] = $clinicians[$profesional] ?? $profesional;
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
    $stmt = $pdo->prepare('SELECT profesional FROM fichas WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $owner = $stmt->fetchColumn();
    if ($owner !== false && $auth['username'] !== 'martin' && $auth['username'] !== (string) $owner) {
        json_out(403, ['error' => 'No tienes permiso para eliminar esta ficha']);
    }
    $pdo->prepare('DELETE FROM fichas WHERE id = :id')->execute(['id' => $id]);
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
