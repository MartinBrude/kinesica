<?php
declare(strict_types=1);

/**
 * Kinésica Admin - API de Métricas de Servicios, Cuotas y Consumo
 * Endpoint protegido para administradores. Supervisa volumen de WhatsApp, IA, Emails y Base de Datos.
 */

require __DIR__ . '/lib.php';

if (PHP_SAPI !== 'cli') {
    require_header();
    $auth = require_auth();
    if (!is_admin($auth)) {
        json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    }
}

$tz = new DateTimeZone('America/Argentina/Buenos_Aires');
$now = new DateTimeImmutable('now', $tz);
$startOfMonth = (new DateTimeImmutable('first day of this month 00:00:00', $tz))->format('Y-m-d H:i:s');
$startOfToday = (new DateTimeImmutable('today 00:00:00', $tz))->format('Y-m-d H:i:s');

$c = cfg();

$resendKey = (string) (getenv('RESEND_API_KEY') ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $c['resend_api_key'] ?? ''));
$waToken = (string) (getenv('WHATSAPP_TOKEN') ?: ($_SERVER['WHATSAPP_TOKEN'] ?? $_ENV['WHATSAPP_TOKEN'] ?? $c['whatsapp_token'] ?? ''));

$whatsapp = [
    'configured' => $waToken !== '',
    'phone_number_id' => (string) ($c['whatsapp_phone_number_id'] ?? '1340013275870491'),
    'free_conversations_limit' => 1000,
    'month_active_conversations' => 0,
    'month_inbound_messages' => 0,
    'month_outbound_messages' => 0,
    'month_utility_templates_sent' => 0,
    'month_utility_templates_failed' => 0,
];

$gemini = [
    'daily_free_limit' => 1500,
    'today_requests' => 0,
    'month_requests' => 0,
];

$resend = [
    'configured' => $resendKey !== '',
    'daily_free_limit' => 100,
    'month_free_limit' => 3000,
    'today_sent' => 0,
    'month_sent' => 0,
];

$database = [
    'connected' => false,
    'size_mb' => 0.0,
    'tables' => [],
];

try {
    $pdo = db();
    $database['connected'] = true;

    // Tamaño total de la base de datos
    $dbName = (string) ($c['db']['name'] ?? 'u696348908_atm');
    $sizeStmt = $pdo->prepare('SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS mb FROM information_schema.tables WHERE table_schema = :db');
    $sizeStmt->execute(['db' => $dbName]);
    $database['size_mb'] = (float) ($sizeStmt->fetchColumn() ?: 0.0);

    // Conteo por tablas principales
    $tablesToCheck = ['fichas', 'pacientes', 'lista_espera', 'interaccion_eventos', 'recordatorio_eventos', 'users', 'login_codes'];
    foreach ($tablesToCheck as $tbl) {
        try {
            $cnt = (int) $pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
            $database['tables'][$tbl] = $cnt;
        } catch (Throwable $_) {
            $database['tables'][$tbl] = 0;
        }
    }

    // Métricas WhatsApp e IA desde interaccion_eventos
    try {
        $stmtWA = $pdo->prepare(
            'SELECT 
                COUNT(DISTINCT wa_id) AS active_convs,
                SUM(CASE WHEN direction = "inbound" THEN 1 ELSE 0 END) AS in_cnt,
                SUM(CASE WHEN direction = "outbound" THEN 1 ELSE 0 END) AS out_cnt
             FROM interaccion_eventos 
             WHERE ts_utc >= :since'
        );
        $stmtWA->execute(['since' => $startOfMonth]);
        $rowWA = $stmtWA->fetch(PDO::FETCH_ASSOC);
        if ($rowWA) {
            $whatsapp['month_active_conversations'] = (int) ($rowWA['active_convs'] ?? 0);
            $whatsapp['month_inbound_messages'] = (int) ($rowWA['in_cnt'] ?? 0);
            $whatsapp['month_outbound_messages'] = (int) ($rowWA['out_cnt'] ?? 0);
            $gemini['month_requests'] = (int) ($rowWA['out_cnt'] ?? 0);
        }

        // Consultas IA hoy
        $stmtGemToday = $pdo->prepare('SELECT COUNT(*) FROM interaccion_eventos WHERE direction = "outbound" AND ts_utc >= :today');
        $stmtGemToday->execute(['today' => $startOfToday]);
        $gemini['today_requests'] = (int) $stmtGemToday->fetchColumn();
    } catch (Throwable $_) {}

    // Métricas Plantillas Utility desde recordatorio_eventos
    try {
        $stmtRec = $pdo->prepare(
            'SELECT 
                SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) AS sent_cnt,
                SUM(CASE WHEN status IN ("failed", "skipped") THEN 1 ELSE 0 END) AS other_cnt
             FROM recordatorio_eventos 
             WHERE run_at >= :since'
        );
        $stmtRec->execute(['since' => $startOfMonth]);
        $rowRec = $stmtRec->fetch(PDO::FETCH_ASSOC);
        if ($rowRec) {
            $whatsapp['month_utility_templates_sent'] = (int) ($rowRec['sent_cnt'] ?? 0);
            $whatsapp['month_utility_templates_failed'] = (int) ($rowRec['other_cnt'] ?? 0);
        }
    } catch (Throwable $_) {}

    // Métricas Email (login_codes)
    try {
        $stmtMailM = $pdo->prepare('SELECT COUNT(*) FROM login_codes WHERE created_at >= :since');
        $stmtMailM->execute(['since' => $startOfMonth]);
        $resend['month_sent'] = (int) $stmtMailM->fetchColumn();

        $stmtMailD = $pdo->prepare('SELECT COUNT(*) FROM login_codes WHERE created_at >= :today');
        $stmtMailD->execute(['today' => $startOfToday]);
        $resend['today_sent'] = (int) $stmtMailD->fetchColumn();
    } catch (Throwable $_) {}

} catch (Throwable $e) {
    $database['connected'] = false;
    $database['error'] = $e->getMessage();
}

// Almacenamiento uploads
$uploadsDir = __DIR__ . '/uploads';
$uploadsCount = 0;
$uploadsBytes = 0;
if (is_dir($uploadsDir)) {
    $files = scandir($uploadsDir) ?: [];
    foreach ($files as $f) {
        if ($f !== '.' && $f !== '..' && !str_starts_with($f, '.')) {
            $path = $uploadsDir . '/' . $f;
            if (is_file($path)) {
                $uploadsCount++;
                $uploadsBytes += (int) filesize($path);
            }
        }
    }
}
$storage = [
    'uploads_count' => $uploadsCount,
    'uploads_size_mb' => round($uploadsBytes / (1024 * 1024), 2),
];

$googleCloud = [
    'places_api' => 'Places API (New) & Maps JS',
    'sync_frequency' => '1 consulta diaria en GitHub Actions (~30/mes)',
    'free_credit' => 'USD $200 / mes de crédito en Google Cloud',
];

json_out(200, [
    'period' => [
        'month' => $now->format('F Y'),
        'month_start' => $startOfMonth,
        'today_start' => $startOfToday,
        'current_time' => $now->format('Y-m-d H:i:s'),
    ],
    'whatsapp' => $whatsapp,
    'gemini' => $gemini,
    'google_cloud' => $googleCloud,
    'resend' => $resend,
    'database' => $database,
    'storage' => $storage,
    'links' => [
        'meta_billing' => 'https://business.facebook.com/billing_hub',
        'meta_whatsapp' => 'https://developers.facebook.com/apps/',
        'google_cloud_billing' => 'https://console.cloud.google.com/billing',
        'google_ai_studio' => 'https://aistudio.google.com/app/plan_information',
        'resend_dashboard' => 'https://resend.com/emails',
        'hostinger' => 'https://hpanel.hostinger.com/',
        'github_actions' => 'https://github.com/settings/billing',
    ],
]);
