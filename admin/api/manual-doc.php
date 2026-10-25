<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

/**
 * Endpoint protegido exclusivamente para administradores (role === 'admin').
 * Sirve:
 * 1. La página HTML del manual (?view=page) cuando se accede a /admin/manual.html
 * 2. Los documentos Markdown (?doc=clara|cuentas|pruebas|whatsapp)
 * 3. Los recursos gráficos y plantillas de /docs/ (?asset=...)
 */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    json_out(405, ['error' => 'Método no permitido']);
}

$view = (string) ($_GET['view'] ?? '');
$docKey = (string) ($_GET['doc'] ?? '');
$assetName = (string) ($_GET['asset'] ?? '');

/**
 * Verifica sesión activa y rol de administrador.
 * Devuelve el array de usuario autenticado si es admin, o maneja la respuesta de rechazo.
 */
function verify_admin_manual_access(bool $isHtmlNavigation): array
{
    start_session();
    if (empty($_SESSION['user']) || empty($_SESSION['full'])) {
        if ($isHtmlNavigation) {
            header('Cache-Control: private, no-store, no-cache, must-revalidate');
            header('Pragma: no-cache');
            header('Location: /admin/', true, 302);
            exit;
        }
        json_out(401, ['login' => true, 'error' => 'Sesión no iniciada']);
    }

    $auth = require_auth();
    if (!is_admin($auth)) {
        if ($isHtmlNavigation) {
            http_response_code(403);
            header('Content-Type: text/html; charset=utf-8');
            header('Cache-Control: private, no-store, no-cache, must-revalidate');
            header('X-Robots-Tag: noindex, nofollow');
            echo <<<'HTML'
<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Acceso restringido — Kinésica Admin</title>
  <link rel="stylesheet" href="/admin/styles.css?v=117">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <div class="hero-card" style="max-width:460px;text-align:center;padding:32px 28px;flex-direction:column;gap:14px;">
    <h1 style="font-size:20px;margin:0;color:var(--navy);">Acceso exclusivo para administradores</h1>
    <p style="margin:0;color:var(--muted);font-size:14px;line-height:1.5;">
      El Manual de Usuario y Operaciones solo está disponible para cuentas con permisos de administrador.
    </p>
    <div style="margin-top:8px;">
      <a href="/admin/" class="btn green" style="text-decoration:none;display:inline-flex;">← Volver al Panel</a>
    </div>
  </div>
</body>
</html>
HTML;
            exit;
        }
        json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    }

    return $auth;
}

$docsDir = realpath(__DIR__ . '/../../docs');
if ($docsDir === false || !is_dir($docsDir)) {
    if ($view === 'page') {
        http_response_code(500);
        exit('Directorio de documentación no disponible.');
    }
    json_out(500, ['error' => 'Directorio de documentación no encontrado.']);
}

// 1. Servir documentos Markdown (?doc=...)
if ($docKey !== '') {
    require_header();
    verify_admin_manual_access(false);

    $allowedDocs = [
        'clara' => 'manual-clara.md',
        'cuentas' => 'configuracion-cuentas-profesionales.md',
        'pruebas' => 'guia-pruebas.md',
        'whatsapp' => 'cuenta-whatsapp-clara.md',
    ];

    if (!isset($allowedDocs[$docKey])) {
        json_out(404, ['error' => 'Documento no encontrado.']);
    }

    $filePath = $docsDir . '/' . $allowedDocs[$docKey];
    if (!is_file($filePath)) {
        json_out(404, ['error' => 'Archivo de documentación no disponible.']);
    }

    header('Content-Type: text/markdown; charset=utf-8');
    header('Cache-Control: private, no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    readfile($filePath);
    exit;
}

// 2. Servir imágenes y recursos adjuntos del manual (?asset=...)
if ($assetName !== '') {
    verify_admin_manual_access(false);

    $allowedAssets = [
        'diagrama_flujo_calendar_bot.png' => ['path' => 'assets/diagrama_flujo_calendar_bot.png', 'mime' => 'image/png'],
        'diagrama_flujo_calendar_bot.svg' => ['path' => 'assets/diagrama_flujo_calendar_bot.svg', 'mime' => 'image/svg+xml'],
        'mockup_whatsapp_recordatorio_24h.jpg' => ['path' => 'assets/mockup_whatsapp_recordatorio_24h.jpg', 'mime' => 'image/jpeg'],
        'mockup_evento_anotado.png' => ['path' => 'assets/mockup_evento_anotado.png', 'mime' => 'image/png'],
        'tabla_visual_dos_donts.png' => ['path' => 'assets/tabla_visual_dos_donts.png', 'mime' => 'image/png'],
        'pacientes_primera_sesion.xlsx' => [
            'path' => 'pacientes_primera_sesion.xlsx',
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'download' => 'pacientes_primera_sesion.xlsx',
        ],
    ];

    $cleanAsset = basename($assetName);
    if (!isset($allowedAssets[$cleanAsset])) {
        json_out(404, ['error' => 'Recurso no encontrado.']);
    }

    $assetMeta = $allowedAssets[$cleanAsset];
    $assetPath = $docsDir . '/' . $assetMeta['path'];
    if (!is_file($assetPath)) {
        json_out(404, ['error' => 'Archivo no encontrado.']);
    }

    header('Content-Type: ' . $assetMeta['mime']);
    header('Content-Length: ' . (string) filesize($assetPath));
    header('Cache-Control: private, no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    if (!empty($assetMeta['download'])) {
        header('Content-Disposition: attachment; filename="' . $assetMeta['download'] . '"');
    }
    readfile($assetPath);
    exit;
}

// 3. Servir la interfaz HTML del manual (?view=page o acceso directo)
verify_admin_manual_access(true);

$manualHtmlPath = __DIR__ . '/../manual.html';
if (!is_file($manualHtmlPath)) {
    http_response_code(404);
    exit('Manual no encontrado.');
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
readfile($manualHtmlPath);
exit;
