<?php
declare(strict_types=1);

/**
 * Envía un mail de prueba de confirmación de turno al correo del usuario logueado.
 * POST JSON: paciente, fecha, hora, profesional, servicio, esMenor?
 * Destino forzado a user_email(session) — nunca acepta email del body.
 */

require __DIR__ . '/lib.php';
require_once dirname(__DIR__, 2) . '/api/confirmation-mail-lib.php';

require_header();
$auth = require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$username = (string) ($auth['username'] ?? '');
$to = user_email($username);
if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    json_out(400, ['error' => 'Tu usuario no tiene un correo configurado. Cargalo en Usuarios del admin.']);
}

function kinesica_preview_rate_ok(string $key, int $max, int $windowSec): bool
{
    try {
        $dir = rtrim(sys_get_temp_dir(), '/') . '/kinesica_conf_preview_rl';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        $file = $dir . '/' . hash('sha256', $key) . '.json';
        $now = time();
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return true;
        }
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $hits = json_decode($raw ?: '[]', true);
        if (!is_array($hits)) {
            $hits = [];
        }
        $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $windowSec));
        $ok = count($hits) < $max;
        if ($ok) {
            $hits[] = $now;
        }
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($hits));
        flock($fh, LOCK_UN);
        fclose($fh);
        return $ok;
    } catch (Throwable $e) {
        return true;
    }
}

if (!kinesica_preview_rate_ok('user:' . strtolower($username), 5, 3600)) {
    json_out(429, ['error' => 'Demasiados mails de prueba. Probá de nuevo más tarde.']);
}

$input = read_json();
$paciente = trim((string) ($input['paciente'] ?? ''));
$fecha = trim((string) ($input['fecha'] ?? ''));
$hora = trim((string) ($input['hora'] ?? ''));
$profesional = trim((string) ($input['profesional'] ?? 'Lic. Norberto Brude'));
$servicio = trim((string) ($input['servicio'] ?? 'Terapias Manuales'));
$esMenor = !empty($input['esMenor']) || !empty($input['isMenor']);

if ($paciente === '') {
    json_out(400, ['error' => 'Ingresá el nombre del paciente.']);
}
if ($fecha === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    json_out(400, ['error' => 'Ingresá una fecha válida (AAAA-MM-DD).']);
}
if ($hora === '') {
    json_out(400, ['error' => 'Ingresá el horario.']);
}
if ($profesional === '') {
    json_out(400, ['error' => 'Ingresá el profesional.']);
}

$runtimeSettings = kinesica_read_settings(kinesica_admin_settings_file(dirname(__DIR__, 2) . '/api'));
$built = kinesica_build_confirmation_mail([
    'paciente' => $paciente,
    'fecha' => $fecha,
    'hora' => $hora,
    'profesional' => $profesional,
    'servicio' => $servicio !== '' ? $servicio : 'Terapias Manuales',
    'esMenor' => $esMenor,
    'esCancelacion' => false,
    'settings' => $runtimeSettings,
]);

$subject = '[PRUEBA] ' . $built['subject'];
$html = $built['html'];
// Banner visible de prueba al inicio del contenido.
$html = preg_replace(
    '/(<div class="content">\s*)/',
    '$1<p style="margin:0 0 16px 0;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;color:#9a3412;font-size:13px;font-weight:600;">Mail de prueba desde /admin/clara — no es un turno real.</p>',
    $html,
    1
) ?? $html;

$textAlt = "Mail de prueba desde /admin/clara\n\n"
    . "Paciente: {$paciente}\n"
    . "Fecha: {$built['fechaLegible']}\n"
    . "Horario: {$built['horaLegible']}\n"
    . "Profesional: {$profesional}\n"
    . "Servicio: {$servicio}\n";

$sent = send_html_mail($to, $subject, $html, $textAlt);
if (!$sent) {
    json_out(502, ['error' => 'No se pudo enviar el correo de prueba.']);
}

json_out(200, [
    'success' => true,
    'emailMasked' => mask_email($to),
    'subject' => $subject,
]);
