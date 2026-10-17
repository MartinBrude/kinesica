<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // La imagen es accesible exclusivamente para usuarios autenticados
    $auth = require_auth();

    $file = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{32,64}\.(jpe?g|png|webp)$/i', $file)) {
        json_out(400, ['error' => 'Nombre de archivo no válido']);
    }

    $uploadsDir = realpath(__DIR__ . '/../uploads');
    $filePath = __DIR__ . '/../uploads/' . $file;
    $realFilePath = realpath($filePath);

    if (
        $uploadsDir === false ||
        $realFilePath === false ||
        !str_starts_with($realFilePath, $uploadsDir . DIRECTORY_SEPARATOR) ||
        !is_file($realFilePath)
    ) {
        json_out(404, ['error' => 'Foto no encontrada']);
    }

    $ext = strtolower(pathinfo($realFilePath, PATHINFO_EXTENSION));
    $mimes = [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
    ];
    $contentType = $mimes[$ext] ?? 'image/jpeg';

    if (!headers_sent()) {
        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . (string) filesize($realFilePath));
        header('Cache-Control: private, max-age=86400');
        header('X-Content-Type-Options: nosniff');
    }
    readfile($realFilePath);
    exit;
}

if ($method === 'POST') {
    require_header();
    $auth = require_auth();

    if (empty($_FILES['foto']) || !is_uploaded_file($_FILES['foto']['tmp_name'])) {
        json_out(400, ['error' => 'No se recibió ningún archivo de imagen']);
    }

    $uploaded = $_FILES['foto'];
    if ($uploaded['error'] !== UPLOAD_ERR_OK) {
        json_out(400, ['error' => 'Error al subir la imagen (código: ' . (int) $uploaded['error'] . ')']);
    }

    // Límite de tamaño: 5 MB
    $maxBytes = 5 * 1024 * 1024;
    $actualSize = (int) ($uploaded['size'] ?? 0);
    $realSize = filesize($uploaded['tmp_name']);
    if ($actualSize > $maxBytes || $realSize > $maxBytes) {
        json_out(413, ['error' => 'La imagen no debe superar los 5 MB']);
    }

    $info = @getimagesize($uploaded['tmp_name']);
    if ($info === false) {
        json_out(422, ['error' => 'El archivo no es una imagen válida']);
    }

    $allowedTypes = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];
    $ext = $allowedTypes[$info[2]] ?? null;
    if ($ext === null) {
        json_out(422, ['error' => 'Formato no admitido. Se admiten solo archivos JPG, PNG o WebP.']);
    }

    $targetDir = __DIR__ . '/../uploads';
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
        file_put_contents($targetDir . '/.htaccess', "Require all denied\n");
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $destination = $targetDir . '/' . $filename;

    if (!move_uploaded_file($uploaded['tmp_name'], $destination)) {
        json_out(500, ['error' => 'No se pudo guardar la imagen en el servidor']);
    }

    $url = '/admin/api/foto.php?file=' . $filename;
    json_out(200, [
        'ok' => true,
        'url' => $url,
        'file' => $filename,
    ]);
}

if ($method === 'DELETE') {
    require_header();
    $auth = require_auth();

    $file = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{32,64}\.(jpe?g|png|webp)$/i', $file)) {
        json_out(400, ['error' => 'Nombre de archivo no válido']);
    }

    $target = __DIR__ . '/../uploads/' . $file;
    if (is_file($target)) {
        @unlink($target);
    }
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
