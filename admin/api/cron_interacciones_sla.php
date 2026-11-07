<?php
declare(strict_types=1);

/**
 * Kinésica — Cron: SLA de interacciones sin respuesta (> 3 h → alerta a Norberto).
 * Las alertas solo se despachan entre las 10:00 y las 20:00 (hora Argentina);
 * fuera de esa ventana el cron puede correr pero no envía WhatsApp.
 *
 * Formas de ejecución:
 * 1. CLI (Hostinger Cron cada 15 min):
 *    /usr/bin/php /home/u.../public_html/admin/api/cron_interacciones_sla.php
 * 2. HTTP con token secreto:
 *    GET https://www.kinesica.com.ar/admin/api/cron_interacciones_sla.php?token=...
 * 3. HTTP con sesión admin:
 *    GET https://www.kinesica.com.ar/admin/api/cron_interacciones_sla.php
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_sla.php';

if (PHP_SAPI !== 'cli') {
    $config = cfg();
    $expectedSecret = (string) ($config['webhook_secret'] ?? $config['install_token'] ?? '');

    $providedToken = (string) ($_GET['token'] ?? $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '');
    $authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (str_starts_with($authHeader, 'Bearer ')) {
        $providedToken = $providedToken !== '' ? $providedToken : trim(substr($authHeader, 7));
    }

    $isTokenAuth = ($expectedSecret !== '' && $providedToken !== '' && hash_equals($expectedSecret, $providedToken));

    if (!$isTokenAuth) {
        require_header();
        $auth = require_auth();
        if (!is_admin($auth)) {
            json_out(403, ['error' => 'Acceso denegado. Se requiere token o permisos de administrador.']);
        }
    }
}

$force = PHP_SAPI === 'cli' || !empty($_GET['force']);

try {
    $result = interacciones_sla_check(null, $force);
    $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    $nowIso = (new DateTimeImmutable('now', $tz))->format(DateTimeInterface::ATOM);

    $report = [
        'status' => !empty($result['ok']) ? 'success' : 'partial',
        'timestamp' => $nowIso,
        'checked' => $result['checked'] ?? 0,
        'due' => $result['due'] ?? 0,
        'notified' => $result['notified'] ?? 0,
        'skipped' => $result['skipped'] ?? 0,
        'throttled' => !empty($result['throttled']),
        'outside_hours' => !empty($result['outside_hours']),
        'errors' => $result['errors'] ?? [],
        'message' => 'Chequeo SLA de interacciones (>3 h sin respuesta) completado.',
    ];

    if (PHP_SAPI === 'cli') {
        echo "=== Kinésica: Cron SLA Interacciones ===\n";
        echo "Fecha/Hora: {$nowIso}\n";
        echo "Revisadas: {$report['checked']}\n";
        echo "Vencidas (>3h): {$report['due']}\n";
        echo "Notificadas: {$report['notified']}\n";
        echo "Omitidas (ya avisadas): {$report['skipped']}\n";
        if ($report['outside_hours']) {
            echo "Fuera de ventana 10–20 AR: no se envían alertas\n";
        }
        if ($report['throttled']) {
            echo "Throttled: sí (usá force en HTTP o esperá el intervalo)\n";
        }
        if ($report['errors'] !== []) {
            echo "Errores:\n";
            foreach ($report['errors'] as $err) {
                echo "  - {$err}\n";
            }
        }
        echo "Resultado: " . ($report['status'] === 'success' ? 'OK' : 'PARTIAL') . "\n";
        exit($report['status'] === 'success' ? 0 : 1);
    }

    json_out(200, $report);
} catch (Throwable $e) {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Error en cron_interacciones_sla: " . $e->getMessage() . "\n");
        exit(1);
    }
    json_out(500, [
        'status' => 'error',
        'error' => $e->getMessage(),
    ]);
}
