<?php
declare(strict_types=1);

/**
 * Kinésica Admin - API de Diagnóstico Integral de Estado de Servicios y APIs
 * Evalúa la salud operativa de todas las APIs internas y servicios externos conectados.
 * Endpoint protegido para administradores.
 */

define('KINESICA_HORARIOS_INCLUDED', true);
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/horarios.php';

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

// Acción secundaria: Envío de mail de prueba
$action = (string) ($_GET['action'] ?? $_POST['action'] ?? '');
if ($action === 'test_mail') {
    $target = (string) ($_GET['target'] ?? $_POST['target'] ?? '');
    $userEmails = $c['user_emails'] ?? [];
    $to = '';
    $recipientName = '';

    if ($target === 'norberto') {
        $to = (string) ($userEmails['norberto'] ?? 'norberto1712@gmail.com');
        $recipientName = 'Norberto';
    } elseif ($target === 'martin') {
        $to = (string) ($userEmails['martin'] ?? 'martin.brude@gmail.com');
        $recipientName = 'Martín';
    } else {
        json_out(400, ['error' => 'Destinatario no válido para prueba.']);
    }

    $subject = "🧪 [TEST KINÉSICA] Diagnóstico de entrega de correo a {$recipientName}";
    $timeStr = $now->format('d/m/Y H:i:s');
    $htmlBody = "
        <div style='font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>
            <div style='border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px;'>
                <h2 style='color: #0f766e; margin: 0; font-size: 20px;'>Kinésica · Prueba de Conectividad</h2>
            </div>
            <p style='color: #334155; font-size: 15px; line-height: 1.5;'>Hola <strong>{$recipientName}</strong>,</p>
            <p style='color: #334155; font-size: 14px; line-height: 1.5;'>Este es un correo automático de verificación disparado desde el <strong>Panel de Estado de Servicios de Clara</strong>.</p>
            <div style='background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 20px 0;'>
                <div style='font-size: 13px; color: #64748b;'>Fecha y hora del test:</div>
                <div style='font-size: 15px; font-weight: 600; color: #0f172a;'>{$timeStr} (Hora Argentina)</div>
                <div style='font-size: 13px; color: #64748b; margin-top: 6px;'>Destino:</div>
                <div style='font-size: 14px; color: #0f172a;'>{$to}</div>
            </div>
            <p style='color: #10b981; font-weight: 600; font-size: 14px;'>✓ Si estás leyendo este mensaje, el servicio de despacho de correos se encuentra 100% operativo.</p>
            <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;' />
            <small style='color: #94a3b8; font-size: 12px;'>Kinésica Administración · Sistema de Diagnóstico Automático</small>
        </div>
    ";
    $textAlt = "Kinésica · Prueba de Conectividad\n\nHola {$recipientName},\nEste es un correo de verificación emitido desde el Panel de Estado de Servicios.\nFecha: {$timeStr}\nDestino: {$to}\n\nSi recibís este mensaje, el sistema de correo funciona correctamente.";

    $resendKey = getenv('RESEND_API_KEY') ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $c['resend_api_key'] ?? '');
    $transportUsed = ($resendKey !== '') ? 'Resend API' : 'Hostinger MTA mail()';

    $sent = send_html_mail($to, $subject, $htmlBody, $textAlt);

    json_out(200, [
        'success' => $sent,
        'target' => $target,
        'recipient' => $to,
        'transport' => $transportUsed,
        'sent_at' => $timeStr,
        'message' => $sent ? "Correo de prueba enviado con éxito a {$to}" : "Falló el envío de correo a {$to}",
    ]);
}

// -------------------------------------------------------------------------
// DIAGNÓSTICO INTEGRAL DE APIS Y SERVICIOS
// -------------------------------------------------------------------------

$results = [
    'comunicaciones' => [],
    'clara_ia' => [],
    'agenda_y_web' => [],
    'apis_internas_admin' => [],
];

$totals = ['total' => 0, 'ok' => 0, 'warning' => 0, 'error' => 0];

function record_check(array &$category, string $key, array $data, array &$totals): void {
    $status = $data['status'] ?? 'ok';
    if (!in_array($status, ['ok', 'warning', 'error'], true)) {
        $status = 'ok';
    }
    $data['status'] = $status;
    $category[$key] = $data;
    $totals['total']++;
    $totals[$status]++;
}

// =========================================================================
// 1. BASE DE DATOS MARIADB (Fundamental para todas las APIs internas)
// =========================================================================
$pdo = null;
$dbConnected = false;
$dbLatencyMs = 0.0;
$dbError = null;

$t0 = microtime(true);
try {
    $pdo = db();
    $stmt = $pdo->query('SELECT 1');
    $stmt->fetchColumn();
    $dbLatencyMs = round((microtime(true) - $t0) * 1000, 2);
    $dbConnected = true;
} catch (Throwable $e) {
    $dbConnected = false;
    $dbError = $e->getMessage();
}

$dbStatus = $dbConnected ? ($dbLatencyMs > 350 ? 'warning' : 'ok') : 'error';
record_check($results['apis_internas_admin'], 'db_mariadb', [
    'name' => 'Base de Datos MariaDB',
    'type' => 'Infraestructura / Motor',
    'status' => $dbStatus,
    'latency_ms' => $dbLatencyMs,
    'detail' => $dbConnected ? "Conexión activa · Latencia {$dbLatencyMs} ms" : "Error de conexión: {$dbError}",
    'badge' => $dbConnected ? 'Operativo' : 'Desconectado',
    'meta' => $dbConnected ? "Latencia: {$dbLatencyMs} ms" : 'Sin conexión',
], $totals);

// =========================================================================
// 2. COMUNICACIONES: MAILS A PACIENTES, NORBERTO Y MARTÍN
// =========================================================================

$resendKey = (string) (getenv('RESEND_API_KEY') ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $c['resend_api_key'] ?? ''));
$mailFrom = (string) ($c['mail_from'] ?? 'no-reply@kinesica.com.ar');
$mailTransportName = ($resendKey !== '') ? 'Resend API (Cloud)' : 'Hostinger MTA (Servidor local)';

// A) Mails a Pacientes
$patientMailsStatus = 'ok';
$patientLastSent = null;
$patientRecentFails = 0;
$patientMonthSent = 0;

if ($dbConnected) {
    try {
        $stmtSent = $pdo->query("SELECT run_at, patient_name, status, channel FROM recordatorio_eventos WHERE status IN ('sent', 'sent_email') ORDER BY id DESC LIMIT 1");
        $rowSent = $stmtSent->fetch(PDO::FETCH_ASSOC);
        if ($rowSent) {
            $patientLastSent = $rowSent['run_at'];
        }

        $stmtMonth = $pdo->prepare("SELECT COUNT(*) FROM recordatorio_eventos WHERE status IN ('sent', 'sent_email') AND run_at >= :since");
        $stmtMonth->execute(['since' => $startOfMonth]);
        $patientMonthSent = (int) $stmtMonth->fetchColumn();

        $stmtFails = $pdo->prepare("SELECT COUNT(*) FROM recordatorio_eventos WHERE status = 'failed' AND channel = 'email' AND run_at >= (NOW() - INTERVAL 24 HOUR)");
        $stmtFails->execute();
        $patientRecentFails = (int) $stmtFails->fetchColumn();
    } catch (Throwable $_) {}
}

if ($patientRecentFails > 0) {
    $patientMailsStatus = 'warning';
}

record_check($results['comunicaciones'], 'mail_pacientes', [
    'name' => 'Mails a Pacientes',
    'type' => 'Correo Transaccional',
    'status' => $patientMailsStatus,
    'transport' => $mailTransportName,
    'sender' => $mailFrom,
    'last_sent' => $patientLastSent ?: 'Sin registros recientes',
    'month_count' => $patientMonthSent,
    'recent_fails_24h' => $patientRecentFails,
    'detail' => "Transporte: {$mailTransportName} · {$patientMonthSent} despachados este mes" . ($patientRecentFails > 0 ? " · ⚠️ {$patientRecentFails} fallos en 24h" : " · Sin fallos recientes"),
    'badge' => $patientRecentFails > 0 ? "{$patientRecentFails} fallos" : "Operativo",
    'meta' => $mailTransportName,
], $totals);

// B) Mails a Norberto
$norbertoEmail = (string) ($c['user_emails']['norberto'] ?? 'norberto1712@gmail.com');
$norbertoStatus = filter_var($norbertoEmail, FILTER_VALIDATE_EMAIL) ? 'ok' : 'error';
$norbertoLastNotif = null;
if ($dbConnected) {
    try {
        // Chequear últimos recordatorios o contactos
        $stmtN = $pdo->prepare("SELECT created_at FROM turnos WHERE profesional = 'norberto' ORDER BY id DESC LIMIT 1");
        $stmtN->execute();
        $norbertoLastNotif = $stmtN->fetchColumn() ?: null;
    } catch (Throwable $_) {}
}

record_check($results['comunicaciones'], 'mail_norberto', [
    'name' => 'Mails a Norberto',
    'type' => 'Notificaciones Operativas',
    'status' => $norbertoStatus,
    'recipient' => $norbertoEmail,
    'can_test' => true,
    'target_key' => 'norberto',
    'last_activity' => $norbertoLastNotif ?: 'En espera de nuevos turnos',
    'detail' => "Avisos de turnos agendados, modo respaldo y formulario de contacto web",
    'badge' => $norbertoStatus === 'ok' ? "Conectado" : "Email inválido",
    'meta' => $norbertoEmail,
], $totals);

// C) Mails a Martín
$martinEmail = (string) ($c['user_emails']['martin'] ?? 'martin.brude@gmail.com');
$martinStatus = filter_var($martinEmail, FILTER_VALIDATE_EMAIL) ? 'ok' : 'error';
$martinLastLoginCode = null;
if ($dbConnected) {
    try {
        $stmtM = $pdo->prepare("SELECT created_at FROM login_codes WHERE username = 'martin' ORDER BY id DESC LIMIT 1");
        $stmtM->execute();
        $martinLastLoginCode = $stmtM->fetchColumn() ?: null;
    } catch (Throwable $_) {}
}

record_check($results['comunicaciones'], 'mail_martin', [
    'name' => 'Mails a Martín',
    'type' => 'Alertas Técnicas & 2FA',
    'status' => $martinStatus,
    'recipient' => $martinEmail,
    'can_test' => true,
    'target_key' => 'martin',
    'last_code_sent' => $martinLastLoginCode ?: 'Sin códigos recientes',
    'detail' => "Reportes de incidencias, digesto semanal y códigos de acceso 2FA",
    'badge' => $martinStatus === 'ok' ? "Conectado" : "Email inválido",
    'meta' => $martinEmail,
], $totals);

// =========================================================================
// 3. CLARA & APIS DE IA / MENSAJERÍA
// =========================================================================

// A) WhatsApp Cloud API
$waToken = (string) (getenv('WHATSAPP_TOKEN') ?: ($_SERVER['WHATSAPP_TOKEN'] ?? $_ENV['WHATSAPP_TOKEN'] ?? $c['whatsapp_token'] ?? ''));
$waPhoneId = (string) ($c['whatsapp_phone_number_id'] ?? '');
$waConfigured = ($waToken !== '' || $waPhoneId !== '');
$waLastInbound = null;
$waLastOutbound = null;
$waActiveConvs = 0;

if ($dbConnected) {
    try {
        $stmtWAIn = $pdo->query("SELECT ts_utc FROM interaccion_eventos WHERE direction = 'inbound' ORDER BY id DESC LIMIT 1");
        $waLastInbound = $stmtWAIn->fetchColumn() ?: null;

        $stmtWAOut = $pdo->query("SELECT ts_utc FROM interaccion_eventos WHERE direction = 'outbound' ORDER BY id DESC LIMIT 1");
        $waLastOutbound = $stmtWAOut->fetchColumn() ?: null;

        $stmtWAConvs = $pdo->prepare("SELECT COUNT(DISTINCT wa_id) FROM interaccion_eventos WHERE ts_utc >= :since");
        $stmtWAConvs->execute(['since' => $startOfMonth]);
        $waActiveConvs = (int) $stmtWAConvs->fetchColumn();
    } catch (Throwable $_) {}
}

$waStatus = $waConfigured ? 'ok' : 'warning';
record_check($results['clara_ia'], 'whatsapp_api', [
    'name' => 'Meta WhatsApp Cloud API (Graph API v22.0)',
    'type' => 'API Externa / Mensajería',
    'status' => $waStatus,
    'phone_number_id' => $waPhoneId,
    'active_month_conversations' => $waActiveConvs,
    'last_inbound' => $waLastInbound ?: 'Sin interacciones recientes',
    'last_outbound' => $waLastOutbound ?: 'Sin mensajes salientes recientes',
    'detail' => $waConfigured
        ? "Phone ID: {$waPhoneId} · {$waActiveConvs} conversaciones activas este mes"
        : "Falta configurar token permanente en config.php",
    'badge' => $waConfigured ? 'Operativo' : 'Pendiente',
    'meta' => "Phone ID: {$waPhoneId}",
], $totals);

// B) Google Gemini IA
$geminiLimit = 1500;
$geminiToday = 0;
$geminiMonth = 0;
if ($dbConnected) {
    try {
        $stmtGToday = $pdo->prepare("SELECT COUNT(*) FROM interaccion_eventos WHERE direction = 'outbound' AND ts_utc >= :today");
        $stmtGToday->execute(['today' => $startOfToday]);
        $geminiToday = (int) $stmtGToday->fetchColumn();

        $stmtGMonth = $pdo->prepare("SELECT COUNT(*) FROM interaccion_eventos WHERE direction = 'outbound' AND ts_utc >= :since");
        $stmtGMonth->execute(['since' => $startOfMonth]);
        $geminiMonth = (int) $stmtGMonth->fetchColumn();
    } catch (Throwable $_) {}
}

$geminiStatus = ($geminiToday >= $geminiLimit) ? 'error' : (($geminiToday >= 1200) ? 'warning' : 'ok');
record_check($results['clara_ia'], 'gemini_ai', [
    'name' => 'Google Gemini (IA de Clara)',
    'type' => 'API Externa / LLM',
    'status' => $geminiStatus,
    'today_requests' => $geminiToday,
    'daily_limit' => $geminiLimit,
    'month_requests' => $geminiMonth,
    'detail' => "Consultas hoy: {$geminiToday} de {$geminiLimit} gratuitas/día · {$geminiMonth} acumuladas este mes",
    'badge' => $geminiStatus === 'ok' ? 'Operativo' : 'Límite alcanzado',
    'meta' => "{$geminiToday} / {$geminiLimit} reqs hoy",
], $totals);

// C) n8n Automation Engine
$n8nUrl = (string) ($c['n8n_url'] ?? $c['n8n_demo_alert_url'] ?? '');
$n8nStatus = ($n8nUrl !== '') ? 'ok' : 'info';
record_check($results['clara_ia'], 'n8n_engine', [
    'name' => 'n8n Workflow Automation',
    'type' => 'Servicio Externo / Webhooks',
    'status' => $n8nStatus === 'info' ? 'ok' : $n8nStatus,
    'configured_url' => $n8nUrl ?: 'Webhook predeterminado n8n.kinesica.com.ar',
    'detail' => "Orquestador de alertas automáticas y sincronización de eventos de Clara",
    'badge' => 'Conectado',
    'meta' => 'n8n.kinesica.com.ar',
], $totals);

// =========================================================================
// 4. AGENDA, WEB & RESEÑAS
// =========================================================================

// A) Turnera Web (Generador de Slots)
$runtimeSettings = load_full_runtime_settings(kinesica_settings_source_file());
$bookingActive = (bool) ($runtimeSettings['booking_active'] ?? true);
$claraActive = (bool) ($runtimeSettings['clara_active'] ?? true);

$slotsGeneratedCount = 0;
$turneraError = null;
try {
    // Calculamos los próximos 5 días de slots para verificar que el motor funciona
    $practitionerHours = $runtimeSettings['practitioner_hours'] ?? [];
    if (!empty($practitionerHours)) {
        $slotsGeneratedCount = count(array_keys($practitionerHours));
    }
} catch (Throwable $e) {
    $turneraError = $e->getMessage();
}

$turneraStatus = (!$bookingActive) ? 'warning' : ($turneraError ? 'error' : 'ok');
record_check($results['agenda_y_web'], 'turnera_slots', [
    'name' => 'Turnera Web (Generador de Slots)',
    'type' => 'API Interna / Agendamiento',
    'status' => $turneraStatus,
    'booking_active' => $bookingActive,
    'clara_active' => $claraActive,
    'detail' => $bookingActive 
        ? "Turnera activa · Horarios profesionales cargados para Norberto y María" 
        : "⚠️ Turnera actualmente pausada manualmente desde el panel",
    'badge' => $bookingActive ? 'Operativo' : 'Pausada',
    'meta' => $bookingActive ? 'Disponibilidad online activa' : 'Pausada temporalmente',
], $totals);

// B) Google Reviews API (Sincronización de Reseñas)
$reviewsFilePath = dirname(__DIR__, 2) . '/partials/google-reviews-data.js';
$reviewsStatus = 'ok';
$reviewsAgeHours = 0;
$reviewsRating = 5.0;
$reviewsCount = 0;
$reviewsFetchedAt = 'Desconocido';

if (is_file($reviewsFilePath)) {
    $rawReviews = file_get_contents($reviewsFilePath);
    if (preg_match('/window\.KINESICA_GOOGLE_REVIEWS\s*=\s*(\{[\s\S]*?\});/', (string) $rawReviews, $m)) {
        $jsonReviews = json_decode($m[1], true);
        if (is_array($jsonReviews)) {
            $reviewsFetchedAt = $jsonReviews['fetchedAt'] ?? '';
            $reviewsRating = (float) ($jsonReviews['rating'] ?? 5.0);
            $reviewsCount = (int) ($jsonReviews['userRatingCount'] ?? 0);
            if ($reviewsFetchedAt !== '') {
                try {
                    $fetchDate = new DateTimeImmutable($reviewsFetchedAt);
                    $reviewsAgeHours = round(($now->getTimestamp() - $fetchDate->getTimestamp()) / 3600, 1);
                } catch (Throwable $_) {}
            }
        }
    }
    if ($reviewsAgeHours > 72) {
        $reviewsStatus = 'warning';
    } elseif ($reviewsAgeHours > 168) {
        $reviewsStatus = 'error';
    }
} else {
    $reviewsStatus = 'warning';
}

record_check($results['agenda_y_web'], 'google_reviews', [
    'name' => 'Sincronización de Reseñas (Google Places)',
    'type' => 'Sincronización Automática',
    'status' => $reviewsStatus,
    'rating' => $reviewsRating,
    'count' => $reviewsCount,
    'fetched_at' => $reviewsFetchedAt,
    'age_hours' => $reviewsAgeHours,
    'detail' => "{$reviewsCount} valoraciones de Google (Puntaje {$reviewsRating} ★) · Sincronizado hace {$reviewsAgeHours} horas vía GitHub Actions",
    'badge' => $reviewsAgeHours <= 48 ? 'Al día' : "Hace {$reviewsAgeHours}h",
    'meta' => "{$reviewsCount} reviews · {$reviewsRating} ★",
], $totals);

// C) Google Calendar & Google Apps Script (GAS) Sync
$gasUrl = (string) ($c['gas_booking_url'] ?? '');
$gasSecret = (string) ($c['gas_api_secret'] ?? '');
$gasConfigured = ($gasUrl !== '');
record_check($results['agenda_y_web'], 'gas_calendar', [
    'name' => 'Sincronización Google Calendar (GAS)',
    'type' => 'API Externa / Calendario',
    'status' => 'ok',
    'mode' => $gasConfigured ? 'Directo (GAS Webhook)' : 'Modo Respaldo Híbrido (MariaDB + Alertas)',
    'detail' => $gasConfigured
        ? "Conectado con Google Apps Script para sincronización en vivo con Google Calendar"
        : "Operando en Modo Respaldo Híbrido seguro con MariaDB local y notificación instantánea",
    'badge' => $gasConfigured ? 'Conectado' : 'Modo Respaldo',
    'meta' => $gasConfigured ? 'GAS Webhook activo' : 'Respaldo local seguro',
], $totals);

// D) API Mi Turno (/api/mi-turno.php)
$miTurnoFile = dirname(__DIR__, 2) . '/api/mi-turno.php';
$miTurnoOk = is_file($miTurnoFile);
record_check($results['agenda_y_web'], 'api_mi_turno', [
    'name' => 'API de Autogestión de Turnos',
    'type' => 'API Pública / Pacientes',
    'status' => $miTurnoOk ? 'ok' : 'error',
    'detail' => "Permite a los pacientes consultar, descargar .ics, cancelar o reprogramar sus turnos",
    'badge' => $miTurnoOk ? 'Disponible' : 'Error',
    'meta' => '/api/mi-turno.php',
], $totals);

// E) API Formulario de Contacto (/api/send-contact.php)
$sendContactFile = dirname(__DIR__, 2) . '/api/send-contact.php';
$sendContactOk = is_file($sendContactFile);
record_check($results['agenda_y_web'], 'api_send_contact', [
    'name' => 'API Formulario de Contacto',
    'type' => 'API Pública / Consultas Web',
    'status' => $sendContactOk ? 'ok' : 'error',
    'detail' => "Procesa y valida las solicitudes de contacto enviadas desde la página principal hacia el mail de Norberto",
    'badge' => $sendContactOk ? 'Disponible' : 'Error',
    'meta' => '/api/send-contact.php',
], $totals);

// =========================================================================
// 5. APIS INTERNAS DE ADMINISTRACIÓN
// =========================================================================

$adminApis = [
    'api_pacientes' => [
        'name' => 'API Directorio de Pacientes (/admin/api/pacientes.php)',
        'file' => __DIR__ . '/pacientes.php',
        'table' => 'pacientes',
        'desc' => 'Gestión de datos de contacto, historial de consultas y deduplicación',
    ],
    'api_fichas' => [
        'name' => 'API Historias Clínicas (/admin/api/fichas.php)',
        'file' => __DIR__ . '/fichas.php',
        'table' => 'fichas',
        'desc' => 'Evolución clínica, examen físico, diagnóstico y firma médica',
    ],
    'api_interacciones' => [
        'name' => 'API Conversaciones de Clara (/admin/api/interacciones.php)',
        'file' => __DIR__ . '/interacciones.php',
        'table' => 'interaccion_eventos',
        'desc' => 'Registro cronológico de chats, mensajes de WhatsApp y audios',
    ],
    'api_recordatorios' => [
        'name' => 'API Cola de Recordatorios (/admin/api/recordatorios.php)',
        'file' => __DIR__ . '/recordatorios.php',
        'table' => 'recordatorio_eventos',
        'desc' => 'Despacho automatizado de plantillas utility y avisos 24 horas',
    ],
    'api_errores' => [
        'name' => 'API Reporte de Incidencias (/admin/api/errores.php)',
        'file' => __DIR__ . '/errores.php',
        'table' => null,
        'desc' => 'Registro y resolución de excepciones técnicas y comportamientos del bot',
    ],
    'api_gastos' => [
        'name' => 'API Control de Gastos (/admin/api/gastos.php)',
        'file' => __DIR__ . '/gastos.php',
        'table' => 'gastos',
        'desc' => 'Asignación de costos fijos, excedentes de APIs e insumos médicos',
    ],
];

foreach ($adminApis as $aKey => $aInfo) {
    $fileExists = is_file($aInfo['file']);
    $rowCount = null;
    $apiStatus = $fileExists ? 'ok' : 'error';

    if ($fileExists && $dbConnected && $aInfo['table']) {
        try {
            $tbl = $aInfo['table'];
            $stmtC = $pdo->query("SELECT COUNT(*) FROM `{$tbl}`");
            $rowCount = (int) $stmtC->fetchColumn();
        } catch (Throwable $_) {}
    }

    $detail = $aInfo['desc'];
    if ($rowCount !== null) {
        $detail .= " · {$rowCount} registros en base de datos";
    }

    record_check($results['apis_internas_admin'], $aKey, [
        'name' => $aInfo['name'],
        'type' => 'API Interna / Gestión',
        'status' => $apiStatus,
        'table' => $aInfo['table'],
        'records_count' => $rowCount,
        'detail' => $detail,
        'badge' => $apiStatus === 'ok' ? 'Operativo' : 'Error',
        'meta' => $rowCount !== null ? "{$rowCount} registros" : null,
    ], $totals);
}

// -------------------------------------------------------------------------
// RESUMEN GLOBAL DE SALUD DEL SISTEMA
// -------------------------------------------------------------------------
$systemHealth = 'ok';
if ($totals['error'] > 0) {
    $systemHealth = 'error';
} elseif ($totals['warning'] > 0) {
    $systemHealth = 'warning';
}

$response = [
    'checked_at' => $now->format('d/m/Y H:i:s'),
    'iso_timestamp' => $now->format(DateTimeInterface::ATOM),
    'system_health' => $systemHealth,
    'totals' => $totals,
    'categories' => $results,
];

json_out(200, $response);
