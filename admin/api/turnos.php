<?php
declare(strict_types=1);

/**
 * API turnos sombra (etapa 6).
 *
 * Auth:
 * - Sesión admin/profesional (register / cancel desde UI)
 * - O secret (webhook_secret / gas_api_secret / install_token) para mirror desde GAS
 *
 * POST action=register — upsert por calendar_event_id tras book
 * POST action=cancel   — status cancelled + anula recordatorios pending
 *
 * Docs: docs/codigo-datos-relacionales.md
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_relational_turnos.php';

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
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Webhook-Secret');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * @param array<string,mixed> $params
 */
function kinesica_turnos_api_authorized(array $params): bool
{
    $cfg = function_exists('cfg') ? cfg() : [];
    $candidates = [];
    foreach (['gas_api_secret', 'webhook_secret', 'install_token'] as $k) {
        $v = trim((string) ($cfg[$k] ?? ''));
        if ($v !== '') {
            $candidates[] = $v;
        }
    }
    $envSecret = trim((string) (
        getenv('KINESICA_BACKUP_SECRET')
        ?: ($_SERVER['KINESICA_BACKUP_SECRET'] ?? $_ENV['KINESICA_BACKUP_SECRET'] ?? '')
    ));
    if ($envSecret !== '') {
        $candidates[] = $envSecret;
    }
    $given = trim((string) (
        $params['secret']
        ?? $_SERVER['HTTP_X_WEBHOOK_SECRET']
        ?? ''
    ));
    $authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($given === '' && str_starts_with($authHeader, 'Bearer ')) {
        $given = trim(substr($authHeader, 7));
    }
    if ($given === '' || $candidates === []) {
        return false;
    }
    foreach ($candidates as $expected) {
        if (hash_equals($expected, $given)) {
            return true;
        }
    }
    return false;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    json_out(405, ['status' => 'error', 'message' => 'Método no permitido']);
}

$raw = file_get_contents('php://input');
$json = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
$data = is_array($json) ? $json : $_POST;
$action = strtolower(trim((string) ($data['action'] ?? 'register')));

$viaSecret = kinesica_turnos_api_authorized($data);
$auth = null;
if (!$viaSecret) {
    require_header();
    $auth = require_auth();
    if (function_exists('is_colaborador') && is_colaborador($auth)) {
        json_out(403, ['status' => 'error', 'message' => 'Acceso denegado']);
    }
}

try {
    $pdo = db();
} catch (Throwable $e) {
    json_out(500, ['status' => 'error', 'message' => 'Base de datos no disponible']);
}

if (!kinesica_rel_turnos_ready($pdo)) {
    json_out(503, [
        'status' => 'error',
        'message' => 'Tabla turnos no disponible. Corré migrate.php (006_turnos).',
        'code' => 'turnos_missing',
    ]);
}

if ($action === 'register') {
    $data['source'] = (string) ($data['source'] ?? ($viaSecret ? 'gas' : 'booking'));
    try {
        $tid = kinesica_rel_register_turno_from_booking($pdo, $data);
    } catch (Throwable $e) {
        error_log('kinesica turnos register: ' . $e->getMessage());
        json_out(500, ['status' => 'error', 'message' => 'No se pudo registrar el turno']);
    }
    if ($tid === null) {
        json_out(422, [
            'status' => 'error',
            'message' => 'calendar_event_id / eventId requerido',
        ]);
    }
    json_out(200, [
        'status' => 'success',
        'action' => 'register',
        'turno_id' => $tid,
    ]);
}

if ($action === 'cancel') {
    $ref = [
        'calendar_event_id' => (string) ($data['calendar_event_id'] ?? $data['eventId'] ?? $data['event_id'] ?? ''),
        'turno_id' => (int) ($data['turno_id'] ?? $data['id'] ?? 0),
    ];
    try {
        $res = kinesica_rel_cancel_turno($pdo, $ref);
    } catch (Throwable $e) {
        error_log('kinesica turnos cancel: ' . $e->getMessage());
        json_out(500, ['status' => 'error', 'message' => 'No se pudo cancelar el turno']);
    }
    if (empty($res['ok'])) {
        json_out(404, [
            'status' => 'error',
            'message' => 'Turno no encontrado',
            'reason' => $res['reason'] ?? 'not_found',
        ]);
    }
    json_out(200, [
        'status' => 'success',
        'action' => 'cancel',
        'turno_id' => $res['turno_id'],
        'calendar_event_id' => $res['calendar_event_id'],
        'reminders_updated' => $res['reminders_updated'],
    ]);
}

json_out(400, ['status' => 'error', 'message' => 'Acción desconocida (register|cancel)']);
