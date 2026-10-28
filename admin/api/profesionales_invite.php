<?php
declare(strict_types=1);

function send_practitioner_invite_email(PDO $pdo, string $username, string $displayName, string $email): bool
{
    ensure_password_resets();
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('DELETE FROM password_resets WHERE username = :username')->execute(['username' => $username]);
    $pdo->prepare(
        'INSERT INTO password_resets (token_hash, username, expires_at) VALUES (:hash, :username, :expires)'
    )->execute([
        'hash' => hash('sha256', $token),
        'username' => $username,
        'expires' => gmdate('Y-m-d H:i:s', time() + 48 * 3600),
    ]);

    $base = rtrim((string) (cfg()['admin_url'] ?? 'https://www.kinesica.com.ar/admin/'), '/') . '/';
    $setupLink = $base . '?reset=' . $token;

    $subject = 'Bienvenido/a al equipo de Kinésica · Creá tu acceso';
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acceso al Panel de Kinésica</title>
  <style>
    body { margin: 0; padding: 24px; background-color: #f4f6f9; font-family: sans-serif; }
    .wrapper { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { padding: 24px 20px 16px; text-align: center; border-bottom: 2px solid #005f99; }
    .header h2 { margin: 0; color: #005f99; font-size: 20px; }
    .content { padding: 28px 24px; color: #1e293b; font-size: 15px; line-height: 1.6; }
    .btn-link { display: inline-block; background-color: #005f99; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 18px 0; }
    .footer { text-align: center; padding: 18px; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h2>Kinésica · Panel de Control</h2></div>
    <div class="content">
      <p>Hola <strong>{$displayName}</strong>,</p>
      <p>Te damos la bienvenida al sistema de gestión de historias clínicas y turnos de Kinésica.</p>
      <p>Para crear tu contraseña y comenzar a utilizar el panel de control, hacé clic en el botón siguiente:</p>
      <p style="text-align: center;">
        <a href="{$setupLink}" class="btn-link">Establecer mi contraseña</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        Tu usuario de acceso asignado es: <strong>{$username}</strong><br>
        Este enlace es válido durante 48 horas.<br>
        <span style="word-break: break-all;">{$setupLink}</span>
      </p>
    </div>
    <div class="footer"><p style="margin: 0;">Kinésica · Terapias Manuales & Rehabilitación</p></div>
  </div>
</body>
</html>
HTML;

    $textAlt = "Hola {$displayName},\n\n"
        . "Te damos la bienvenida al panel de Kinésica.\n"
        . "Tu usuario asignado es: {$username}\n\n"
        . "Para crear tu contraseña, ingresá al siguiente enlace en las próximas 48 horas:\n{$setupLink}\n\n"
        . "Kinésica · Terapias Manuales & Rehabilitación";

    return send_html_mail($email, $subject, $htmlBody, $textAlt);
}
