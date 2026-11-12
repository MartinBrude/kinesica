<?php
declare(strict_types=1);

/**
 * Proxy autenticado para reservas desde la turnera admin.
 * Añade GAS_API_SECRET server-side para que Apps Script acepte adminMode
 * (DNI/email opcionales). El cliente público no puede forjar ese bypass.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_calendar_backup.php';
require_once __DIR__ . '/lib_booking_dni.php';

require_header();
$auth = require_auth();
if (!can_use_admin_booking($auth)) {
    json_out(403, ['error' => 'Solo administradores o profesionales pueden agendar en modo admin.']);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
if (!is_array($input)) {
    json_out(422, ['error' => 'JSON inválido']);
}

unset($input['secret']);
$input['action'] = 'book';
$input['adminMode'] = true;

$dni = trim((string) ($input['dni'] ?? ''));
if ($dni !== '' && !kinesica_is_valid_booking_dni($dni)) {
    json_out(400, ['status' => 'error', 'message' => 'DNI o documento inválido.']);
}

$email = trim((string) ($input['email'] ?? ''));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_out(400, ['status' => 'error', 'message' => 'Correo electrónico válido es requerido.']);
}

$c = cfg();
$secret = trim((string) ($c['gas_api_secret'] ?? ''));
if ($secret === '') {
    $secret = trim((string) ($c['webhook_secret'] ?? $c['install_token'] ?? ''));
}
if ($secret === '') {
    json_out(500, ['error' => 'Falta gas_api_secret / webhook_secret en config.php']);
}
$input['secret'] = $secret;

$gasUrl = trim((string) (
    getenv('KINESICA_GAS_BOOKING_URL')
    ?: ($_SERVER['KINESICA_GAS_BOOKING_URL'] ?? $_ENV['KINESICA_GAS_BOOKING_URL'] ?? $c['gas_booking_url'] ?? KINESICA_BACKUP_DEFAULT_GAS_URL)
));
if ($gasUrl === '' || $gasUrl === 'none') {
    json_out(500, ['error' => 'GAS URL no disponible']);
}

if (!function_exists('curl_init')) {
    json_out(500, ['error' => 'cURL no disponible']);
}

$ch = curl_init($gasUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
    CURLOPT_POSTFIELDS => json_encode($input, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 55,
]);
$raw = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);

if ($err || !is_string($raw) || $raw === '') {
    json_out(502, ['status' => 'error', 'message' => $err ?: 'Sin respuesta de Google Apps Script']);
}

$decoded = json_decode($raw, true);
if (!is_array($decoded)) {
    json_out(502, ['status' => 'error', 'message' => 'Respuesta inválida de Google Apps Script']);
}

$outCode = $httpCode >= 400 ? $httpCode : 200;
if (($decoded['status'] ?? '') === 'conflict') {
    $outCode = 409;
} elseif (($decoded['status'] ?? '') === 'error') {
    $outCode = $httpCode >= 400 ? $httpCode : 400;
}
json_out($outCode, $decoded);
