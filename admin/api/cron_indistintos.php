<?php
declare(strict_types=1);

/**
 * Kinésica - Cron Job Diario de Madrugada: Resolución de Pacientes Indistintos
 * 
 * Verifica y resuelve automáticamente aquellos pacientes del directorio que
 * se encuentren configurados con profesional 'indistinto', cruzando los turnos
 * de Google Calendar y horarios de atención (1 sola camilla física).
 * 
 * Formas de ejecución:
 * 1. CLI (Hostinger Cron del servidor a las 03:00 / 04:00 AM):
 *    /usr/bin/php /home/u.../public_html/admin/api/cron_indistintos.php
 * 2. HTTP (Trigger web o n8n con token secreto):
 *    GET https://www.kinesica.com.ar/admin/api/cron_indistintos.php?token=...
 * 3. HTTP (Admin autenticado en sesión):
 *    GET https://www.kinesica.com.ar/admin/api/cron_indistintos.php
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

// Control de acceso si se invoca vía Web/HTTP
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

try {
    $pdo = db();
    ensure_pacientes_tables($pdo, true);

    // 1. Primero verificar si existen pacientes con profesional indistinto
    $stmtBefore = $pdo->query("SELECT COUNT(*) FROM pacientes WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''");
    $indistintosBefore = $stmtBefore ? (int) $stmtBefore->fetchColumn() : 0;

    $resolvedCount = 0;
    // 2. Solo si hay indistintos, verificar si están agendados y asignarles profesional
    // Si no tienen turnos agendados con un profesional específico, 'indistinto' es un valor válido y se conserva.
    if ($indistintosBefore > 0) {
        $resolvedCount = resolve_indistinto_pacientes_from_calendar($pdo);
    }

    $stmtAfter = $pdo->query("SELECT COUNT(*) FROM pacientes WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''");
    $indistintosAfter = $stmtAfter ? (int) $stmtAfter->fetchColumn() : 0;

    $stmtTotal = $pdo->query("SELECT COUNT(*) FROM pacientes");
    $totalPacientes = $stmtTotal ? (int) $stmtTotal->fetchColumn() : 0;

    $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    $nowIso = (new DateTimeImmutable('now', $tz))->format(DateTimeInterface::ATOM);

    // Registrar marca temporal de última ejecución diaria
    try {
        kinesica_update_settings(function (array $current) use ($nowIso, $resolvedCount, $indistintosAfter): array {
            $current['last_cron_indistintos_at'] = $nowIso;
            $current['last_cron_indistintos_resolved'] = $resolvedCount;
            $current['last_cron_indistintos_remaining'] = $indistintosAfter;
            return $current;
        });
    } catch (Throwable) {}

    $report = [
        'status' => 'success',
        'timestamp' => $nowIso,
        'indistintos_antes' => $indistintosBefore,
        'pacientes_resueltos' => $resolvedCount,
        'indistintos_restantes' => $indistintosAfter,
        'total_pacientes' => $totalPacientes,
        'message' => 'Verificación diaria de pacientes indistintos completada exitosamente.',
    ];

    if (PHP_SAPI === 'cli') {
        echo "=== Kinésica: Cron Diario de Pacientes Indistintos ===\n";
        echo "Fecha/Hora: {$nowIso}\n";
        echo "Indistintos previos: {$indistintosBefore}\n";
        echo "Pacientes resueltos: {$resolvedCount}\n";
        echo "Indistintos restantes: {$indistintosAfter}\n";
        echo "Total pacientes en directorio: {$totalPacientes}\n";
        echo "Resultado: OK\n";
        exit(0);
    }

    json_out(200, $report);
} catch (Throwable $e) {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Error en cron_indistintos: " . $e->getMessage() . "\n");
        exit(1);
    }
    json_out(500, [
        'status' => 'error',
        'error' => $e->getMessage(),
    ]);
}
