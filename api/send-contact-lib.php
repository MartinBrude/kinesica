<?php
/**
 * Helpers, plantilla de correo (texto + HTML) y envío para api/send-contact.php.
 */

function kinesica_contact_respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
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

/**
 * Construye subject, fromName, textBody y htmlBody según el tipo de formulario.
 *
 * @return array{subject:string,fromName:string,textBody:string,htmlBody:string}
 */
function kinesica_contact_build_mail(array $ctx): array
{
    $type = (string) $ctx['type'];
    $lang = (string) $ctx['lang'];
    $name = (string) $ctx['name'];
    $email = (string) $ctx['email'];
    $phone = (string) $ctx['phone'];
    $specialty = (string) $ctx['specialty'];
    $motive = (string) $ctx['motive'];
    $scope = (string) $ctx['scope'];
    $message = (string) $ctx['message'];
    $statement = (string) $ctx['statement'];
    $experiencia = (int) ($ctx['experiencia'] ?? 0);
    $tratamientoEs = (string) ($ctx['tratamientoEs'] ?? '');
    $recomendariaEs = (string) ($ctx['recomendariaEs'] ?? '');
    $comentarios = (string) ($ctx['comentarios'] ?? '');

    $receivedAt = (new DateTime('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('d/m/Y H:i');
    $langNames = ['es' => 'Español', 'en' => 'English', 'fr' => 'Français', 'pt' => 'Português'];

    if ($type === 'profesional') {
        $subject = '[Kinésica - Red Profesional] Contacto de: ' . $name . ($specialty !== '' ? ' (' . $specialty . ')' : '');
        $fromName = 'Kinésica Web (Red Profesional)';
        $heading = 'Nuevo contacto profesional';
        $lead = 'Un colega escribió desde la página de <strong>Red Profesional</strong> del sitio.';
        $rows = ['Nombre' => $name, 'Especialidad' => $specialty, 'Correo' => $email, 'Teléfono' => $phone, 'Motivo' => $motive];
        $messageTitle = 'Mensaje';
        $messageBody = $message;
    } elseif ($type === 'encuesta') {
        $starsStr = str_repeat('★', $experiencia) . str_repeat('☆', 5 - $experiencia);
        $ratingLabelsEs = [1 => 'Mala', 2 => 'Regular', 3 => 'Buena', 4 => 'Muy buena', 5 => 'Excelente'];
        $subject = '[Kinésica - Encuesta] Nueva respuesta anónima (' . $starsStr . ' ' . $experiencia . '/5 · Recomendaría: ' . $recomendariaEs . ')';
        $fromName = 'Kinésica Web (Encuesta de Satisfacción)';
        $heading = 'Nueva respuesta de encuesta anónima';
        $lead = 'Un paciente completó la <strong>Encuesta de Satisfacción Anónima</strong> en el sitio web.';
        $rows = [
            'Experiencia general' => $starsStr . ' (' . $experiencia . '/5 — ' . ($ratingLabelsEs[$experiencia] ?? '') . ')',
            'Resultado del tratamiento' => $tratamientoEs,
            '¿Nos recomendaría?' => $recomendariaEs,
            'Idioma' => $langNames[$lang] ?? $lang,
        ];
        $messageTitle = 'Comentarios / Sugerencias para mejorar';
        $messageBody = $comentarios;
    } else {
        $subject = '[Kinésica] Solicitud de eliminación de datos personales - ' . $name . ($lang !== 'es' ? ' [' . strtoupper($lang) . ']' : '');
        $fromName = 'Kinésica Web (Privacidad)';
        $heading = 'Solicitud de eliminación de datos';
        $lead = 'Se recibió una solicitud desde la página de <strong>Privacidad</strong> (Ley 25.326 / RGPD / LGPD). Plazo de respuesta: 5 días hábiles.';
        $rows = ['Nombre' => $name, 'Correo' => $email, 'Teléfono' => $phone, 'Alcance' => $scope, 'Idioma' => $langNames[$lang] ?? $lang];
        $messageTitle = 'Detalles adicionales';
        $messageBody = $message;
    }

    $rows['Recibido'] = $receivedAt . ' (hora de Buenos Aires)';
    $rows = array_filter($rows, static fn($v) => $v !== '' && $v !== 'No especificado' && $v !== 'No especificada');
    $emptyMessage = '(Sin mensaje adicional)';

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
    $textLines[] = $type === 'encuesta'
        ? 'Encuesta 100% anónima — también disponible en el Panel de Control (/admin/encuestas).'
        : ($email !== '' ? 'Para responder, contestá a este correo (Reply-To: ' . $email . ').' : 'Sin correo: contactar por teléfono.');
    $textBody = implode("\n", $textLines);

    $e = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $rowsHtml = '';
    foreach ($rows as $label => $value) {
        $valueHtml = $label === 'Correo'
            ? '<a href="mailto:' . $e($value) . '" style="color:#005f99;text-decoration:none;">' . $e($value) . '</a>'
            : $e($value);
        $rowsHtml .= '<tr><td style="padding:6px 14px 6px 0;color:#005f99;font-weight:600;font-size:14px;vertical-align:top;white-space:nowrap;">' . $e($label) . '</td>'
            . '<td style="padding:6px 0;color:#334155;font-size:15px;vertical-align:top;">' . $valueHtml . '</td></tr>';
    }
    $messageHtml = $messageBody !== '' ? nl2br($e($messageBody), false) : '<span style="color:#94a3b8;">' . $e($emptyMessage) . '</span>';
    $statementHtml = $statement !== ''
        ? '<p style="margin:14px 0 0 0;padding-left:12px;border-left:3px solid #cbd5e1;color:#64748b;font-size:13px;font-style:italic;">' . $e($statement) . '</p>'
        : '';
    if ($type === 'encuesta') {
        $buttonHtml = '<p style="text-align:center;margin:26px 0 4px 0;"><a href="https://www.kinesica.com.ar/admin/encuestas" style="display:inline-block;background-color:#005f99;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:8px;">Ver encuestas en el Panel Admin</a></p>';
    } else {
        $buttonHtml = $email !== ''
            ? '<p style="text-align:center;margin:26px 0 4px 0;"><a href="mailto:' . $e($email) . '?subject=' . rawurlencode('Re: ' . $subject) . '" style="display:inline-block;background-color:#005f99;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:8px;">Responder a ' . $e(mb_substr($name, 0, 40)) . '</a></p>'
            : '';
    }

    $htmlBody = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' . $e($heading) . ' - Kinésica</title></head>'
        . '<body style="margin:0;padding:20px;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">'
        . '<div style="max-width:580px;margin:0 auto;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e9f0;">'
        . '<div style="padding:26px 20px 18px 20px;text-align:center;border-bottom:2px solid #005f99;"><img src="https://www.kinesica.com.ar/images/logo.png" alt="Kinésica" style="max-width:170px;height:auto;display:block;margin:0 auto;"></div>'
        . '<div style="padding:28px 26px;color:#2c3e50;font-size:15px;line-height:1.6;">'
        . '<h1 style="font-size:20px;font-weight:600;color:#1a252f;margin:0 0 10px 0;">' . $e($heading) . '</h1>'
        . '<p style="color:#556575;margin:0 0 22px 0;">' . $lead . '</p>'
        . '<div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #005f99;border-radius:6px;padding:12px 18px;margin-bottom:22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">' . $rowsHtml . '</table></div>'
        . '<div style="font-size:13px;font-weight:600;color:#005f99;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 8px 0;">' . $e($messageTitle) . '</div>'
        . '<div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px;color:#334155;font-size:15px;line-height:1.6;">' . $messageHtml . '</div>'
        . $statementHtml . $buttonHtml . '</div>'
        . '<div style="text-align:center;padding:20px;font-size:12px;color:#8a99a8;background-color:#f8fafc;border-top:1px solid #edf2f7;">'
        . '<p style="margin:0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales &amp; Rehabilitación</p>'
        . '<p style="margin:0;"><a href="https://www.kinesica.com.ar" style="color:#005f99;text-decoration:none;font-weight:500;">www.kinesica.com.ar</a></p></div></div></body></html>';

    return ['subject' => $subject, 'fromName' => $fromName, 'textBody' => $textBody, 'htmlBody' => $htmlBody];
}

function kinesica_contact_deliver_mail(array $mail, string $to, string $mailFrom, string $replyTo, array $localCfg): bool
{
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
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'from' => $resendFrom, 'to' => [$to], 'subject' => $mail['subject'],
                'html' => $mail['htmlBody'], 'text' => $mail['textBody'], 'reply_to' => $replyTo,
            ]),
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
            return true;
        }
        error_log('[send-contact] Resend falló (' . $httpCode . '): ' . ($curlError ?: substr((string) $response, 0, 300)));
    }

    $boundary = 'bnd_' . md5(uniqid((string) mt_rand(), true));
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'From: =?UTF-8?B?' . base64_encode($mail['fromName']) . '?= <' . $mailFrom . '>',
        'Reply-To: ' . $replyTo,
        'X-Mailer: PHP/' . phpversion(),
    ]) . "\r\n";
    $mailBody = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($mail['textBody'])) . "\r\n"
        . "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($mail['htmlBody'])) . "\r\n--{$boundary}--\r\n";
    $encodedSubject = '=?UTF-8?B?' . base64_encode($mail['subject']) . '?=';

    $sent = @mail($to, $encodedSubject, $mailBody, $headers, '-f ' . $mailFrom);
    return $sent ?: @mail($to, $encodedSubject, $mailBody, $headers);
}
