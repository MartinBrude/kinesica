<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/fichas_ops.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
require_header();
$auth = require_auth();
$pdo = db();

if ($method === 'GET') {
    kinesica_fichas_get_all($pdo);
}

if ($method === 'POST') {
    $data = read_json();
    $uuidRe = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
    if (!is_string($data['id'] ?? null) || !preg_match($uuidRe, $data['id'])) {
        json_out(422, ['error' => 'La ficha no es válida']);
    }
    $id = $data['id'];

    if (!kinesica_fichas_check_structure($data)) {
        json_out(422, ['error' => 'La ficha contiene campos con formato o tamaño no válido']);
    }

    $textFields = ['nombre', 'dni', 'motivo', 'antecedentes', 'anotaciones', 'fotoUrl'];
    foreach ($textFields as $key) {
        if (isset($data[$key]) && !is_string($data[$key])) json_out(422, ['error' => 'El campo ' . $key . ' debe ser texto']);
        if (isset($data[$key])) $data[$key] = trim($data[$key]);
    }
    if (!empty($data['fotoUrl']) && !preg_match('#^(/admin/)?api/foto\.php\?file=[a-f0-9]{32,64}\.(jpe?g|png|webp)$#i', (string) $data['fotoUrl'])) {
        json_out(422, ['error' => 'La URL de la foto no es válida']);
    }
    if (isset($data['fotosUrls'])) {
        if (!is_array($data['fotosUrls'])) json_out(422, ['error' => 'fotosUrls debe ser un arreglo']);
        if (count($data['fotosUrls']) > 10) json_out(422, ['error' => 'No se permite subir más de 10 fotos por sesión']);
        foreach ($data['fotosUrls'] as $urlItem) {
            if (!is_string($urlItem) || !preg_match('#^(/admin/)?api/foto\.php\?file=[a-f0-9]{32,64}\.(jpe?g|png|webp)$#i', $urlItem)) {
                json_out(422, ['error' => 'Una de las URLs de las fotos no es válida']);
            }
        }
    }
    if (mb_strlen((string) ($data['nombre'] ?? '')) > 200 || mb_strlen((string) ($data['dni'] ?? '')) > 50) {
        json_out(422, ['error' => 'Nombre o DNI demasiado largo']);
    }

    $parseDate = static function ($value): ?DateTimeImmutable {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return null;
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return ($d !== false && $d->format('Y-m-d') === $value) ? $d : null;
    };
    $birth = $parseDate($data['nacimiento'] ?? null);
    $session = $parseDate($data['fechaSesion'] ?? null);
    $today = new DateTimeImmutable('today');
    if (($data['nacimiento'] ?? '') !== '' && $birth === null) json_out(422, ['error' => 'La fecha de nacimiento no es válida']);
    if (($data['fechaSesion'] ?? '') !== '' && $session === null) json_out(422, ['error' => 'La fecha de la sesión no es válida']);
    if ($birth !== null && $birth > $today) json_out(422, ['error' => 'La fecha de nacimiento no puede ser futura']);
    if ($birth !== null && $session !== null) {
        if ($birth > $session) json_out(422, ['error' => 'La fecha de nacimiento no puede ser posterior a la sesión']);
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
    $sinDocumento = filter_var($data['sinDocumento'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $data['sinDocumento'] = $sinDocumento;
    if ($sinDocumento) {
        $data['dni'] = '';
        unset($required['dni']);
    }
    $missing = [];
    foreach ($required as $key => $label) {
        $value = $data[$key] ?? '';
        if ((!is_string($value) && !is_int($value)) || trim((string) $value) === '') {
            $missing[] = $label;
        }
    }
    if ($missing) json_out(422, ['error' => 'Falta completar: ' . implode(', ', $missing) . '.']);

    $edadRaw = trim((string) $data['edad']);
    if (!ctype_digit($edadRaw) || (int) $edadRaw > 120) {
        json_out(422, ['error' => 'La edad debe ser un número entero entre 0 y 120']);
    }
    $data['edad'] = (string) ((int) $edadRaw);

    $eva = $data['eva'] ?? 0;
    if (is_string($eva) && preg_match('/^\d{1,2}$/', $eva)) $eva = (int) $eva;
    if (!is_int($eva) || $eva < 0 || $eva > 10) json_out(422, ['error' => 'La EVA debe ser un entero entre 0 y 10']);
    $data['eva'] = $eva;

    $cdiAllowed = ['I.a', 'I.b', 'II.a', 'II.b', 'II.c', 'III.a', 'III.b', 'III.c'];
    $cdi = $data['cdi'] ?? [];
    if (!is_array($cdi)) json_out(422, ['error' => 'El campo CDI no es válido']);
    foreach ($cdi as $item) {
        if (!is_string($item) || !in_array($item, $cdiAllowed, true)) {
            json_out(422, ['error' => 'El campo CDI contiene valores no válidos']);
        }
    }
    $data['cdi'] = array_values(array_unique($cdi));

    $conditionals = [
        'ruidos' => ['ruidosIzq', 'ruidosDer', 'los ruidos articulares'],
        'dolorCondilar' => ['condilarIzq', 'condilarDer', 'el dolor condilar a la palpación'],
        'desviacion' => ['desvIzq', 'desvDer', 'la desviación lateral de la trayectoria'],
        'desviacionPost' => ['desvIzqPost', 'desvDerPost', 'la desviación lateral al finalizar la sesión'],
    ];
    foreach ($conditionals as $field => [$left, $right, $label]) {
        $answer = $data[$field] ?? '';
        if (!in_array($answer, ['Sí', 'No', ''], true)) json_out(422, ['error' => 'Valor no válido en ' . $label]);
        $data[$field] = $answer;
        $data[$left] = $answer === 'Sí' && filter_var($data[$left] ?? false, FILTER_VALIDATE_BOOLEAN);
        $data[$right] = $answer === 'Sí' && filter_var($data[$right] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($answer === 'Sí' && !$data[$left] && !$data[$right]) {
            json_out(422, ['error' => 'Debe indicar el lado (izquierdo y/o derecho) en ' . $label]);
        }
    }
    if ($data['desviacionPost'] !== 'Sí') {
        $data['desvCorregidaPost'] = false;
        $data['deflexionPost'] = false;
    }

    $clinicians = ['norberto' => 'Norberto', 'maria' => 'María'];
    $docKey = static function (string $dni): string {
        $dni = trim($dni);
        if ($dni === '') return '';
        if (preg_match('/[A-Za-z]/', $dni)) return strtolower($dni);
        $digits = preg_replace('/\D/', '', $dni) ?? '';
        return strlen($digits) >= 4 ? $digits : strtolower($dni);
    };
    $nameKey = static function (string $nombre): string {
        $nombre = mb_strtolower(trim($nombre));
        $nombre = strtr($nombre, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
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
        $stmtDni = $pdo->prepare('SELECT id, payload FROM fichas WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, "$.dni")) LIKE :dniPattern');
        $stmtDni->execute(['dniPattern' => '%' . trim((string) ($data['dni'] ?? '')) . '%']);
        $candidateRows = $stmtDni->fetchAll() ?: $pdo->query('SELECT id, payload FROM fichas')->fetchAll();
        foreach ($candidateRows as $row) {
            if ((string) $row['id'] === $id) continue;
            $item = json_decode((string) $row['payload'], true);
            if (!is_array($item)) continue;
            $doc = $docKey((string) ($item['dni'] ?? ''));
            if ($ownDoc !== '' && $doc === $ownDoc) continue;
            $name = $nameKey((string) ($item['nombre'] ?? ''));
            if ($doc === $incomingDoc && $name !== '' && $name !== $incomingName) {
                json_out(422, ['error' => 'El documento ya corresponde a ' . $item['nombre'] . '. No se puede guardar con otro nombre.']);
            }
        }
    }

    $inherited = kinesica_fichas_find_inherited_owner($pdo, $id, $data, $incomingDoc, $incomingName, $clinicians, $docKey, $nameKey);

    $pdo->beginTransaction();
    $existing = $pdo->prepare('SELECT profesional FROM fichas WHERE id = :id FOR UPDATE');
    $existing->execute(['id' => $id]);
    $previous = $existing->fetchColumn();
    if (is_admin($auth)) {
        $requested = (string) ($data['profesional'] ?? '');
        if (isset($clinicians[$requested])) $profesional = $requested;
        elseif ($previous !== false && $previous !== '' && isset($clinicians[(string) $previous])) $profesional = (string) $previous;
        elseif ($inherited !== '') $profesional = $inherited;
        elseif ($auth['username'] === 'maria') $profesional = 'maria';
        else $profesional = 'norberto';
    } elseif ($previous !== false && $previous !== '') {
        if ($auth['username'] !== (string) $previous) {
            $pdo->rollBack();
            json_out(403, ['error' => 'No tienes permiso para modificar esta ficha']);
        }
        $profesional = (string) $previous;
    } elseif ($inherited !== '') {
        $profesional = $inherited;
    } elseif ($auth['username'] === 'maria') {
        $profesional = 'maria';
    } else {
        $profesional = 'norberto';
    }

    $data['profesional'] = $profesional;
    $data['profesionalNombre'] = $clinicians[$profesional] ?? $profesional;
    $data['savedAt'] = gmdate('c');

    kinesica_fichas_save_record($pdo, $auth, $id, $data, $profesional);

    if (is_array($prevItem)) {
        $prevFiles = kinesica_extract_ficha_photos($prevItem);
        $currentFiles = kinesica_extract_ficha_photos($data);
        foreach (array_diff($prevFiles, $currentFiles) as $fName) {
            $oldFile = __DIR__ . '/../uploads/' . $fName;
            if (is_file($oldFile)) @unlink($oldFile);
        }
    }

    json_out(200, $data);
}

if ($method === 'DELETE') {
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
