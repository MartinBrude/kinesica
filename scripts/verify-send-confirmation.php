<?php
/**
 * Tests del mail de confirmación de la turnera (api/send-confirmation.php).
 * Ejecución: php scripts/verify-send-confirmation.php   (npm run mail:test)
 * Renderiza el endpoint real capturando el mail (sendmail_path → archivo), sin enviar nada.
 */
require __DIR__ . '/../api/confirmation-mail-lib.php';

$n = 0;
function check(bool $cond, string $msg): void { global $n; if (!$cond) { fwrite(STDERR, "FAIL: $msg\n"); exit(1); } $n++; }

// --- helpers ---
check(kinesica_practitioner_id('Lic. María Gulin') === 'maria', 'María Gulin');
check(kinesica_practitioner_id('maria') === 'maria', 'maria');
check(kinesica_practitioner_id('Lic. Norberto Brude') === 'norberto', 'Norberto');
check(kinesica_practitioner_id('Mariana López') === null, 'Mariana no es María');
check(kinesica_reply_to_email('', 'Lic. María Gulin') === 'manosmagicas7116@gmail.com', 'reply-to María');
check(kinesica_reply_to_email('', 'Lic. Norberto Brude') === 'norberto1712@gmail.com', 'reply-to Norberto');
check(kinesica_reply_to_email('maria', 'Lic. Norberto Brude') === 'manosmagicas7116@gmail.com', 'practitionerId manda');
check(kinesica_reply_to_email('', '') === 'norberto1712@gmail.com', 'sin profesional → Norberto');
check(kinesica_reply_to_email('maria', '', [], ['user_emails' => ['maria' => 'otra@x.com']]) === 'otra@x.com', 'config user_emails');
check(kinesica_reply_to_email('maria', '', ['practitioner_emails' => ['maria' => 'set@x.com']], ['user_emails' => ['maria' => 'otra@x.com']]) === 'set@x.com', 'settings manda');
$t = kinesica_mail_texts([]);
check(str_contains($t['cancellation_policy'], '24 horas') && $t['confirmation_notes'] === '', 'fallback sin settings');
$t = kinesica_mail_texts(['clara_texts' => ['cancellation_policy' => '  ', 'confirmation_notes' => '']]);
check(str_contains($t['cancellation_policy'], '24 horas'), 'fallback campo vacío');
check(kinesica_text_to_html("<b>x</b> & \"y\"\nlínea 2") === "&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;<br>\nlínea 2", 'escape + saltos');
check(str_contains(kinesica_guidelines_html('', 'P', 'A', false), 'Ropa adecuada'), 'sin notas → lista actual');
check(!str_contains(kinesica_guidelines_html('Notas', 'P', 'A', false), 'Ropa adecuada'), 'con notas → notas del admin');

// --- endpoint real, mail capturado ---
function render_mail(array $post, ?array $settings): array
{
    $root = sys_get_temp_dir() . '/kin-mail-' . bin2hex(random_bytes(4));
    @mkdir("$root/api", 0777, true);
    @mkdir("$root/admin/api", 0777, true);
    foreach (['send-confirmation.php', 'confirmation-mail-lib.php'] as $f) {
        copy(__DIR__ . "/../api/$f", "$root/api/$f");
    }
    if ($settings !== null) {
        file_put_contents("$root/admin/api/settings.json", json_encode($settings, JSON_UNESCAPED_UNICODE));
    }
    $out = "$root/mail.eml";
    $runner = "$root/run.php";
    file_put_contents($runner, '<?php $_SERVER["REQUEST_METHOD"]="POST"; $_POST=' . var_export($post, true) . '; include ' . var_export("$root/api/send-confirmation.php", true) . ';');
    $cmd = 'RESEND_API_KEY= php -d ' . escapeshellarg('sendmail_path=cat > ' . $out) . ' ' . escapeshellarg($runner) . ' 2>&1';
    $resp = shell_exec($cmd);
    $mail = is_file($out) ? file_get_contents($out) : '';
    return [$resp, $mail];
}
$base = ['email' => 'paciente@example.com', 'paciente' => 'Ana <Test>', 'fecha' => '2026-10-26', 'hora' => '10:00', 'profesional' => 'Lic. María Gulin', 'servicio' => 'Acupuntura'];
$admin = ['clara_texts' => [
    'cancellation_policy' => "Cancelá con 48 hs <b>mínimo</b>.\nGracias & saludos",
    'confirmation_notes' => "Traé toalla.\nLlegá puntual <script>x</script>",
]];
[$resp, $mail] = render_mail($base, $admin);
check(str_contains((string) $resp, '"success":true'), 'endpoint responde success: ' . $resp);
check(str_contains($mail, 'Reply-To: Kinésica <manosmagicas7116@gmail.com>'), 'Reply-To María');
check(str_contains($mail, 'Cancelá con 48 hs &lt;b&gt;mínimo&lt;/b&gt;.<br>'), 'política del admin escapada con salto');
check(str_contains($mail, 'Gracias &amp; saludos'), 'ampersand escapado');
check(str_contains($mail, 'Traé toalla.<br>'), 'notas del admin con salto');
check(str_contains($mail, '&lt;script&gt;x&lt;/script&gt;') && !str_contains($mail, '<script>x'), 'notas escapadas');
check(!str_contains($mail, 'Ropa adecuada') && !str_contains($mail, '24 horas'), 'no usa los textos hardcodeados');
check(str_contains($mail, 'Información importante para tu sesión'), 'mantiene el título de la sección');

[$resp, $mail] = render_mail(['profesional' => 'Lic. Norberto Brude'] + $base, null);
check(str_contains($mail, 'Reply-To: Kinésica <norberto1712@gmail.com>'), 'Reply-To Norberto');
check(str_contains($mail, '24 horas') && str_contains($mail, 'Ropa adecuada'), 'sin settings: textos actuales');

[$resp, $mail] = render_mail(['tipo' => 'cancelacion', 'profesional' => 'Lic. María Gulin'] + $base, $admin);
check(str_contains($mail, 'Turno anulado') && str_contains($mail, 'Reply-To: Kinésica <manosmagicas7116@gmail.com>'), 'anulación: Reply-To del profesional');

echo "mail de confirmación: ok ($n comprobaciones)\n";
