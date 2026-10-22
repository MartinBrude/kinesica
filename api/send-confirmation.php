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

// Validaciones básicas
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email no provisto o con formato inválido.']);
    exit;
}

if (empty($paciente)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nombre del paciente es requerido.']);
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

        // Limpieza y normalización de teléfono
        $digits = preg_replace('/[^0-9]/', '', $rawPhone) ?? '';
        if (str_starts_with($digits, '549') && strlen($digits) >= 12) {
            $phone = substr($digits, 0, 13);
        } elseif (str_starts_with($digits, '54') && !str_starts_with($digits, '549') && strlen($digits) >= 12) {
            $phone = '549' . substr($digits, 2, 10);
        } elseif (str_starts_with($digits, '0')) {
            $phone = '549' . substr($digits, 1);
        } elseif (str_starts_with($digits, '15') && strlen($digits) === 10) {
            $phone = '54911' . substr($digits, 2);
        } elseif (str_starts_with($digits, '11') && strlen($digits) === 10) {
            $phone = '549' . $digits;
        } elseif (!str_starts_with($digits, '549') && strlen($digits) === 10) {
            $phone = '549' . $digits;
        } else {
            $phone = $digits;
        }

        if (strlen($phone) >= 8) {
            $fullName = trim($paciente);
            $parts = preg_split('/\s+/u', $fullName, 2, PREG_SPLIT_NO_EMPTY) ?: [];
            $nom = $parts[0] ?? $fullName;
            $ape = $parts[1] ?? '';
            $pila = $nom;
            $dniVal = !empty($data['dni']) && trim((string) $data['dni']) !== 'No provisto' ? trim((string) $data['dni']) : null;
            $motivoVal = !empty($data['motivo']) ? trim((string) $data['motivo']) : (!empty($servicio) ? $servicio : null);

            $profVal = 'indistinto';
            if (stripos($profesional, 'Norberto') !== false) {
                $profVal = 'norberto';
            } elseif (stripos($profesional, 'Mar') !== false) {
                $profVal = 'maria';
            }

            $contactoNombre = !empty($data['contactoNombre']) ? trim((string) $data['contactoNombre']) : (!empty($data['contacto_nombre']) ? trim((string) $data['contacto_nombre']) : null);
            $contactoTelRaw = !empty($data['contactoTelefono']) ? (string) $data['contactoTelefono'] : (!empty($data['contacto_telefono']) ? (string) $data['contacto_telefono'] : '');
            $contactoTel = $contactoTelRaw !== '' ? preg_replace('/[^0-9]/', '', $contactoTelRaw) : null;
            if ($contactoTel && str_starts_with($contactoTel, '549') && strlen($contactoTel) >= 12) {
                $contactoTel = substr($contactoTel, 0, 13);
            } elseif ($contactoTel && str_starts_with($contactoTel, '11') && strlen($contactoTel) === 10) {
                $contactoTel = '549' . $contactoTel;
            }
            $contactoNotas = !empty($data['contactoNotas']) ? trim((string) $data['contactoNotas']) : (!empty($data['contacto_notas']) ? trim((string) $data['contacto_notas']) : null);

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
                    email = COALESCE(VALUES(email), email),
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

// Formatear fecha a castellano si viene en formato YYYY-MM-DD
function formatearFechaLegible($dateStr) {
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr, $m)) {
        $dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        $meses = [
            1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
            5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
            9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre'
        ];
        $ts = mktime(12, 0, 0, (int)$m[2], (int)$m[3], (int)$m[1]);
        $diaSemana = $dias[(int)date('w', $ts)];
        $diaNum = (int)$m[3];
        $mesNom = $meses[(int)$m[2]] ?? '';
        $anio = $m[1];
        return "{$diaSemana} {$diaNum} de {$mesNom} de {$anio}";
    }
    return $dateStr;
}

$fechaLegible = formatearFechaLegible($fechaRaw);
$horaLegible = $horaRaw ? (strpos($horaRaw, 'hs') === false ? "{$horaRaw} hs" : $horaRaw) : '';

// Textos del admin (settings.json = lo que sirve admin/api/settings.php), con fallback a los actuales.
$runtimeSettings = kinesica_read_settings(kinesica_admin_settings_file(__DIR__));
$mailTexts = kinesica_mail_texts($runtimeSettings);
$customCancellationPolicy = $mailTexts['cancellation_policy'];
$practitionerIdRaw = trim((string) ($data['practitionerId'] ?? $data['practitioner_id'] ?? ''));

$indicacionPuntualidad = $esMenor
    ? 'Al tratarse de un paciente menor de edad, recomendamos presentarse 5 a 10 minutos antes junto a un adulto responsable.'
    : 'Por las características del espacio y para respetar las sesiones en curso, <strong>te pedimos llegar puntual a la hora de tu turno, ni antes ni después</strong>.';

$indicacionAcompaniante = $esMenor
    ? 'El menor debe ingresar acompañado por un adulto responsable.'
    : 'Por razones de espacio y concentración durante el tratamiento, <strong>asistir sin acompañantes</strong> (salvo necesidad de asistencia).';

$servicioTexto = $servicio ? ' (' . $servicio . ')' : '';

if ($esCancelacion) {
    $subject = 'Anulación de turno - ' . $fechaLegible . ($horaLegible ? ' (' . $horaLegible . ')' : '');
    $htmlContent = '
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anulación de Turno - Kinésica</title>
  <style>
    body { margin: 0; padding: 20px; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e9f0; }
    .header { padding: 30px 20px 20px 20px; text-align: center; border-bottom: 2px solid #005f99; }
    .logo { max-width: 180px; height: auto; display: block; margin: 0 auto; }
    .content { padding: 30px 26px; color: #2c3e50; font-size: 15px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 600; color: #1a252f; margin: 0 0 12px 0; }
    .lead-text { color: #556575; margin-bottom: 22px; }
    .card-details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #005f99; border-radius: 6px; padding: 16px 18px; margin-bottom: 24px; }
    .detail-item { margin: 6px 0; font-size: 15px; color: #334155; }
    .detail-item strong { min-width: 100px; display: inline-block; color: #005f99; }
    .footer { text-align: center; padding: 22px; font-size: 12px; color: #8a99a8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
    .footer a { color: #005f99; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://www.kinesica.com.ar/images/logo.png" alt="Kinésica" class="logo">
    </div>
    <div class="content">
      <h1 class="greeting">Turno anulado</h1>
      <p class="lead-text">Hola <strong>' . htmlspecialchars($paciente) . '</strong>, anulamos tu turno en Kinésica.</p>
      <div class="card-details">
        <div class="detail-item"><strong>Fecha:</strong> ' . htmlspecialchars($fechaLegible) . '</div>
        <div class="detail-item"><strong>Horario:</strong> ' . htmlspecialchars($horaLegible) . '</div>
        <div class="detail-item"><strong>Atención:</strong> ' . htmlspecialchars($profesional . $servicioTexto) . '</div>
        <div class="detail-item"><strong>Dirección:</strong> ' . htmlspecialchars($direccion) . '</div>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        Si querés otro horario, podés reservarlo en <a href="https://www.kinesica.com.ar/agendar" style="color:#005f99;">kinesica.com.ar/agendar</a> o escribirnos por WhatsApp.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales & Rehabilitación</p>
      <p style="margin: 0;"><a href="https://www.kinesica.com.ar" target="_blank">www.kinesica.com.ar</a></p>
    </div>
  </div>
</body>
</html>';
} else {
    $subject = 'Confirmación de turno - ' . $fechaLegible . ($horaLegible ? ' (' . $horaLegible . ')' : '');

// Plantilla HTML con diseño Kinésica
$htmlContent = '
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Turno - Kinésica</title>
  <style>
    body { margin: 0; padding: 20px; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e9f0; }
    .header { padding: 30px 20px 20px 20px; text-align: center; border-bottom: 2px solid #005f99; }
    .logo { max-width: 180px; height: auto; display: block; margin: 0 auto; }
    .content { padding: 30px 26px; color: #2c3e50; font-size: 15px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 600; color: #1a252f; margin: 0 0 12px 0; }
    .lead-text { color: #556575; margin-bottom: 22px; }
    .card-details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #005f99; border-radius: 6px; padding: 16px 18px; margin-bottom: 24px; }
    .detail-item { margin: 6px 0; font-size: 15px; color: #334155; }
    .detail-item strong { min-width: 100px; display: inline-block; color: #005f99; }
    .card-guidelines { background-color: #fafbfc; border: 1px solid #e9ecef; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px; }
    .guidelines-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #005f99; margin: 0 0 12px 0; }
    .guidelines-list { margin: 0; padding-left: 18px; color: #475569; }
    .guidelines-list li { margin-bottom: 9px; font-size: 14px; line-height: 1.5; }
    .footer { text-align: center; padding: 22px; font-size: 12px; color: #8a99a8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
    .footer a { color: #005f99; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://www.kinesica.com.ar/images/logo.png" alt="Kinésica" class="logo">
    </div>
    <div class="content">
      <h1 class="greeting">Turno confirmado</h1>
      <p class="lead-text">Hola <strong>' . htmlspecialchars($paciente) . '</strong>, registramos tu reserva con los siguientes datos:</p>

      <div class="card-details">
        <div class="detail-item"><strong>Fecha:</strong> ' . htmlspecialchars($fechaLegible) . '</div>
        <div class="detail-item"><strong>Horario:</strong> ' . htmlspecialchars($horaLegible) . '</div>
        <div class="detail-item"><strong>Atención:</strong> ' . htmlspecialchars($profesional . $servicioTexto) . '</div>
        <div class="detail-item"><strong>Dirección:</strong> ' . htmlspecialchars($direccion) . '</div>
      </div>

      <div class="card-guidelines">
        <div class="guidelines-title">Información importante para tu sesión</div>
        ' . kinesica_guidelines_html($mailTexts['confirmation_notes'], $indicacionPuntualidad, $indicacionAcompaniante, $esMenor) . '
      </div>

      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        ' . kinesica_text_to_html($customCancellationPolicy) . '
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales & Rehabilitación</p>
      <p style="margin: 0;"><a href="https://www.kinesica.com.ar" target="_blank">www.kinesica.com.ar</a></p>
    </div>
  </div>
</body>
</html>';
}

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

if (!isset($subject)) {
    $subject = 'Confirmación de turno - ' . $fechaLegible . ($horaLegible ? ' (' . $horaLegible . ')' : '');
}
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

