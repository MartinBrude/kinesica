<?php
/**
 * Kinésica - Plantillas HTML y formateo de fecha/hora para mails de confirmación/anulación.
 */

/** Bloque "Información importante para tu sesión": notas del admin o la lista actual como fallback. */
function kinesica_guidelines_html(string $confirmationNotes, string $indicacionPuntualidad, string $indicacionAcompaniante, bool $esMenor): string
{
    if (trim($confirmationNotes) !== '') {
        $html = '<div class="guidelines-notes" style="color:#475569;font-size:14px;line-height:1.55;">' . kinesica_text_to_html($confirmationNotes) . '</div>';
        if ($esMenor) {
            $html .= '<ul class="guidelines-list" style="margin-top:10px;">'
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
        $mesNom = $meses[(int) $m[2]] ?? '';
        return "{$diaSemana} " . ((int) $m[3]) . " de {$mesNom} de {$m[1]}";
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

function kinesica_mail_document_shell(string $title, string $extraCss, string $contentHtml): string
{
    return '
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>' . $title . '</title>
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
    ' . $extraCss . '
    .footer { text-align: center; padding: 22px; font-size: 12px; color: #8a99a8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
    .footer a { color: #005f99; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://www.kinesica.com.ar/images/logo.png" alt="Kinésica" class="logo">
    </div>
    <div class="content">' . $contentHtml . '
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales & Rehabilitación</p>
      <p style="margin: 0;"><a href="https://www.kinesica.com.ar" target="_blank">www.kinesica.com.ar</a></p>
    </div>
  </div>
</body>
</html>';
}

/**
 * Arma subject + HTML del mail de confirmación o anulación.
 *
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
    $direccion = trim((string) ($params['direccion'] ?? 'Charcas 3889, Piso 5º B, Palermo'));
    $esMenor = !empty($params['esMenor']);
    $esCancelacion = !empty($params['esCancelacion']);
    $manageCode = strtoupper(trim((string) ($params['manageCode'] ?? '')));
    $manageUrl = trim((string) ($params['manageUrl'] ?? 'https://www.kinesica.com.ar/mi-turno.html'));

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
    // No mostrar el genérico "(Terapias Manuales)"; sí técnicas específicas (ATM, RPG, …).
    $servicioTexto = ($servicio !== '' && strcasecmp($servicio, 'Terapias Manuales') !== 0)
        ? ' (' . $servicio . ')'
        : '';

    $detailsCard = '
      <div class="card-details">
        <div class="detail-item"><strong>Fecha:</strong> ' . htmlspecialchars($fechaLegible) . '</div>
        <div class="detail-item"><strong>Horario:</strong> ' . htmlspecialchars($horaLegible) . '</div>
        <div class="detail-item"><strong>Atención:</strong> ' . htmlspecialchars($profesional . $servicioTexto) . '</div>
        <div class="detail-item"><strong>Dirección:</strong> ' . htmlspecialchars($direccion) . '</div>
      </div>';

    if ($esCancelacion) {
        $paciente = trim(kinesica_text_to_plain($paciente));
        $lateCancelNotice = trim((string) ($params['lateCancelNotice'] ?? ''));
        $lateCancelHtml = $lateCancelNotice !== ''
            ? '<p style="font-size: 14px; color: #334155; margin-top: 18px; line-height: 1.5;">'
                . htmlspecialchars($lateCancelNotice) . '</p>'
            : '';
        $subject = 'Anulación de turno - ' . $fechaLegible . ($horaLegible !== '' ? ' (' . $horaLegible . ')' : '');
        $body = '
      <h1 class="greeting">Turno anulado</h1>
      <p class="lead-text">Hola <strong>' . htmlspecialchars($paciente) . '</strong>, anulamos tu turno en Kinésica.</p>' . $detailsCard . $lateCancelHtml . '
      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        Si querés otro horario, podés reservarlo en <a href="https://www.kinesica.com.ar/agendar" style="color:#005f99;">kinesica.com.ar/agendar</a> o escribirnos por WhatsApp.
      </p>
      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        ' . kinesica_text_to_html($customCancellationPolicy) . '
      </p>';
        $html = kinesica_mail_document_shell('Anulación de Turno - Kinésica', '', $body);
    } else {
        $indicacionPuntualidad = 'Por las características del espacio y para respetar las sesiones en curso, <strong>te pedimos llegar puntual a la hora de tu turno, ni antes ni después</strong>.';
        $indicacionAcompaniante = $esMenor
            ? 'El menor debe ingresar acompañado por un adulto responsable.'
            : 'Por razones de espacio y concentración durante el tratamiento, <strong>asistir sin acompañantes</strong> (salvo necesidad de asistencia).';
        $subject = 'Confirmación de turno - ' . $fechaLegible . ($horaLegible !== '' ? ' (' . $horaLegible . ')' : '');
        $manageHtml = $manageCode !== '' ? '
      <div class="card-details" style="border-left-color:#0f766e;">
        <div class="detail-item"><strong>Código de gestión:</strong> <span style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.08em;font-size:18px;font-weight:700;color:#0f766e;">' . htmlspecialchars($manageCode) . '</span></div>
        <p style="margin:10px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
          Podés consultar o anular el turno con un clic (los datos ya vienen cargados):
          <a href="' . htmlspecialchars($manageUrl) . '" style="color:#005f99;font-weight:600;">Consultar o anular tu turno</a>.
          También podés hacerlo en <a href="https://www.kinesica.com.ar/mi-turno" style="color:#005f99;">kinesica.com.ar/mi-turno</a>
          con tu apellido, este email y el código (aviso con 24&nbsp;hs de anticipación).
        </p>
      </div>' : '';
        $extraCss = '.card-guidelines { background-color: #fafbfc; border: 1px solid #e9ecef; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px; }
    .guidelines-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #005f99; margin: 0 0 12px 0; }
    .guidelines-list { margin: 0; padding-left: 18px; color: #475569; }
    .guidelines-list li { margin-bottom: 9px; font-size: 14px; line-height: 1.5; }';
        $body = '
      <h1 class="greeting">Turno confirmado</h1>
      <p class="lead-text">Hola <strong>' . htmlspecialchars($paciente) . '</strong>, registramos tu reserva con los siguientes datos:</p>' . $detailsCard . $manageHtml . '
      <div class="card-guidelines">
        <div class="guidelines-title">Información importante para tu sesión</div>
        ' . kinesica_guidelines_html((string) $mailTexts['confirmation_notes'], $indicacionPuntualidad, $indicacionAcompaniante, $esMenor) . '
      </div>
      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        ' . kinesica_text_to_html($customCancellationPolicy) . '
      </p>';
        $html = kinesica_mail_document_shell('Confirmación de Turno - Kinésica', $extraCss, $body);
    }

    return [
        'subject' => $subject,
        'html' => $html,
        'fechaLegible' => $fechaLegible,
        'horaLegible' => $horaLegible,
    ];
}
