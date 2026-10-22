// Garantiza que ningún teléfono/mail de prueba pueda terminar recibiendo mensajes de pacientes reales.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SEED_PHONES = ["5491144556677", "5491155667788", "5491133445566", "5491177889900", "5491122334455",
  "5491166778899", "5491188990011", "5491111223344", "5491199001122", "5491133221100"];
const files = ["admin/api/pacientes.php", "admin/api/seed_pacientes.sql", "api/send-confirmation.php",
  "api/confirmation-mail-lib.php", "booking/booking-widget.js", "booking/booking-engine.js"];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const p of SEED_PHONES) assert.ok(!s.includes(p), `${f} contiene el número de prueba ${p}`);
}
const pac = readFileSync("admin/api/pacientes.php", "utf8");
assert.ok(!/seed_pacientes\.sql/.test(pac), "pacientes.php no debe auto-cargar seed_pacientes.sql");
const seed = readFileSync("admin/api/seed_pacientes.sql", "utf8");
assert.ok(!/INSERT\s+INTO/i.test(seed), "seed_pacientes.sql no debe insertar pacientes");
const conf = readFileSync("api/send-confirmation.php", "utf8");
assert.ok(!conf.includes("email = COALESCE(VALUES(email), email)"), "la turnera no debe pisar el mail ya guardado de un paciente");
assert.match(conf, /email = CASE WHEN email IS NULL OR email = "" THEN VALUES\(email\) ELSE email END/);
assert.match(conf, /kinesica_confirmation_rate_ok\('email:/, "falta el límite por mail");
assert.match(conf, /http_response_code\(429\)/);
const botHash = readFileSync("admin/api/bot_token.sha256", "utf8").trim();
assert.match(botHash, /^[0-9a-f]{64}$/, "bot_token.sha256 debe ser un SHA-256 en hex");
assert.match(pac, /bot_token\.sha256/);
assert.match(pac, /hash_equals\(\$expectedHash, hash\('sha256', \$token\)\)/);
console.log("destinatarios: ok (sin números de prueba, sin seed, sin pisar mails, con límite)");
