<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/horarios.php';

require_header();
$auth = require_auth();

if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

ensure_users_role_column();
ensure_login_counts();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $stmt = db()->query(
        'SELECT username, display_name, first_name, last_name, email, telefono, role, active, login_count 
         FROM users 
         ORDER BY (username = "martin") DESC, display_name ASC'
    );
    $rows = $stmt->fetchAll();

    $list = array_map(static function (array $r): array {
        return [
            'username' => (string) $r['username'],
            'name' => (string) ($r['display_name'] ?: $r['username']),
            'first_name' => (string) ($r['first_name'] ?? ''),
            'last_name' => (string) ($r['last_name'] ?? ''),
            'email' => (string) ($r['email'] ?? ''),
            'telefono' => (string) ($r['telefono'] ?? ''),
            'role' => (string) ($r['role'] ?? 'professional'),
            'active' => (int) ($r['active'] ?? 1),
            'login_count' => (int) ($r['login_count'] ?? 0),
        ];
    }, $rows);

    json_out(200, ['status' => 'success', 'profesionales' => $list]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

/**
 * Helper para sincronizar datos del profesional en settings.json
 * (practitioner_emails, practitioner_phones, opt_e_text y menu_welcome en Clara)
 */
function sync_settings_practitioner(string $username, string $email, string $phone, bool $active = true): void
{
    try {
        kinesica_update_settings(function (array $raw) use ($username, $email, $phone, $active): array {
            if (!isset($raw['practitioner_emails']) || !is_array($raw['practitioner_emails'])) {
                $raw['practitioner_emails'] = [];
            }
            if ($active && $email !== '') {
                $raw['practitioner_emails'][$username] = $email;
            } else {
                unset($raw['practitioner_emails'][$username]);
            }

            if (!isset($raw['practitioner_phones']) || !is_array($raw['practitioner_phones'])) {
                $raw['practitioner_phones'] = [];
            }
            if ($active && $phone !== '') {
                $raw['practitioner_phones'][$username] = $phone;
            } else {
                unset($raw['practitioner_phones'][$username]);
            }

            // Consultar todos los profesionales activos para sincronizar los textos de Clara
            try {
                $stmt = db()->query(
                    'SELECT username, display_name, first_name, last_name, active 
                     FROM users 
                     WHERE role = "professional" AND active = 1 
                     ORDER BY (username = "norberto") DESC, (username = "maria") DESC, display_name ASC'
                );
                $activeProfs = $stmt->fetchAll();
                if ($activeProfs) {
                    $names = array_map(static function ($p) {
                        $n = trim((string) ($p['display_name'] ?: ($p['first_name'] . ' ' . $p['last_name'])));
                        return (stripos($n, 'Lic.') === false ? 'Lic. ' : '') . $n;
                    }, $activeProfs);

                    $namesJoined = implode(' / ', $names);

                    // 1. Sincronizar bienvenida de Clara
                    if (isset($raw['clara_texts']['menu_welcome'])) {
                        $raw['clara_texts']['menu_welcome'] = preg_replace(
                            '/\*E\.\*\s*💬\s*Comunicarte con un profesional[^\n]*/u',
                            "*E.* 💬 Comunicarte con un profesional ({$namesJoined})",
                            $raw['clara_texts']['menu_welcome']
                        );
                    }

                    // 2. Sincronizar Opción E (contacto con profesional)
                    if (isset($raw['clara_texts']['opt_e_text'])) {
                        $optLines = [
                            "💬 *Contacto con un Profesional*\n",
                            "¿Con quién te gustaría comunicarte?",
                        ];
                        $idx = 1;
                        foreach ($names as $proName) {
                            $optLines[] = "*{$idx}.* {$proName}";
                            $idx++;
                        }
                        $optLines[] = "*{$idx}.* Indistinto / Primera consulta general\n";
                        $optLines[] = "_(Respondé indicando la opción deseada o escribí tu consulta directamente y se la transmitimos)_";
                        $optLines[] = "_Escribí *MENU* para volver_";
                        $raw['clara_texts']['opt_e_text'] = implode("\n", $optLines);
                    }
                }
            } catch (Throwable $t) {}

            return $raw;
        });
    } catch (Throwable $e) {
        error_log('Error syncing practitioner to settings: ' . $e->getMessage());
    }
}

// ----------------------------------------------------
// ACCIÓN: CREAR PROFESIONAL (ALTA)
// ----------------------------------------------------
if ($action === 'create') {
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $telefono = preg_replace('/[^\d+]/', '', trim((string) ($input['telefono'] ?? '')));
    $role = (string) ($input['role'] ?? 'professional');
    if (!in_array($role, ['admin', 'professional'], true)) {
        $role = 'professional';
    }

    if ($firstName === '' || $lastName === '') {
        json_out(400, ['error' => 'Nombre y Apellido son obligatorios.']);
    }

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_out(400, ['error' => 'Ingresá un correo electrónico válido.']);
    }

    // Nombre a mostrar completo
    $displayName = $firstName . ' ' . $lastName;

    // Generar username sugerido a partir de nombre y apellido
    $cleanFirst = mb_strtolower($firstName, 'UTF-8');
    $cleanLast = mb_strtolower($lastName, 'UTF-8');
    $cleanFirst = preg_replace('/[^a-z0-9]/', '', strtr($cleanFirst, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n'])) ?? '';
    $cleanLast = preg_replace('/[^a-z0-9]/', '', strtr($cleanLast, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n'])) ?? '';

    $baseUsername = $cleanFirst . ($cleanLast !== '' ? '.' . $cleanLast : '');
    if (strlen($baseUsername) < 3) {
        $baseUsername = 'profesional_' . random_int(100, 999);
    }
    if (strlen($baseUsername) > 28) {
        $baseUsername = substr($baseUsername, 0, 28);
    }

    // Asegurar unicidad de username
    $username = $baseUsername;
    $suffix = 1;
    $pdo = db();
    while (true) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = :u OR email = :e');
        $stmt->execute(['u' => $username, 'e' => $email]);
        if ((int) $stmt->fetchColumn() === 0) {
            break;
        }
        // Si el mail ya existe, error
        $stmtMail = $pdo->prepare('SELECT username FROM users WHERE email = :e');
        $stmtMail->execute(['e' => $email]);
        if ($stmtMail->fetchColumn()) {
            json_out(400, ['error' => 'Ya existe un usuario registrado con el correo ' . $email]);
        }
        $suffix++;
        $username = substr($baseUsername, 0, 25) . $suffix;
    }

    // Generar secreto TOTP provisorio y contraseña provisoria
    $totpSecret = base32_encode(random_bytes(20));
    $tempPassHash = password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT);

    $stmt = $pdo->prepare(
        'INSERT INTO users (username, display_name, first_name, last_name, email, telefono, role, active, password_hash, totp_secret, totp_confirmed, login_count)
         VALUES (:username, :display_name, :first_name, :last_name, :email, :telefono, :role, 1, :hash, :totp, 0, 0)'
    );
    $stmt->execute([
        'username' => $username,
        'display_name' => $displayName,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'telefono' => $telefono,
        'role' => $role,
        'hash' => $tempPassHash,
        'totp' => $totpSecret,
    ]);

    // Generar token para que configure su contraseña vía enlace al correo
    ensure_password_resets();
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('DELETE FROM password_resets WHERE username = :username')->execute(['username' => $username]);
    $pdo->prepare(
        'INSERT INTO password_resets (token_hash, username, expires_at) VALUES (:hash, :username, :expires)'
    )->execute([
        'hash' => hash('sha256', $token),
        'username' => $username,
        'expires' => gmdate('Y-m-d H:i:s', time() + 48 * 3600), // 48 horas de vigencia para el alta inicial
    ]);

    $base = rtrim((string) (cfg()['admin_url'] ?? 'https://www.kinesica.com.ar/admin/'), '/') . '/';
    $setupLink = $base . '?reset=' . $token;

    // Sincronizar en settings.json
    sync_settings_practitioner($username, $email, $telefono, true);

    // Enviar correo de bienvenida con el enlace de activación
    $subject = 'Bienvenido/a al equipo de Kinésica · Creá tu acceso';
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acceso al Panel de Kinésica</title>
  <style>
    body { margin: 0; padding: 24px; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
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
    <div class="header">
      <h2>Kinésica · Panel de Control</h2>
    </div>
    <div class="content">
      <p>Hola <strong>{$displayName}</strong>,</p>
      <p>Te damos la bienvenida al sistema de gestión de historias clínicas y turnos de Kinésica.</p>
      <p>Para crear tu contraseña y comenzar a utilizar el panel de control, hacé clic en el botón siguiente:</p>
      <p style="text-align: center;">
        <a href="{$setupLink}" class="btn-link">Establecer mi contraseña</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        Tu usuario de acceso asignado es: <strong>{$username}</strong><br>
        Este enlace es válido durante 48 horas. Si el botón no abre, podés copiar y pegar este enlace en tu navegador:<br>
        <span style="word-break: break-all;">{$setupLink}</span>
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Kinésica · Terapias Manuales & Rehabilitación</p>
    </div>
  </div>
</body>
</html>
HTML;

    $textAlt = "Hola {$displayName},\n\n"
        . "Te damos la bienvenida al panel de Kinésica.\n"
        . "Tu usuario asignado es: {$username}\n\n"
        . "Para crear tu contraseña, ingresá al siguiente enlace en las próximas 48 horas:\n{$setupLink}\n\n"
        . "Kinésica · Terapias Manuales & Rehabilitación";

    $mailSent = send_html_mail($email, $subject, $htmlBody, $textAlt);

    json_out(201, [
        'status' => 'success',
        'message' => 'Profesional creado con éxito. Se envió el enlace de activación a ' . $email,
        'user' => [
            'username' => $username,
            'name' => $displayName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'telefono' => $telefono,
            'role' => $role,
            'active' => 1,
            'mail_sent' => $mailSent,
        ],
    ]);
}

// ----------------------------------------------------
// ACCIÓN: MODIFICAR PROFESIONAL (EDICIÓN)
// ----------------------------------------------------
if ($action === 'update') {
    $username = trim((string) ($input['username'] ?? ''));
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $telefono = preg_replace('/[^\d+]/', '', trim((string) ($input['telefono'] ?? '')));
    $role = (string) ($input['role'] ?? '');

    if ($username === '') {
        json_out(400, ['error' => 'Usuario no especificado.']);
    }

    if ($firstName === '' || $lastName === '') {
        json_out(400, ['error' => 'Nombre y Apellido son obligatorios.']);
    }

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_out(400, ['error' => 'Ingresá un correo electrónico válido.']);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
    $stmt->execute(['u' => $username]);
    $user = $stmt->fetch();
    if (!$user) {
        json_out(404, ['error' => 'Profesional no encontrado.']);
    }

    // Verificar que el correo no pertenezca a otro usuario
    $stmtCheck = $pdo->prepare('SELECT username FROM users WHERE email = :e AND username != :u LIMIT 1');
    $stmtCheck->execute(['e' => $email, 'u' => $username]);
    if ($stmtCheck->fetchColumn()) {
        json_out(400, ['error' => 'El correo electrónico ya está registrado por otro profesional.']);
    }

    $displayName = $firstName . ' ' . $lastName;
    $targetRole = in_array($role, ['admin', 'professional'], true) ? $role : ($user['role'] ?? 'professional');

    // No permitir que Martín se quite el rol admin
    if ($username === 'martin') {
        $targetRole = 'admin';
    }

    $stmtUpd = $pdo->prepare(
        'UPDATE users 
         SET first_name = :fn, last_name = :ln, display_name = :dn, email = :e, telefono = :tel, role = :role 
         WHERE username = :u'
    );
    $stmtUpd->execute([
        'fn' => $firstName,
        'ln' => $lastName,
        'dn' => $displayName,
        'e' => $email,
        'tel' => $telefono,
        'role' => $targetRole,
        'u' => $username,
    ]);

    // Sincronizar cambios en settings.json
    $isActive = (int) ($user['active'] ?? 1) === 1;
    sync_settings_practitioner($username, $email, $telefono, $isActive);

    json_out(200, [
        'status' => 'success',
        'message' => 'Datos actualizados con éxito.',
        'user' => [
            'username' => $username,
            'name' => $displayName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'telefono' => $telefono,
            'role' => $targetRole,
            'active' => (int) ($user['active'] ?? 1),
        ],
    ]);
}

// ----------------------------------------------------
// ACCIÓN: ALTERNAR ESTADO ACTIVO/INACTIVO (BAJA / REACTIVACIÓN)
// ----------------------------------------------------
if ($action === 'toggle_active') {
    $username = trim((string) ($input['username'] ?? ''));
    if ($username === '') {
        json_out(400, ['error' => 'Usuario no especificado.']);
    }

    if ($username === 'martin') {
        json_out(400, ['error' => 'No es posible desactivar la cuenta del administrador principal.']);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
    $stmt->execute(['u' => $username]);
    $user = $stmt->fetch();
    if (!$user) {
        json_out(404, ['error' => 'Profesional no encontrado.']);
    }

    $currentActive = (int) ($user['active'] ?? 1);
    $newActive = $currentActive === 1 ? 0 : 1;

    $stmtUpd = $pdo->prepare('UPDATE users SET active = :active WHERE username = :u');
    $stmtUpd->execute(['active' => $newActive, 'u' => $username]);

    $email = (string) ($user['email'] ?? '');
    $phone = (string) ($user['telefono'] ?? '');
    sync_settings_practitioner($username, $email, $phone, $newActive === 1);

    json_out(200, [
        'status' => 'success',
        'active' => $newActive,
        'message' => $newActive === 1 ? 'Profesional reactivado.' : 'Profesional dado de baja (cuenta suspendida).',
    ]);
}

// ----------------------------------------------------
// ACCIÓN: REENVIAR ENLACE DE ACCESO / RESET
// ----------------------------------------------------
if ($action === 'resend_invite') {
    $username = trim((string) ($input['username'] ?? ''));
    if ($username === '') {
        json_out(400, ['error' => 'Usuario no especificado.']);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
    $stmt->execute(['u' => $username]);
    $user = $stmt->fetch();
    if (!$user) {
        json_out(404, ['error' => 'Profesional no encontrado.']);
    }

    $email = (string) ($user['email'] ?? user_email($username));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_out(400, ['error' => 'El profesional no tiene un correo electrónico válido configurado.']);
    }

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
    $link = $base . '?reset=' . $token;
    $displayName = (string) ($user['display_name'] ?: $username);

    $subject = 'Enlace de acceso a Kinésica';
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acceso al Panel de Kinésica</title>
  <style>
    body { margin: 0; padding: 24px; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
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
    <div class="header">
      <h2>Kinésica · Panel de Control</h2>
    </div>
    <div class="content">
      <p>Hola <strong>{$displayName}</strong>,</p>
      <p>Te enviamos este enlace para que puedas establecer o actualizar tu contraseña de acceso al panel de control de Kinésica:</p>
      <p style="text-align: center;">
        <a href="{$link}" class="btn-link">Configurar contraseña</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        Este enlace es válido durante 48 horas. Si el botón no abre, podés copiar y pegar este enlace en tu navegador:<br>
        <span style="word-break: break-all;">{$link}</span>
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Kinésica · Terapias Manuales & Rehabilitación</p>
    </div>
  </div>
</body>
</html>
HTML;

    $textAlt = "Hola {$displayName},\n\nPara configurar tu contraseña de Kinésica ingresá al siguiente enlace:\n{$link}\n\nVálido por 48 horas.";
    $sent = send_html_mail($email, $subject, $htmlBody, $textAlt);
    if (!$sent) {
        json_out(502, ['error' => 'No se pudo enviar el correo de activación.']);
    }

    json_out(200, ['status' => 'success', 'message' => 'Enlace enviado a ' . $email]);
}

json_out(400, ['error' => 'Acción no válida.']);
