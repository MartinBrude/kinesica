<?php
/**
 * Kinésica - Endpoint de formularios de contacto (Red Profesional y Privacidad).
 * URL: /api/send-contact.php
 *
 * Reemplaza a Web3Forms: el mail se envía desde este servidor (Resend si hay
 * API key; si no, mail() del MTA) hacia una dirección fija del lado servidor.
 * El destinatario es siempre norberto1712@gmail.com (salvo 'contact_to' en la config
 * del servidor) y nunca se toma del request.
 */

header('Content-Type: application/json; charset=utf-8');

// CORS (mismas orígenes que send-confirmation.php)
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
    header('Access-Control-Allow-Headers: Content-Type');
}

function kinesica_contact_respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    kinesica_contact_respond(405, ['success' => false, 'error' => 'Método no permitido. Utilizar POST.']);
}

/** Texto de una línea: sin saltos ni caracteres de control (evita header injection). */
function kinesica_contact_line(mixed $v, int $max): string
{
    $s = is_scalar($v) ? (string) $v : '';
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}

/** Texto multilínea: conserva saltos de línea, elimina otros caracteres de control. */
function kinesica_contact_text(mixed $v, int $max): string
{
    $s = is_scalar($v) ? (string) $v : '';
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

function kinesica_contact_valid_email(string $s): bool
{
    if ($s === '' || strlen($s) > 120 || preg_match('/\s/', $s)) {
        return false;
    }
    return (bool) filter_var($s, FILTER_VALIDATE_EMAIL);
}

function kinesica_contact_rate_ok(string $key, int $max, int $windowSec): bool
{
    try {
        $dir = rtrim(sys_get_temp_dir(), '/') . '/kinesica_contact_rl';
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
        $hits = json_decode(stream_get_contents($fh) ?: '[]', true);
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

// --- Entrada (JSON o form-data) ---
$raw = file_get_contents('php://input');
$data = json_decode((string) $raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

// Honeypot: respuesta "exitosa" silenciosa para bots.
if (!empty($data['botcheck'])) {
    kinesica_contact_respond(200, ['success' => true]);
}

$type = kinesica_contact_line($data['type'] ?? '', 20);
if (!in_array($type, ['profesional', 'privacidad'], true)) {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Tipo de formulario inválido.']);
}

$lang = kinesica_contact_line($data['lang'] ?? 'es', 2);
if (!in_array($lang, ['es', 'en', 'fr', 'pt'], true)) {
    $lang = 'es';
}

$name = kinesica_contact_line($data['name'] ?? '', 120);
$email = kinesica_contact_line($data['email'] ?? '', 120);
$phone = kinesica_contact_line($data['phone'] ?? '', 60);
$specialty = kinesica_contact_line($data['specialty'] ?? '', 120);
$motive = kinesica_contact_line($data['motive'] ?? '', 160);
$scope = kinesica_contact_line($data['scope'] ?? '', 200);
$message = kinesica_contact_text($data['message'] ?? '', 4000);
$statement = kinesica_contact_text($data['statement'] ?? '', 800);

if ($name === '' || ($email === '' && $phone === '')) {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Nombre y un correo o teléfono son requeridos.']);
}
if ($email !== '' && !kinesica_contact_valid_email($email)) {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Correo electrónico con formato inválido.']);
}

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!kinesica_contact_rate_ok('ip:' . $clientIp, 6, 3600)
    || ($email !== '' && !kinesica_contact_rate_ok('email:' . strtolower($email), 4, 3600))) {
    kinesica_contact_respond(429, ['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
}

// --- Asunto según formulario ---
if ($type === 'profesional') {
    $subject = '[Kinésica - Red Profesional] Contacto de: ' . $name . ($specialty !== '' ? ' (' . $specialty . ')' : '');
} else {
    $privacySubjects = [
        'es' => '[Kinésica] Solicitud de eliminación de datos personales',
        'en' => '[Kinésica] Personal Data Deletion Request',
        'fr' => '[Kinésica] Demande de suppression des données personnelles',
        'pt' => '[Kinésica] Solicitação de exclusão de dados pessoais',
    ];
    // Los mails a Norberto van en español; el idioma de la solicitud queda en el cuerpo.
    $subject = $privacySubjects['es'] . ' - ' . $name . ($lang !== 'es' ? ' [' . strtoupper($lang) . ']' : '');
}

// --- Configuración local (gitignored) ---
$localCfg = [];
foreach (['config.php', 'mail.php'] as $f) {
    $path = __DIR__ . '/../admin/api/' . $f;
    if (is_file($path)) {
        $loaded = @include $path;
        if (is_array($loaded)) {
            $localCfg = array_merge($localCfg, $loaded);
        }
    }
}

// Destino fijo: Norberto. No depende de user_emails (cuentas del admin); solo se
// puede cambiar con 'contact_to' en admin/api/config.php o mail.php.
$to = trim((string) ($localCfg['contact_to'] ?? 'norberto1712@gmail.com'));
if (!kinesica_contact_valid_email($to)) {
    $to = 'norberto1712@gmail.com';
}
$mailFrom = trim((string) ($localCfg['mail_from'] ?? 'no-reply@kinesica.com.ar'));
if (!kinesica_contact_valid_email($mailFrom)) {
    $mailFrom = 'no-reply@kinesica.com.ar';
}
$replyTo = kinesica_contact_valid_email($email) ? $email : $mailFrom;

$fromName = $type === 'profesional' ? 'Kinésica Web (Red Profesional)' : 'Kinésica Web (Privacidad)';
$receivedAt = (new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('d/m/Y H:i');
$langNames = ['es' => 'Español', 'en' => 'English', 'fr' => 'Français', 'pt' => 'Português'];

if ($type === 'profesional') {
    $heading = 'Nuevo contacto profesional';
    $lead = 'Un colega escribió desde la página de <strong>Red Profesional</strong> del sitio.';
    $rows = [
        'Nombre' => $name,
        'Especialidad' => $specialty,
        'Correo' => $email,
        'Teléfono' => $phone,
        'Motivo' => $motive,
    ];
    $messageTitle = 'Mensaje';
    $messageBody = $message;
} else {
    $heading = 'Solicitud de eliminación de datos';
    $lead = 'Se recibió una solicitud desde la página de <strong>Privacidad</strong> (Ley 25.326 / RGPD / LGPD). '
        . 'Plazo de respuesta: 5 días hábiles.';
    $rows = [
        'Nombre' => $name,
        'Correo' => $email,
        'Teléfono' => $phone,
        'Alcance' => $scope,
        'Idioma' => $langNames[$lang] ?? $lang,
    ];
    $messageTitle = 'Detalles adicionales';
    $messageBody = $message;
}
$rows['Recibido'] = $receivedAt . ' (hora de Buenos Aires)';
$rows = array_filter($rows, static fn($v) => $v !== '' && $v !== 'No especificado' && $v !== 'No especificada');
$emptyMessage = '(Sin mensaje adicional)';

// Texto plano (alternativa)
$textLines = [mb_strtoupper($heading), str_repeat('-', 40)];
foreach ($rows as $label => $value) {
    $textLines[] = $label . ': ' . $value;
}
$textLines[] = '';
$textLines[] = $messageTitle . ':';
$textLines[] = $messageBody !== '' ? $messageBody : $emptyMessage;
if ($statement !== '') {
    $textLines[] = '';
    $textLines[] = '"' . $statement . '"';
}
$textLines[] = '';
$textLines[] = $email !== '' ? 'Para responder, contestá a este correo (Reply-To: ' . $email . ').' : 'Sin correo: contactar por teléfono.';
$textBody = implode("\n", $textLines);

// HTML (misma identidad visual que los mails de turnos)
$e = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$rowsHtml = '';
foreach ($rows as $label => $value) {
    $valueHtml = $e($value);
    if ($label === 'Correo') {
        $valueHtml = '<a href="mailto:' . $e($value) . '" style="color:#005f99;text-decoration:none;">' . $valueHtml . '</a>';
    }
    $rowsHtml .= '<tr>'
        . '<td style="padding:6px 14px 6px 0;color:#005f99;font-weight:600;font-size:14px;vertical-align:top;white-space:nowrap;">' . $e($label) . '</td>'
        . '<td style="padding:6px 0;color:#334155;font-size:15px;vertical-align:top;">' . $valueHtml . '</td>'
        . '</tr>';
}
$messageHtml = $messageBody !== ''
    ? nl2br($e($messageBody), false)
    : '<span style="color:#94a3b8;">' . $e($emptyMessage) . '</span>';
$statementHtml = $statement !== ''
    ? '<p style="margin:14px 0 0 0;padding-left:12px;border-left:3px solid #cbd5e1;color:#64748b;font-size:13px;font-style:italic;">' . $e($statement) . '</p>'
    : '';
$replySubject = rawurlencode('Re: ' . $subject);
$buttonHtml = $email !== ''
    ? '<p style="text-align:center;margin:26px 0 4px 0;"><a href="mailto:' . $e($email) . '?subject=' . $replySubject . '" '
        . 'style="display:inline-block;background-color:#005f99;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:8px;">'
        . 'Responder a ' . $e(mb_substr($name, 0, 40)) . '</a></p>'
    : '';

$htmlBody = '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>' . $e($heading) . ' - Kinésica</title>
</head>
<body style="margin:0;padding:20px;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e9f0;">
    <div style="padding:26px 20px 18px 20px;text-align:center;border-bottom:2px solid #005f99;">
      <img src="https://www.kinesica.com.ar/images/logo.png" alt="Kinésica" style="max-width:170px;height:auto;display:block;margin:0 auto;">
    </div>
    <div style="padding:28px 26px;color:#2c3e50;font-size:15px;line-height:1.6;">
      <h1 style="font-size:20px;font-weight:600;color:#1a252f;margin:0 0 10px 0;">' . $e($heading) . '</h1>
      <p style="color:#556575;margin:0 0 22px 0;">' . $lead . '</p>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #005f99;border-radius:6px;padding:12px 18px;margin-bottom:22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">' . $rowsHtml . '</table>
      </div>
      <div style="font-size:13px;font-weight:600;color:#005f99;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 8px 0;">' . $e($messageTitle) . '</div>
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px;color:#334155;font-size:15px;line-height:1.6;">' . $messageHtml . '</div>
      ' . $statementHtml . '
      ' . $buttonHtml . '
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#8a99a8;background-color:#f8fafc;border-top:1px solid #edf2f7;">
      <p style="margin:0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales &amp; Rehabilitación</p>
      <p style="margin:0;"><a href="https://www.kinesica.com.ar" style="color:#005f99;text-decoration:none;font-weight:500;">www.kinesica.com.ar</a></p>
    </div>
  </div>
</body>
</html>';

// --- Envío: Resend (si hay API key) y fallback mail() ---
$apiKey = trim((string) (
    getenv('RESEND_API_KEY')
    ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $localCfg['resend_api_key'] ?? '')
));

if ($apiKey !== '' && function_exists('curl_init')) {
    $resendFrom = (string) ($localCfg['resend_from'] ?? 'Kinésica <onboarding@resend.dev>');
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'from' => $resendFrom,
            'to' => [$to],
            'subject' => $subject,
            'html' => $htmlBody,
            'text' => $textBody,
            'reply_to' => $replyTo,
        ]),
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
        kinesica_contact_respond(200, ['success' => true]);
    }
    error_log('[send-contact] Resend falló (' . $httpCode . '): ' . ($curlError ?: substr((string) $response, 0, 300)));
}

$boundary = 'bnd_' . md5(uniqid((string) mt_rand(), true));
$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $mailFrom . '>',
    'Reply-To: ' . $replyTo,
    'X-Mailer: PHP/' . phpversion(),
]) . "\r\n";
$mailBody = "--{$boundary}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($textBody)) . "\r\n"
    . "--{$boundary}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($htmlBody)) . "\r\n"
    . "--{$boundary}--\r\n";
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = @mail($to, $encodedSubject, $mailBody, $headers, '-f ' . $mailFrom);
if (!$sent) {
    $sent = @mail($to, $encodedSubject, $mailBody, $headers);
}
if ($sent) {
    kinesica_contact_respond(200, ['success' => true]);
}

error_log('[send-contact] mail() falló para tipo=' . $type);
kinesica_contact_respond(502, ['success' => false, 'error' => 'No se pudo enviar el mensaje.']);
