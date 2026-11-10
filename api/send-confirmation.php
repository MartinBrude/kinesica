<?php
/**
 * Kinésica - Endpoint de confirmación de turno vía Resend
 * URL: /api/send-confirmation.php
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/confirmation-mail-lib.php';

// Configuración CORS
$allowedOrigins = [
    'https://www.kinesica.com.ar',
    'https://kinesica.com.ar',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Utilizar POST.']);
    exit;
}

// Leer cuerpo JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    // Si vino por form-data convencional
    $data = $_POST;
}

$email = trim($data['email'] ?? '');
$paciente = trim($data['paciente'] ?? $data['nombre'] ?? '');
$fechaRaw = trim($data['fecha'] ?? $data['date'] ?? '');
$horaRaw = trim($data['hora'] ?? $data['time'] ?? '');
$profesional = trim($data['profesional'] ?? 'Lic. Norberto Brude');
$servicio = trim($data['servicio'] ?? $data['especialidad'] ?? '');
if (empty($servicio) || preg_match('/osteopat[ií]a\s*(?:&|\/|y)?\s*(?:terapia[s]?\s*manual(?:es)?)?/i', $servicio) || $servicio === 'No especifica') {
    $servicio = 'Terapias Manuales';
}
$direccion = trim($data['direccion'] ?? 'Charcas 3889, Piso 5º B, Palermo (entre Scalabrini Ortiz y Aráoz)');
$esMenor = !empty($data['esMenor']) || !empty($data['isMenor']);
$tipo = strtolower(trim($data['tipo'] ?? 'confirmacion'));
$esCancelacion = in_array($tipo, ['cancelacion', 'cancelación', 'anulacion', 'anulación'], true);

// Validaciones estrictas en la frontera
$isValidEmail = static function (string $raw): bool {
    $s = trim($raw);
    if ($s === '' || strlen($s) > 120 || preg_match('/\s/', $s)) {
        return false;
    }
    if (!filter_var($s, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $parts = explode('@', $s);
    if (count($parts) !== 2) {
        return false;
    }
    $labels = explode('.', $parts[1]);
    $tld = end($labels);
    return count($labels) >= 2 && is_string($tld) && (bool) preg_match('/^[A-Za-z]{2,24}$/', $tld);
};

if (!$isValidEmail($email)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email no provisto o con formato inválido.']);
    exit;
}

if (empty($paciente)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nombre del paciente es requerido.']);
    exit;
}

// Límite de envíos: evita usar el endpoint para mandar mails a terceros en masa
function kinesica_confirmation_rate_ok(string $key, int $max, int $windowSec): bool
{
    try {
        $dir = rtrim(sys_get_temp_dir(), '/') . '/kinesica_conf_rl';
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

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!kinesica_confirmation_rate_ok('email:' . strtolower($email), 4, 3600)
    || !kinesica_confirmation_rate_ok('ip:' . $clientIp, 20, 3600)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
    exit;
}

// Auto-registro/actualización en el Directorio de Pacientes (MySQL)
$rawPhone = trim((string) ($data['telefono'] ?? ''));
if ($rawPhone !== '') {
    try {
        require_once __DIR__ . '/../admin/api/lib.php';
        $db = db();
        
        // Auto-migración en caso de que la columna email aún no exista
        $cols = $db->query("SHOW COLUMNS FROM pacientes")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('email', $cols, true)) {
            $db->exec("ALTER TABLE pacientes ADD email VARCHAR(120) DEFAULT NULL AFTER dni");
            $db->exec("ALTER TABLE pacientes ADD INDEX idx_pacientes_email (email)");
        }

        @require_once dirname(__DIR__) . '/admin/api/pacientes_helpers.php';
        // Fuente de verdad: clean_phone_number (AR → 549…; extranjeros con CC se preservan).
        $phone = function_exists('clean_phone_number')
            ? clean_phone_number($rawPhone)
            : (preg_replace('/[^0-9]/', '', $rawPhone) ?? '');

        if (strlen($phone) >= 6 && !preg_match('/^(\d)\1+$/', $phone)) {
            $fullName = mb_substr(sanitize_patient_name($paciente), 0, 120, 'UTF-8');
            $parts = preg_split('/\s+/u', $fullName, 2, PREG_SPLIT_NO_EMPTY) ?: [];
            $nom = mb_substr($parts[0] ?? $fullName, 0, 60, 'UTF-8');
            $ape = mb_substr($parts[1] ?? '', 0, 60, 'UTF-8');
            $pila = function_exists('extract_first_name') ? extract_first_name($fullName) : $nom;
            $dniVal = !empty($data['dni']) && trim((string) $data['dni']) !== 'No provisto' ? mb_substr(trim((string) $data['dni']), 0, 20, 'UTF-8') : null;
            $motivoVal = !empty($data['motivo']) ? mb_substr(trim((string) $data['motivo']), 0, 255, 'UTF-8') : (!empty($servicio) ? mb_substr($servicio, 0, 255, 'UTF-8') : null);

            $profVal = 'indistinto';
            if (stripos($profesional, 'Norberto') !== false) {
                $profVal = 'norberto';
            } elseif (stripos($profesional, 'Mar') !== false) {
                $profVal = 'maria';
            }

            $contactoNombre = !empty($data['contactoNombre']) ? mb_substr(sanitize_patient_name((string) $data['contactoNombre']), 0, 120, 'UTF-8') : (!empty($data['contacto_nombre']) ? mb_substr(sanitize_patient_name((string) $data['contacto_nombre']), 0, 120, 'UTF-8') : null);
            $contactoTelRaw = !empty($data['contactoTelefono']) ? (string) $data['contactoTelefono'] : (!empty($data['contacto_telefono']) ? (string) $data['contacto_telefono'] : '');
            $contactoTel = $contactoTelRaw !== '' ? $normalizePhone($contactoTelRaw) : null;
            if ($contactoTel === '') {
                $contactoTel = null;
            }
            $contactoNotas = !empty($data['contactoNotas']) ? mb_substr(trim((string) $data['contactoNotas']), 0, 100, 'UTF-8') : (!empty($data['contacto_notas']) ? mb_substr(trim((string) $data['contacto_notas']), 0, 100, 'UTF-8') : null);

            @require_once dirname(__DIR__) . '/admin/api/pacientes_helpers.php';
            if (function_exists('find_existing_patient_match')) {
                try {
                    $existing = find_existing_patient_match($db, $phone, $fullName, $dniVal);
                    if ($existing && function_exists('is_placeholder_phone') && is_placeholder_phone((string) ($existing['telefono'] ?? ''))) {
                        $db->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id')
                            ->execute(['tel' => $phone, 'id' => (int) $existing['id']]);
                    }
                } catch (Throwable) {}
            }

            $stmtUpsert = $db->prepare('
                INSERT INTO pacientes (
                    telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email, profesional_habitual, motivo_consulta, origen,
                    contacto_nombre, contacto_telefono, contacto_notas
                ) VALUES (
                    :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :email, :profesional, :motivo, "web",
                    :contacto_nombre, :contacto_telefono, :contacto_notas
                )
                ON DUPLICATE KEY UPDATE
                    nombre = CASE WHEN VALUES(nombre) != "" THEN VALUES(nombre) ELSE nombre END,
                    apellido = CASE WHEN VALUES(apellido) != "" THEN VALUES(apellido) ELSE apellido END,
                    nombre_completo = VALUES(nombre_completo),
                    nombre_pila = VALUES(nombre_pila),
                    dni = COALESCE(VALUES(dni), dni),
                    email = CASE WHEN email IS NULL OR email = "" THEN VALUES(email) ELSE email END,
                    profesional_habitual = CASE WHEN VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END,
                    motivo_consulta = COALESCE(VALUES(motivo_consulta), motivo_consulta),
                    contacto_nombre = COALESCE(VALUES(contacto_nombre), contacto_nombre),
                    contacto_telefono = COALESCE(VALUES(contacto_telefono), contacto_telefono),
                    contacto_notas = COALESCE(VALUES(contacto_notas), contacto_notas)
            ');

            $stmtUpsert->execute([
                'telefono' => $phone,
                'nombre' => $nom,
                'apellido' => $ape,
                'nombre_completo' => $fullName,
                'nombre_pila' => $pila,
                'dni' => $dniVal,
                'email' => $email,
                'profesional' => $profVal,
                'motivo' => $motivoVal,
                'contacto_nombre' => $contactoNombre,
                'contacto_telefono' => $contactoTel,
                'contacto_notas' => $contactoNotas,
            ]);
        }
    } catch (Throwable $e) {
        error_log('kinesica send-confirmation auto-paciente error: ' . $e->getMessage());
    }
}

// Textos del admin (settings.json = lo que sirve admin/api/settings.php), con fallback a los actuales.
$runtimeSettings = kinesica_read_settings(kinesica_admin_settings_file(__DIR__));
$practitionerIdRaw = trim((string) ($data['practitionerId'] ?? $data['practitioner_id'] ?? ''));

$builtMail = kinesica_build_confirmation_mail([
    'paciente' => $paciente,
    'fecha' => $fechaRaw,
    'hora' => $horaRaw,
    'profesional' => $profesional,
    'servicio' => $servicio,
    'direccion' => $direccion,
    'esMenor' => $esMenor,
    'esCancelacion' => $esCancelacion,
    'settings' => $runtimeSettings,
]);
$subject = $builtMail['subject'];
$htmlContent = $builtMail['html'];

// Cargar configuración local si existe (admin/api/config.php y admin/api/mail.php)
$localCfg = [];
$configFile = __DIR__ . '/../admin/api/config.php';
if (is_file($configFile)) {
    $loaded = @include $configFile;
    if (is_array($loaded)) {
        $localCfg = array_merge($localCfg, $loaded);
    }
}
$mailCfgFile = __DIR__ . '/../admin/api/mail.php';
if (is_file($mailCfgFile)) {
    $loadedMail = @include $mailCfgFile;
    if (is_array($loadedMail)) {
        $localCfg = array_merge($localCfg, $loadedMail);
    }
}

$apiKey = trim((string) (
    getenv('RESEND_API_KEY')
    ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $localCfg['resend_api_key'] ?? '')
));

$replyToEmail = kinesica_reply_to_email($practitionerIdRaw, $profesional, $runtimeSettings, $localCfg);

$resendError = null;

if ($apiKey !== '') {
    $resendFrom = (string) ($localCfg['resend_from'] ?? 'Kinésica <onboarding@resend.dev>');
    $payload = [
        'from'    => $resendFrom,
        'to'      => [$email],
        'subject' => $subject,
        'html'    => $htmlContent,
        'reply_to' => $replyToEmail
    ];

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
        $resData = json_decode((string) $response, true);
        echo json_encode(['success' => true, 'provider' => 'resend', 'data' => $resData]);
        exit;
    }

    $resendError = $curlError ?: json_decode((string) $response, true);
}

// Fallback nativo vía MTA del servidor (Hostinger mail() con no-reply@kinesica.com.ar)
$mailFrom = trim((string) ($localCfg['mail_from'] ?? 'no-reply@kinesica.com.ar'));
if ($mailFrom === '') {
    $mailFrom = 'no-reply@kinesica.com.ar';
}
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: =?UTF-8?B?' . base64_encode('Kinésica') . '?= <' . $mailFrom . '>',
    'Reply-To: Kinésica <' . $replyToEmail . '>',
    'X-Mailer: PHP/' . phpversion()
]) . "\r\n";

$sentViaMail = @mail($email, $encodedSubject, $htmlContent, $headers, '-f ' . $mailFrom);
if (!$sentViaMail) {
    $sentViaMail = @mail($email, $encodedSubject, $htmlContent, $headers);
}

if ($sentViaMail) {
    echo json_encode([
        'success' => true,
        'provider' => 'mail',
        'from' => $mailFrom
    ]);
    exit;
}

http_response_code(502);
echo json_encode([
    'success' => false,
    'error' => $resendError ?: 'No se pudo enviar el correo de confirmación.'
]);

