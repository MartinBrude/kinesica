<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // El video es accesible exclusivamente para usuarios autenticados
    $auth = require_auth();

    $file = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{32,64}\.(mp4|webm|mov|m4v)$/i', $file)) {
        json_out(400, ['error' => 'Nombre de archivo no válido']);
    }

    $realFilePath = kinesica_find_upload_file($file);
    if ($realFilePath === null) {
        json_out(404, ['error' => 'Video no encontrado']);
    }

    $ext = strtolower(pathinfo($realFilePath, PATHINFO_EXTENSION));
    $mimes = [
        'mp4'  => 'video/mp4',
        'webm' => 'video/webm',
        'mov'  => 'video/quicktime',
        'm4v'  => 'video/x-m4v',
    ];
    $contentType = $mimes[$ext] ?? 'video/mp4';

    if (!headers_sent()) {
        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . (string) filesize($realFilePath));
        header('Cache-Control: private, max-age=86400');
        header('X-Content-Type-Options: nosniff');
        header('Accept-Ranges: bytes');
    }
    readfile($realFilePath);
    exit;
}

if ($method === 'POST') {
    require_header();
    $auth = require_auth();

    if (empty($_FILES['video']) || !is_uploaded_file($_FILES['video']['tmp_name'])) {
        json_out(400, ['error' => 'No se recibió ningún archivo de video']);
    }

    $uploaded = $_FILES['video'];
    if ($uploaded['error'] !== UPLOAD_ERR_OK) {
        json_out(400, ['error' => 'Error al subir el video (código: ' . (int) $uploaded['error'] . ')']);
    }

    // Límite de tamaño: 25 MB
    $maxBytes = 25 * 1024 * 1024;
    $actualSize = (int) ($uploaded['size'] ?? 0);
    $realSize = filesize($uploaded['tmp_name']);
    if ($actualSize > $maxBytes || $realSize > $maxBytes) {
        json_out(413, ['error' => 'El video no debe superar los 25 MB']);
    }

    $originalName = (string) ($uploaded['name'] ?? '');
    $clientExt = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExts = ['mp4', 'webm', 'mov', 'm4v'];
    if (!in_array($clientExt, $allowedExts, true)) {
        json_out(422, ['error' => 'Formato no admitido. Se admiten solo archivos MP4, WebM, MOV o M4V.']);
    }
    $ext = $clientExt;

    // Validación de MIME mediante finfo si está disponible
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = (string) finfo_file($finfo, $uploaded['tmp_name']);
            finfo_close($finfo);
            $validMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'application/octet-stream'];
            if (!in_array($mime, $validMimes, true) && !str_starts_with($mime, 'video/')) {
                json_out(422, ['error' => 'El archivo subido no contiene un formato de video válido.']);
            }
        }
    }

    $targetDir = kinesica_uploads_dir();
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $destination = $targetDir . '/' . $filename;

    if (!move_uploaded_file($uploaded['tmp_name'], $destination)) {
        json_out(500, ['error' => 'No se pudo guardar el video en el servidor']);
    }

    $url = '/admin/api/video.php?file=' . $filename;
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
    if (!preg_match('/^[a-f0-9]{32,64}\.(mp4|webm|mov|m4v)$/i', $file)) {
        json_out(400, ['error' => 'Nombre de archivo no válido']);
    }

    kinesica_delete_upload_file($file);
    json_out(200, ['ok' => true]);
}

json_out(405, ['error' => 'Método no permitido']);
