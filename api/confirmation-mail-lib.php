<?php
/**
 * Kinésica - Helpers del mail de confirmación/anulación de la turnera (api/send-confirmation.php).
 *
 * Textos: se leen del admin (admin/api/settings.json, el mismo archivo que sirve admin/api/settings.php):
 *   clara_texts.cancellation_policy  → "Política de cancelación"
 *   clara_texts.confirmation_notes   → "Notas de confirmación"
 * Si el campo está vacío o el archivo no se puede leer, se usan los textos actuales (fallback).
 */

const KINESICA_DEFAULT_CANCELLATION_POLICY = 'Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.';

/** Reply-To por profesional (fallback). Orden: settings.json → practitioner_emails, admin/api/mail.php → reply_to_<id> / user_emails, esta constante. */
const KINESICA_PRACTITIONER_EMAILS = [
    'norberto' => 'norberto1712@gmail.com',
    'maria' => 'manosmagicas7116@gmail.com',
];

/** Configuración del admin: datos vivos (admin/api/data/settings.json) o, si aún no existen, la semilla versionada. */
function kinesica_admin_settings_file(string $apiDir): string
{
    $runtime = $apiDir . '/../admin/api/data/settings.json';
    return is_file($runtime) ? $runtime : $apiDir . '/../admin/api/settings.json';
}

function kinesica_read_settings(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Devuelve ['cancellation_policy' => string|'', 'confirmation_notes' => string|''].
 * confirmation_notes vacío ⇒ el mail usa la lista de indicaciones actual (fallback).
 */
function kinesica_mail_texts(array $settings): array
{
    $texts = isset($settings['clara_texts']) && is_array($settings['clara_texts']) ? $settings['clara_texts'] : [];
    $policy = trim((string) ($texts['cancellation_policy'] ?? ''));
    $notes = trim((string) ($texts['confirmation_notes'] ?? ''));
    return [
        'cancellation_policy' => $policy !== '' ? $policy : KINESICA_DEFAULT_CANCELLATION_POLICY,
        'confirmation_notes' => $notes,
    ];
}

/**
 * Formato estilo WhatsApp de los textos del admin.
 * Pares *x* → negrita y _x_ → cursiva sólo en límites de palabra (no toca foo_bar@x.com ni URLs);
 * "* " / "- " al inicio de línea → "• "; marcadores sueltos se eliminan.
 * Devuelve el texto con marcas internas \x01b…\x02 / \x01i…\x02 y los emails/URLs protegidos.
 */
function kinesica_wa_markup(string $text, array &$protected): string
{
    $text = str_replace(["\r\n", "\r"], "\n", trim($text));
    $protected = [];
    // Emails y URLs: se protegen tal cual.
    $text = preg_replace_callback('~\b(?:https?://|www\.)[^\s<>"]+|[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}.\-]+\.[\p{L}]{2,}~u', function ($m) use (&$protected) {
        $protected[] = $m[0];
        return "\x03" . (count($protected) - 1) . "\x03";
    }, $text) ?? $text;
    // Viñetas al inicio de línea.
    $text = preg_replace('/^[ \t]*[*\-•][ \t]+/mu', '• ', $text) ?? $text;
    // Pares en límite de palabra, contenido sin espacios en los bordes y en una sola línea.
    $text = preg_replace('/(?<![\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/u', "\x01b$1\x02", $text) ?? $text;
    $text = preg_replace('/(?<![\p{L}\p{N}_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/u', "\x01i$1\x02", $text) ?? $text;
    // Marcadores sueltos: todo * restante; _ salvo entre letras/números (snake_case).
    $text = str_replace('*', '', $text);
    $text = preg_replace('/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/u', '', $text) ?? $text;
    $text = preg_replace('/[ \t]{2,}/', ' ', $text) ?? $text;
    return trim(preg_replace('/[ \t]+$/m', '', $text) ?? $text);
}

function kinesica_restore_protected(string $text, array $protected, bool $html): string
{
    return preg_replace_callback('/\x03(\d+)\x03/', function ($m) use ($protected, $html) {
        $v = $protected[(int) $m[1]] ?? '';
        return $html ? htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : $v;
    }, $text) ?? $text;
}

/** Texto del admin → HTML seguro: escapa todo, *x*→<strong>, _x_→<em>, respeta saltos de línea. */
function kinesica_text_to_html(string $text): string
{
    $protected = [];
    $marked = kinesica_wa_markup($text, $protected);
    $html = htmlspecialchars($marked, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = preg_replace_callback('/\x01([bi])(.*?)\x02/s', fn ($m) => $m[1] === 'b' ? "<strong>{$m[2]}</strong>" : "<em>{$m[2]}</em>", $html) ?? $html;
    $html = str_replace(["\x01", "\x02"], '', $html);
    return nl2br(kinesica_restore_protected($html, $protected, true), false);
}

/** Texto del admin → texto plano: sin marcadores de WhatsApp. */
function kinesica_text_to_plain(string $text): string
{
    $protected = [];
    $marked = preg_replace('/\x01[bi]/', '', kinesica_wa_markup($text, $protected)) ?? '';
    return kinesica_restore_protected(str_replace(["\x01", "\x02"], '', $marked), $protected, false);
}

/** 'norberto' | 'maria' | null a partir de un id o un nombre ("Lic. María Gulin"). Palabra completa. */
function kinesica_practitioner_id(?string $idOrName): ?string
{
    $v = (string) $idOrName;
    if (function_exists('iconv')) {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT', $v);
        if ($t !== false) {
            // macOS iconv suele emitir Mar'ia; limpiamos diacríticos residuales.
            $v = str_replace(["'", '`', '^', '"', '~'], '', $t);
        }
    }
    $v = strtolower($v);
    $v = preg_replace("/[^a-z0-9]+/", ' ', $v) ?? '';
    if (preg_match('/(^| )maria( |$)/', $v)) {
        return 'maria';
    }
    if (preg_match('/(^| )norberto( |$)/', $v)) {
        return 'norberto';
    }
    return null;
}

/** Email de Reply-To del profesional del turno (Norberto si no se puede determinar). */
function kinesica_reply_to_email(?string $practitionerId, ?string $profesionalName, array $settings = [], array $cfg = []): string
{
    $id = kinesica_practitioner_id($practitionerId) ?? kinesica_practitioner_id($profesionalName) ?? 'norberto';
    $map = KINESICA_PRACTITIONER_EMAILS;
    if (isset($settings['practitioner_emails']) && is_array($settings['practitioner_emails'])) {
        foreach ($settings['practitioner_emails'] as $k => $email) {
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $map[strtolower((string) $k)] = (string) $email;
            }
        }
    }
    if (isset($settings['practitioner_emails'][$id]) && filter_var($settings['practitioner_emails'][$id], FILTER_VALIDATE_EMAIL)) {
        return (string) $settings['practitioner_emails'][$id];
    }
    // Config del admin (admin/api/mail.php): reply_to_<id> o la cuenta del profesional en user_emails.
    foreach ([$cfg['reply_to_' . $id] ?? '', $cfg['user_emails'][$id] ?? ''] as $candidate) {
        if (filter_var((string) $candidate, FILTER_VALIDATE_EMAIL)) {
            return (string) $candidate;
        }
    }
    return $map[$id] ?? KINESICA_PRACTITIONER_EMAILS['norberto'];
}

/** Bloque "Información importante para tu sesión": notas del admin o la lista actual como fallback. */
function kinesica_guidelines_html(string $confirmationNotes, string $indicacionPuntualidad, string $indicacionAcompaniante, bool $esMenor): string
{
    if (trim($confirmationNotes) !== '') {
        $html = '<div class="guidelines-notes" style="color:#475569;font-size:14px;line-height:1.55;">' . kinesica_text_to_html($confirmationNotes) . '</div>';
        if ($esMenor) {
            $html .= '<ul class="guidelines-list" style="margin-top:10px;">'
                . '<li><strong>Puntualidad:</strong> ' . $indicacionPuntualidad . '</li>'
                . '<li><strong>Acompañantes:</strong> ' . $indicacionAcompaniante . '</li>'
                . '</ul>';
        }
        return $html;
    }
    return '<ul class="guidelines-list">'
        . '<li><strong>Puntualidad:</strong> ' . $indicacionPuntualidad . '</li>'
        . '<li><strong>Ropa adecuada:</strong> Concurrir con <em>ropa cómoda y flexible</em> (short o calza corta; si sos mujer, corpiño no deportivo) que permita evaluar la postura y la zona a tratar.</li>'
        . '<li><strong>Estudios previos:</strong> Traer estudios y derivación médica si los tuviese.</li>'
        . '<li><strong>Acompañantes:</strong> ' . $indicacionAcompaniante . '</li>'
        . '</ul>';
}

/** Fecha YYYY-MM-DD → "Lunes 10 de Noviembre de 2026"; si no matchea, se devuelve tal cual. */
function kinesica_format_fecha_legible(string $dateStr): string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr, $m)) {
        $dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        $meses = [
            1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
            5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
            9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
        ];
        $ts = mktime(12, 0, 0, (int) $m[2], (int) $m[3], (int) $m[1]);
        $diaSemana = $dias[(int) date('w', $ts)];
        $diaNum = (int) $m[3];
        $mesNom = $meses[(int) $m[2]] ?? '';
        $anio = $m[1];
        return "{$diaSemana} {$diaNum} de {$mesNom} de {$anio}";
    }
    return $dateStr;
}

/** "16:00" → "16:00 hs"; si ya incluye "hs", se deja igual. */
function kinesica_format_hora_legible(string $horaRaw): string
{
    $horaRaw = trim($horaRaw);
    if ($horaRaw === '') {
        return '';
    }
    return strpos($horaRaw, 'hs') === false ? "{$horaRaw} hs" : $horaRaw;
}

/**
 * Arma subject + HTML del mail de confirmación o anulación.
 *
 * @param array{
 *   paciente?: string,
 *   fecha?: string,
 *   hora?: string,
 *   profesional?: string,
 *   servicio?: string,
 *   direccion?: string,
 *   esMenor?: bool,
 *   esCancelacion?: bool,
 *   mailTexts?: array{cancellation_policy?: string, confirmation_notes?: string},
 *   settings?: array
 * } $params
 * @return array{subject: string, html: string, fechaLegible: string, horaLegible: string}
 */
function kinesica_build_confirmation_mail(array $params): array
{
    $paciente = trim((string) ($params['paciente'] ?? ''));
    $fechaRaw = trim((string) ($params['fecha'] ?? ''));
    $horaRaw = trim((string) ($params['hora'] ?? ''));
    $profesional = trim((string) ($params['profesional'] ?? 'Lic. Norberto Brude'));
    $servicio = trim((string) ($params['servicio'] ?? ''));
    if ($servicio === '' || preg_match('/osteopat[ií]a\s*(?:&|\/|y)?\s*(?:terapia[s]?\s*manual(?:es)?)?/i', $servicio) || $servicio === 'No especifica') {
        $servicio = 'Terapias Manuales';
    }
    $direccion = trim((string) ($params['direccion'] ?? 'Charcas 3889, Piso 5º B, Palermo (entre Scalabrini Ortiz y Aráoz)'));
    $esMenor = !empty($params['esMenor']);
    $esCancelacion = !empty($params['esCancelacion']);

    if (isset($params['mailTexts']) && is_array($params['mailTexts'])) {
        $mailTexts = $params['mailTexts'];
        if (empty($mailTexts['cancellation_policy'])) {
            $mailTexts['cancellation_policy'] = KINESICA_DEFAULT_CANCELLATION_POLICY;
        }
        if (!isset($mailTexts['confirmation_notes'])) {
            $mailTexts['confirmation_notes'] = '';
        }
    } else {
        $settings = isset($params['settings']) && is_array($params['settings']) ? $params['settings'] : [];
        $mailTexts = kinesica_mail_texts($settings);
    }

    $fechaLegible = kinesica_format_fecha_legible($fechaRaw);
    $horaLegible = kinesica_format_hora_legible($horaRaw);
    $customCancellationPolicy = (string) $mailTexts['cancellation_policy'];
    $servicioTexto = $servicio !== '' ? ' (' . $servicio . ')' : '';

    $indicacionPuntualidad = $esMenor
        ? 'Al tratarse de un paciente menor de edad, recomendamos presentarse 5 a 10 minutos antes junto a un adulto responsable.'
        : 'Por las características del espacio y para respetar las sesiones en curso, <strong>te pedimos llegar puntual a la hora de tu turno, ni antes ni después</strong>.';

    $indicacionAcompaniante = $esMenor
        ? 'El menor debe ingresar acompañado por un adulto responsable.'
        : 'Por razones de espacio y concentración durante el tratamiento, <strong>asistir sin acompañantes</strong> (salvo necesidad de asistencia).';

    if ($esCancelacion) {
        $paciente = trim(kinesica_text_to_plain($paciente));
        $subject = 'Anulación de turno - ' . $fechaLegible . ($horaLegible !== '' ? ' (' . $horaLegible . ')' : '');
        $html = '
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
    } else {
        $subject = 'Confirmación de turno - ' . $fechaLegible . ($horaLegible !== '' ? ' (' . $horaLegible . ')' : '');
        $html = '
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
        ' . kinesica_guidelines_html((string) $mailTexts['confirmation_notes'], $indicacionPuntualidad, $indicacionAcompaniante, $esMenor) . '
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

    return [
        'subject' => $subject,
        'html' => $html,
        'fechaLegible' => $fechaLegible,
        'horaLegible' => $horaLegible,
    ];
}
