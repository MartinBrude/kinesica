<?php
/**
 * Rate limiting, carga de config local y transporte de correo para api/send-confirmation.php.
 */

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

function kinesica_confirmation_load_local_cfg(string $apiDir): array
{
    $localCfg = [];
    foreach (['config.php', 'mail.php'] as $f) {
        $path = $apiDir . '/../admin/api/' . $f;
        if (is_file($path)) {
            $loaded = @include $path;
            if (is_array($loaded)) {
                $localCfg = array_merge($localCfg, $loaded);
            }
        }
    }
    return $localCfg;
}

/**
 * Envía el mail de confirmación vía Resend o fallback mail() del MTA.
 *
 * @return array{ok:bool,status:int,body:array<string,mixed>}
 */
function kinesica_confirmation_deliver_mail(
    string $email,
    string $subject,
    string $htmlContent,
    string $replyToEmail,
    string $manageCode,
    string $manageUrl,
    array $localCfg
): array {
    $apiKey = trim((string) (
        getenv('RESEND_API_KEY')
        ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? $localCfg['resend_api_key'] ?? '')
    ));

    $resendError = null;
    if ($apiKey !== '') {
        $resendFrom = (string) ($localCfg['resend_from'] ?? 'Kinésica <onboarding@resend.dev>');
        $payload = [
            'from' => $resendFrom,
            'to' => [$email],
            'subject' => $subject,
            'html' => $htmlContent,
            'reply_to' => $replyToEmail,
        ];

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
            $out = ['success' => true, 'provider' => 'resend', 'data' => json_decode((string) $response, true)];
            if ($manageCode !== '') {
                $out['manageCode'] = $manageCode;
                $out['manageUrl'] = $manageUrl;
            }
            return ['ok' => true, 'status' => 200, 'body' => $out];
        }
        $resendError = $curlError ?: json_decode((string) $response, true);
    }

    // Fallback nativo vía MTA del servidor (Hostinger mail() con no-reply@kinesica.com.ar)
    $mailFrom = trim((string) ($localCfg['mail_from'] ?? 'no-reply@kinesica.com.ar')) ?: 'no-reply@kinesica.com.ar';
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: =?UTF-8?B?' . base64_encode('Kinésica') . '?= <' . $mailFrom . '>',
        'Reply-To: Kinésica <' . $replyToEmail . '>',
        'X-Mailer: PHP/' . phpversion(),
    ]) . "\r\n";

    $sentViaMail = @mail($email, $encodedSubject, $htmlContent, $headers, '-f ' . $mailFrom);
    if (!$sentViaMail) {
        $sentViaMail = @mail($email, $encodedSubject, $htmlContent, $headers);
    }

    if ($sentViaMail) {
        $out = ['success' => true, 'provider' => 'mail', 'from' => $mailFrom];
        if ($manageCode !== '') {
            $out['manageCode'] = $manageCode;
            $out['manageUrl'] = $manageUrl;
        }
        return ['ok' => true, 'status' => 200, 'body' => $out];
    }

    return [
        'ok' => false,
        'status' => 502,
        'body' => ['success' => false, 'error' => $resendError ?: 'No se pudo enviar el correo de confirmación.'],
    ];
}
