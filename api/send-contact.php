<?php
/**
 * Kinésica - Endpoint de formularios de contacto (Red Profesional, Privacidad y Encuesta).
 * URL: /api/send-contact.php
 *
 * El destinatario es siempre norberto1712@gmail.com (salvo 'contact_to' en config)
 * y nunca se toma del request.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/send-contact-lib.php';

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

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    kinesica_contact_respond(405, ['success' => false, 'error' => 'Método no permitido. Utilizar POST.']);
}

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
if (!in_array($type, ['profesional', 'privacidad', 'encuesta'], true)) {
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

$experiencia = (int) ($data['experiencia'] ?? 0);
$tratamientoResultado = kinesica_contact_line($data['tratamiento_resultado'] ?? '', 40);
$recomendaria = kinesica_contact_line($data['recomendaria'] ?? '', 20);
$comentarios = kinesica_contact_text($data['comentarios'] ?? ($data['message'] ?? ''), 4000);
$tratamientoEs = '';
$recomendariaEs = '';
$encuestaSaved = false;

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');

if ($type === 'encuesta') {
    $allowedTratamientos = [
        'excelente' => 'Muy bien, noto una gran mejoría',
        'bien' => 'Bien, siento avances progresivos',
        'reciente' => 'Recién empiezo, aún es pronto para evaluar',
        'poco' => 'Por ahora siento pocos cambios',
        'sin_cambios' => 'Todavía no noto mejoría',
    ];
    $allowedRecomendaria = [
        'si' => 'Sí, totalmente',
        'tal_vez' => 'Tal vez',
        'no' => 'Por ahora no',
    ];
    if ($experiencia < 1 || $experiencia > 5
        || !isset($allowedTratamientos[$tratamientoResultado])
        || !isset($allowedRecomendaria[$recomendaria])) {
        kinesica_contact_respond(400, ['success' => false, 'error' => 'Por favor completá las preguntas de la encuesta.']);
    }
    if (!kinesica_contact_rate_ok('encuesta_ip:' . $clientIp, 10, 3600)) {
        kinesica_contact_respond(429, ['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
    }

    $tratamientoEs = $allowedTratamientos[$tratamientoResultado];
    $recomendariaEs = $allowedRecomendaria[$recomendaria];

    $encuestasIoPath = __DIR__ . '/../admin/api/encuestas_io.php';
    if (is_file($encuestasIoPath)) {
        require_once $encuestasIoPath;
        try {
            try {
                $encId = 'enc_' . bin2hex(random_bytes(6));
            } catch (Throwable $e) {
                $encId = 'enc_' . uniqid('', true);
            }
            $nuevaEncuesta = [
                'id' => $encId,
                'experiencia' => $experiencia,
                'tratamiento_resultado' => $tratamientoResultado,
                'tratamiento_label' => $tratamientoEs,
                'recomendaria' => $recomendaria,
                'recomendaria_label' => $recomendariaEs,
                'comentarios' => $comentarios,
                'lang' => $lang,
                'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ];
            if (function_exists('kinesica_encuestas_append')) {
                kinesica_encuestas_append($nuevaEncuesta);
            } else {
                $lista = kinesica_encuestas_load();
                array_unshift($lista, $nuevaEncuesta);
                kinesica_encuestas_save($lista);
            }
            $encuestaSaved = true;
        } catch (Throwable $e) {
            error_log('[send-contact] No se pudo guardar encuesta en disco: ' . $e->getMessage());
        }
    }
} else {
    if ($name === '' || ($email === '' && $phone === '')) {
        kinesica_contact_respond(400, ['success' => false, 'error' => 'Nombre y un correo o teléfono son requeridos.']);
    }
    if ($email !== '' && !kinesica_contact_valid_email($email)) {
        kinesica_contact_respond(400, ['success' => false, 'error' => 'Correo electrónico con formato inválido.']);
    }
    if (!kinesica_contact_rate_ok('ip:' . $clientIp, 6, 3600)
        || ($email !== '' && !kinesica_contact_rate_ok('email:' . strtolower($email), 4, 3600))) {
        kinesica_contact_respond(429, ['success' => false, 'error' => 'Demasiados envíos. Probá de nuevo más tarde.']);
    }
}

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

$to = trim((string) ($localCfg['contact_to'] ?? 'norberto1712@gmail.com'));
if (!kinesica_contact_valid_email($to)) {
    $to = 'norberto1712@gmail.com';
}
$mailFrom = trim((string) ($localCfg['mail_from'] ?? 'no-reply@kinesica.com.ar'));
if (!kinesica_contact_valid_email($mailFrom)) {
    $mailFrom = 'no-reply@kinesica.com.ar';
}
$replyTo = kinesica_contact_valid_email($email) ? $email : $mailFrom;

$mail = kinesica_contact_build_mail([
    'type' => $type, 'lang' => $lang, 'name' => $name, 'email' => $email, 'phone' => $phone,
    'specialty' => $specialty, 'motive' => $motive, 'scope' => $scope, 'message' => $message,
    'statement' => $statement, 'experiencia' => $experiencia, 'tratamientoEs' => $tratamientoEs,
    'recomendariaEs' => $recomendariaEs, 'comentarios' => $comentarios,
]);

$sent = kinesica_contact_deliver_mail($mail, $to, $mailFrom, $replyTo, $localCfg);
if ($sent || ($type === 'encuesta' && $encuestaSaved)) {
    kinesica_contact_respond(200, ['success' => true]);
}

error_log('[send-contact] mail() falló para tipo=' . $type);
kinesica_contact_respond(502, ['success' => false, 'error' => 'No se pudo enviar el mensaje.']);
