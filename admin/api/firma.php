<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    json_out(405, ['error' => 'Método no permitido']);
}

// Exigir sesión autenticada activa en /admin/ para visualizar firmas digitales
require_auth();

$filename = basename((string) ($_GET['file'] ?? ''));
if (!preg_match('/^(norberto|maria)\.png$/i', $filename)) {
    json_out(404, ['error' => 'Firma no encontrada']);
}

$sigDir = realpath(__DIR__ . '/../signatures');
if ($sigDir === false) {
    json_out(404, ['error' => 'Directorio de firmas no encontrado']);
}

$target = $sigDir . '/' . strtolower($filename);
if (!is_file($target)) {
    json_out(404, ['error' => 'Archivo de firma no disponible']);
}

header('Content-Type: image/png');
header('Content-Length: ' . (string) filesize($target));
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
readfile($target);
exit;
