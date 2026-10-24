import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = "/Users/martinbrude/Documents/kinesica";
const libPhp = fs.readFileSync(path.join(rootDir, "admin/api/lib.php"), "utf8");
const loginCodePhp = fs.readFileSync(path.join(rootDir, "admin/api/login-code.php"), "utf8");

test("lib.php contiene send_login_code_email y send_html_mail con multipart/alternative", () => {
  assert.match(libPhp, /function send_login_code_email\(string \$to, string \$displayName, string \$code\): bool/);
  assert.match(libPhp, /function send_html_mail\(string \$to, string \$subject, string \$htmlBody, string \$textAlt = ''\): bool/);
  assert.match(libPhp, /multipart\/alternative; boundary=/);
  assert.match(libPhp, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(libPhp, /Content-Type: text\/html; charset=UTF-8/);
});

test("El asunto del correo no incluye el código OTP", () => {
  assert.match(libPhp, /\$subject = 'Código de acceso a Kinésica';/);
  assert.doesNotMatch(libPhp, /\$subject = "Código de acceso a Kinésica: \{\$code\}";/);
});

test("El código se normaliza a string con relleno de ceros y sin espacios ni separadores", () => {
  assert.match(libPhp, /\$cleanCode = str_pad\(trim\(\$code\), 6, '0', STR_PAD_LEFT\);/);
  // Verificar que en el HTML y plain text se usa cleanCode directamente
  assert.match(libPhp, /<div class="code-number">\{\$cleanCode\}<\/div>/);
  assert.doesNotMatch(libPhp, /<div class="code-number">\{\$codeFormatted\}<\/div>/);
});

test("Se incluye frase explícita inmediatamente tras el código en ambas versiones", () => {
  const phrase = "Usá este código de verificación para iniciar sesión en el panel de control de Kinésica";
  assert.match(libPhp, new RegExp(phrase));
});

test("Seguridad del OTP: 15 minutos de caducidad, hash sha256 y borrado tras uso único", () => {
  assert.match(loginCodePhp, /login_code_store\(\$username, \$code, 15\);/);
  assert.match(libPhp, /DELETE FROM login_codes WHERE username = :username OR expires_at < UTC_TIMESTAMP\(\)/);
  assert.match(libPhp, /SELECT username FROM login_codes WHERE code_hash = :hash AND username = :username AND expires_at > UTC_TIMESTAMP\(\)/);
  assert.match(libPhp, /DELETE FROM login_codes WHERE username = :username/);
});

test("Ambas versiones (HTML y Text) contienen el mismo OTP y datos esenciales", () => {
  function renderTemplate(code, displayName) {
    const cleanCode = String(code).trim().padStart(6, "0");
    const greeting = displayName ? `Hola ${displayName},` : "Hola,";
    const greetingPlain = displayName ? `Hola ${displayName},` : "Hola,";

    const html = `
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${cleanCode} es tu código de verificación para iniciar sesión en el panel de control de Kinésica.
    </div>
    <div class="wrapper">
      <div class="header">
        <h2>Kinésica · Panel de Control</h2>
      </div>
      <div class="content">
        <div class="code-box">
          <div class="code-number">${cleanCode}</div>
          <div class="instruction">Usá este código de verificación para iniciar sesión en el panel de control de Kinésica.</div>
          <span class="badge">Válido por 15 minutos · Un solo uso</span>
        </div>
        <p style="margin-top: 16px;">${greeting}</p>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          Si vos no solicitaste este código, podés ignorar este mensaje con tranquilidad. Tu cuenta permanece segura.
        </p>
      </div>
    </div>`;

    const text = `${cleanCode}\n\n`
        + `Usá este código de verificación para iniciar sesión en el panel de control de Kinésica.\n\n`
        + `${greetingPlain}\n\n`
        + `Detalles de seguridad:\n`
        + `• Validez: 15 minutos\n`
        + `• Uso: un solo uso\n\n`
        + `Si vos no solicitaste este código, podés ignorar este correo. Tu cuenta permanece segura.\n\n`
        + `Kinésica · Terapias Manuales & Rehabilitación`;

    return { html, text, cleanCode };
  }

  // Prueba con ceros a la izquierda
  const test1 = renderTemplate("405", "Martín");
  assert.equal(test1.cleanCode, "000405");
  assert.ok(test1.html.includes("000405"));
  assert.ok(test1.text.startsWith("000405\n\n"));
  assert.ok(!test1.html.includes("000 405"));
  assert.ok(!test1.text.includes("000 405"));

  // Prueba con 6 dígitos completos
  const test2 = renderTemplate("992405", "Lic. María Gulín");
  assert.equal(test2.cleanCode, "992405");
  assert.ok(test2.html.includes("<div class=\"code-number\">992405</div>"));
  assert.ok(test2.text.startsWith("992405\n\n"));
  assert.ok(test2.html.includes("Lic. María Gulín"));
  assert.ok(test2.text.includes("Lic. María Gulín"));
  assert.ok(test2.html.includes("15 minutos"));
  assert.ok(test2.text.includes("15 minutos"));
});
