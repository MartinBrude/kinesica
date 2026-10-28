<?php
declare(strict_types=1);

function send_mail(string $to, string $subject, string $body): bool
{
    $from = (string) (cfg()['mail_from'] ?? '');
    if ($from === '' || $to === '') {
        return false;
    }
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = "From: Kinésica <{$from}>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    return mail($to, $encoded, $body, $headers);
}

function send_html_mail(string $to, string $subject, string $htmlBody, string $textAlt = ''): bool
{
    $from = (string) (cfg()['mail_from'] ?? 'no-reply@kinesica.com.ar');
    if ($from === '' || $to === '') {
        return false;
    }
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $resendKey = getenv('RESEND_API_KEY') ?: ($_SERVER['RESEND_API_KEY'] ?? $_ENV['RESEND_API_KEY'] ?? cfg()['resend_api_key'] ?? '');
    if ($resendKey !== '' && function_exists('curl_init')) {
        $payload = [
            'from' => 'Kinésica <' . $from . '>',
            'to' => [$to],
            'subject' => $subject,
            'html' => $htmlBody,
        ];
        if ($textAlt !== '') {
            $payload['text'] = $textAlt;
        }
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $resendKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 6,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if (!$curlError && $httpCode >= 200 && $httpCode < 300) {
            return true;
        }
    }

    if ($textAlt !== '') {
        $boundary = 'bnd_' . md5(uniqid((string) mt_rand(), true));
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'From: =?UTF-8?B?' . base64_encode('Kinésica') . "?= <{$from}>",
            'Reply-To: Kinésica <' . $from . '>',
            'X-Mailer: PHP/' . phpversion(),
        ]) . "\r\n";

        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($textAlt)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($htmlBody)) . "\r\n"
            . "--{$boundary}--\r\n";
    } else {
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: =?UTF-8?B?' . base64_encode('Kinésica') . "?= <{$from}>",
            'Reply-To: Kinésica <' . $from . '>',
            'X-Mailer: PHP/' . phpversion(),
        ]) . "\r\n";
        $body = $htmlBody;
    }

    $sent = @mail($to, $encoded, $body, $headers, '-f ' . $from);
    if (!$sent) {
        $sent = @mail($to, $encoded, $body, $headers);
    }
    return (bool) $sent;
}
