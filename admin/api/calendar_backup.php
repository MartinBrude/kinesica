<?php
declare(strict_types=1);

/**
 * Kinésica - Endpoint de Respaldo de Calendario y Sincronización
 * URL: /admin/api/calendar_backup.php
 *
 * Acciones soportadas:
 * - GET/POST action=get_slots         -> Devuelve horarios libres desde el respaldo local
 * - GET/POST action=get_slots_range   -> Devuelve mapa de días con horarios libres desde el respaldo local
 * - POST     action=book              -> Agenda en modo respaldo, bloquea el hueco y alerta SOLO a Norberto para auditar
 * - POST     action=sync_client_slots -> Piggyback pasivo (Origin del sitio, secret o sesión admin)
 * - POST     action=push_snapshot     -> Recibe desde Google Apps Script / n8n los bloques ocupados (busy_intervals)
 *                                        y devuelve reservas pendientes de conciliar en Google Calendar
 */

require_once __DIR__ . '/lib_calendar_backup.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://www.kinesica.com.ar',
    'https://kinesica.com.ar',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Webhook-Secret');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input');
$jsonBody = is_string($rawBody) && $rawBody !== '' ? json_decode($rawBody, true) : null;
$params = array_merge($_GET, $_POST, is_array($jsonBody) ? $jsonBody : []);
$action = trim((string) ($params['action'] ?? 'get_slots'));

require_once __DIR__ . '/calendar_backup_auth.php';

require __DIR__ . '/calendar_backup_dispatch.php';
