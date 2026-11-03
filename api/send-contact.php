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

if ($name === '' || ($email === '' && $phone === '')) {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Nombre y un correo o teléfono son requeridos.']);
}
if ($email !== '' && !kinesica_contact_valid_email($email)) {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Correo electrónico con formato inválido.']);
}
if ($message === '') {
    kinesica_contact_respond(400, ['success' => false, 'error' => 'Mensaje vacío.']);
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
$bodyLines = [
    $message,
    '',
    '--',
    'Formulario: ' . ($type === 'profesional' ? 'Red Profesional' : 'Privacidad (eliminación de datos)') . ' · idioma: ' . $lang,
    'Responder a: ' . ($email !== '' ? $email : ($phone !== '' ? $phone : 'sin datos')),
    'Recibido: ' . (new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('d/m/Y H:i') . ' (hora de Buenos Aires)',
];
$textBody = implode("\n", $bodyLines);

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

$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $mailFrom . '>',
    'Reply-To: ' . $replyTo,
    'X-Mailer: PHP/' . phpversion(),
]) . "\r\n";
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = @mail($to, $encodedSubject, $textBody, $headers, '-f ' . $mailFrom);
if (!$sent) {
    $sent = @mail($to, $encodedSubject, $textBody, $headers);
}
if ($sent) {
    kinesica_contact_respond(200, ['success' => true]);
}

error_log('[send-contact] mail() falló para tipo=' . $type);
kinesica_contact_respond(502, ['success' => false, 'error' => 'No se pudo enviar el mensaje.']);
