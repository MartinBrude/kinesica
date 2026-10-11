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
    $uuidRe = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
    if (!is_string($data['id'] ?? null) || !preg_match($uuidRe, $data['id'])) {
        json_out(422, ['error' => 'La ficha no es válida']);
    }
    $id = $data['id'];

    // Límites generales: tamaño total, claves y longitud de cadenas
    $checkValue = static function ($value, int $depth = 0) use (&$checkValue): bool {
        if ($depth > 4) {
            return false;
        }
        if (is_string($value)) {
            return mb_strlen($value) <= 5000;
        }
        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) {
            return true;
        }
        if (is_array($value)) {
            if (count($value) > 200) {
                return false;
            }
            foreach ($value as $k => $v) {
                if (is_string($k) && !preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $k)) {
                    return false;
                }
                if (!$checkValue($v, $depth + 1)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };
    if (!$checkValue($data)) {
        json_out(422, ['error' => 'La ficha contiene campos con formato o tamaño no válido']);
    }

    // Campos de texto obligatorios: deben ser cadenas
    $textFields = ['nombre', 'dni', 'motivo', 'antecedentes'];
    foreach ($textFields as $key) {
        if (isset($data[$key]) && !is_string($data[$key])) {
            json_out(422, ['error' => 'El campo ' . $key . ' debe ser texto']);
        }
        if (isset($data[$key])) {
            $data[$key] = trim($data[$key]);
        }
    }
    if (mb_strlen((string) ($data['nombre'] ?? '')) > 200 || mb_strlen((string) ($data['dni'] ?? '')) > 50) {
        json_out(422, ['error' => 'Nombre o DNI demasiado largo']);
    }

    // Fechas estrictas (Y-m-d)
    $parseDate = static function ($value): ?DateTimeImmutable {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return ($d !== false && $d->format('Y-m-d') === $value) ? $d : null;
    };
    $birth = $parseDate($data['nacimiento'] ?? null);
    $session = $parseDate($data['fechaSesion'] ?? null);
    $today = new DateTimeImmutable('today');
    if (($data['nacimiento'] ?? '') !== '' && $birth === null) {
        json_out(422, ['error' => 'La fecha de nacimiento no es válida']);
    }
    if (($data['fechaSesion'] ?? '') !== '' && $session === null) {
        json_out(422, ['error' => 'La fecha de la sesión no es válida']);
    }
    if ($birth !== null && $birth > $today) {
        json_out(422, ['error' => 'La fecha de nacimiento no puede ser futura']);
    }
    if ($birth !== null && $session !== null) {
        if ($birth > $session) {
            json_out(422, ['error' => 'La fecha de nacimiento no puede ser posterior a la sesión']);
        }
        // La edad se calcula siempre en servidor; no se confía en el cliente
        $data['edad'] = (string) $birth->diff($session)->y;
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
        $value = $data[$key] ?? '';
        if (!is_string($value) && !is_int($value)) {
            $missing[] = $label;
        } elseif (trim((string) $value) === '') {
            $missing[] = $label;
        }
    }
    if ($missing) {
        json_out(422, ['error' => 'Falta completar: ' . implode(', ', $missing) . '.']);
    }

    $edadRaw = trim((string) $data['edad']);
    if (!ctype_digit($edadRaw) || (int) $edadRaw > 120) {
        json_out(422, ['error' => 'La edad debe ser un número entero entre 0 y 120']);
    }
    $data['edad'] = (string) ((int) $edadRaw);

    // EVA: entero 0-10 estricto
    $eva = $data['eva'] ?? 0;
    if (is_string($eva) && preg_match('/^\d{1,2}$/', $eva)) {
        $eva = (int) $eva;
    }
    if (!is_int($eva) || $eva < 0 || $eva > 10) {
        json_out(422, ['error' => 'La EVA debe ser un entero entre 0 y 10']);
    }
    $data['eva'] = $eva;

    // CDI: solo valores permitidos
    $cdiAllowed = ['I.a', 'I.b', 'II.a', 'II.b', 'II.c', 'III.a', 'III.b', 'III.c'];
    $cdi = $data['cdi'] ?? [];
    if (!is_array($cdi)) {
        json_out(422, ['error' => 'El campo CDI no es válido']);
    }
    foreach ($cdi as $item) {
        if (!is_string($item) || !in_array($item, $cdiAllowed, true)) {
            json_out(422, ['error' => 'El campo CDI contiene valores no válidos']);
        }
    }
    $data['cdi'] = array_values(array_unique($cdi));

    // Opciones Sí/No con lado condicional; se limpian los lados obsoletos
    $conditionals = [
        'ruidos' => ['ruidosIzq', 'ruidosDer', 'los ruidos articulares'],
        'dolorCondilar' => ['condilarIzq', 'condilarDer', 'el dolor condilar a la palpación'],
        'desviacion' => ['desvIzq', 'desvDer', 'la desviación lateral de la trayectoria'],
    ];
    foreach ($conditionals as $field => [$left, $right, $label]) {
        $answer = $data[$field] ?? '';
        if (!in_array($answer, ['Sí', 'No', ''], true)) {
            json_out(422, ['error' => 'Valor no válido en ' . $label]);
        }
        $data[$field] = $answer;
        $data[$left] = $answer === 'Sí' && filter_var($data[$left] ?? false, FILTER_VALIDATE_BOOLEAN);
        $data[$right] = $answer === 'Sí' && filter_var($data[$right] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($answer === 'Sí' && !$data[$left] && !$data[$right]) {
            json_out(422, ['error' => 'Debe indicar el lado (izquierdo y/o derecho) en ' . $label]);
        }
    }

    $clinicians = ['norberto' => 'Norberto', 'maria' => 'María'];
    $docKey = static function (string $dni): string {
        $dni = trim($dni);
        if ($dni === '') {
            return '';
        }
        if (preg_match('/[A-Za-z]/', $dni)) {
            return strtolower($dni);
        }
        $digits = preg_replace('/\D/', '', $dni) ?? '';
        return strlen($digits) >= 4 ? $digits : strtolower($dni);
    };
    $nameKey = static function (string $nombre): string {
        $nombre = mb_strtolower(trim($nombre));
        $nombre = strtr($nombre, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        ]);
        return preg_replace('/\s+/', ' ', $nombre) ?? '';
    };
    $prevPayload = $pdo->prepare('SELECT payload FROM fichas WHERE id = :id');
    $prevPayload->execute(['id' => $id]);
    $prevRaw = $prevPayload->fetchColumn();
    $prevItem = is_string($prevRaw) ? json_decode($prevRaw, true) : null;
    $ownDoc = is_array($prevItem) ? $docKey((string) ($prevItem['dni'] ?? '')) : '';
    $incomingDoc = $docKey((string) ($data['dni'] ?? ''));
    $incomingName = $nameKey((string) ($data['nombre'] ?? ''));
    if ($incomingDoc !== '' && $incomingName !== '') {
        $others = $pdo->query('SELECT id, payload FROM fichas')->fetchAll();
        foreach ($others as $row) {
            if ((string) $row['id'] === $id) {
                continue;
            }
            $item = json_decode((string) $row['payload'], true);
            if (!is_array($item)) {
                continue;
            }
            $doc = $docKey((string) ($item['dni'] ?? ''));
            if ($ownDoc !== '' && $doc === $ownDoc) {
                continue;
            }
            $name = $nameKey((string) ($item['nombre'] ?? ''));
            if ($doc === $incomingDoc && $name !== '' && $name !== $incomingName) {
                json_out(422, ['error' => 'El documento ya corresponde a ' . $item['nombre'] . '. No se puede guardar con otro nombre.']);
            }
        }
    }

    $pdo->beginTransaction();
    $existing = $pdo->prepare('SELECT profesional FROM fichas WHERE id = :id FOR UPDATE');
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
            $pdo->rollBack();
            json_out(403, ['error' => 'No tienes permiso para modificar esta ficha']);
        }
        $profesional = (string) $previous;
    } elseif ($auth['username'] === 'maria') {
        $profesional = 'maria';
    } else {
        $profesional = 'norberto';
    }

    $data['profesional'] = $profesional;
    $data['profesionalNombre'] = $clinicians[$profesional] ?? $profesional;
    $data['savedAt'] = gmdate('c');
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($payload === false) {
        $pdo->rollBack();
        json_out(422, ['error' => 'La ficha contiene datos no válidos']);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO fichas (id, payload, profesional, updated_at, updated_by)
         VALUES (:id, :payload, :profesional, UTC_TIMESTAMP(), :user)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)'
    );
    $stmt->execute([
        'id' => $id,
        'payload' => $payload,
        'profesional' => $profesional,
        'user' => $auth['username'],
    ]);
    $pdo->commit();
    json_out(200, $data);
}

if ($method === 'DELETE') {
    $id = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
        json_out(422, ['error' => 'Ficha inválida']);
    }
    $stmt = $pdo->prepare('SELECT profesional FROM fichas WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $owner = $stmt->fetchColumn();
    if ($owner !== false && $owner !== '' && $auth['username'] !== 'martin' && $auth['username'] !== (string) $owner) {
        json_out(403, ['error' => 'No tienes permiso para eliminar esta ficha']);
    }
    $pdo->prepare('DELETE FROM fichas WHERE id = :id')->execute(['id' => $id]);
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
