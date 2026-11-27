#!/usr/bin/env node
/**
 * Verifica la firma HMAC-SHA256 de confirmación (Apps Script ↔ PHP) y anti-abuso WhatsApp.
 * Ejecución: node scripts/verify-confirm-signature.mjs
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readGasSource } from "./gas-source.mjs";
import { CONTACT } from "./site-contact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_SECRET = "kin_hmac_test_secret_2026_x9a8b7c6";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kin-confirm-sig-"));
const stateDir = path.join(tmpDir, "wa_state");

function loadGasVm(secret = TEST_SECRET) {
  const props = secret ? { WEBHOOK_SECRET: secret } : {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => "{}" }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getActiveSheet: () => ({ appendRow() {} }) }) },
    CalendarApp: {
      getCalendarById: () => ({
        getName: () => "consultorio",
        getEvents: () => [],
        createEvent: () => ({ getId: () => "evt_gas_signed_001@google.com", addGuest() {} }),
      }),
    },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      formatDate(d, tz, fmt) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(d).map((p) => [p.type, p.value]));
        return fmt === "HH:mm" ? `${parts.hour}:${parts.minute}` : `${parts.year}-${parts.month}-${parts.day}`;
      },
      base64EncodeWebSafe(input) {
        const buf = Buffer.isBuffer(input)
          ? input
          : Array.isArray(input)
            ? Buffer.from(input.map((b) => (b < 0 ? b + 256 : b)))
            : Buffer.from(String(input), "utf8");
        // Replicar comportamiento real de GAS: web-safe base64 CON padding '='
        return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
      },
      computeHmacSha256Signature(value, key) {
        const digest = crypto.createHmac("sha256", Buffer.from(String(key), "utf8"))
          .update(Buffer.from(String(value), "utf8"))
          .digest();
        return [...digest].map((b) => (b > 127 ? b - 256 : b));
      },
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ getContent: () => text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readGasSource(), ctx);
  return ctx;
}

function runPhp(code, extraEnv = {}) {
  const file = path.join(tmpDir, `run_${crypto.randomBytes(4).toString("hex")}.php`);
  fs.writeFileSync(file, `<?php\n${code}\n`, "utf8");
  const proc = spawnSync("php", ["-d", "error_reporting=24575", file], {
    env: { ...process.env, KINESICA_CONFIRM_STATE_DIR: stateDir, ...extraEnv },
    encoding: "utf8",
  });
  if (proc.error) throw proc.error;
  assert.equal(proc.status, 0, `PHP falló: ${proc.stderr || proc.stdout}`);
  return JSON.parse((proc.stdout || "").trim());
}

function nextWednesdayIso() {
  const d = new Date(Date.now() + 7 * 86400000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

let n = 0;
const test = (name, fn) => { fn(); n += 1; console.log(`  ✅ ${name}`); };

console.log("🔐 Verificando firma HMAC Apps Script ↔ PHP (anti-abuso WhatsApp)...\n");

const targetWed = nextWednesdayIso();
let gasToken = "";

test("1. GAS handleBookAppointment emite confirmToken HMAC con UTF-8", () => {
  const ctx = loadGasVm(TEST_SECRET);
  const res = ctx.handleBookAppointment({
    action: "book",
    appointmentType: "session",
    practitionerId: "norberto",
    techniqueId: "rpg",
    nombre: "María José Ñandú",
    email: "maria.jose@ejemplo.com",
    telefono: "+54 9 11 6111-2222",
    dni: "32111222",
    date: targetWed,
    time: "10:00",
    bookingRequestId: "req_hmac_test_000001",
  });
  const json = JSON.parse(res.getContent());
  assert.equal(json.status, "success");
  assert.equal(json.eventId, "evt_gas_signed_001@google.com");
  assert.match(String(json.confirmToken || ""), /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  gasToken = json.confirmToken;
});

test("2. PHP verifica el token real generado por GAS y extrae claims intactos", () => {
  const out = runPhp(`
    require ${JSON.stringify(path.join(ROOT, "api/send-confirmation-auth.php"))};
    echo json_encode(kinesica_confirmation_verify_token(${JSON.stringify(gasToken)}, ['webhook_secret' => ${JSON.stringify(TEST_SECRET)}]));
  `);
  assert.equal(out.ok, true);
  assert.equal(out.claims.eid, "evt_gas_signed_001@google.com");
  assert.equal(out.claims.nom, "María José Ñandú");
  assert.equal(out.claims.tel, "+54 9 11 6111-2222");
  assert.equal(out.claims.pid, "norberto");
  assert.equal(out.claims.srv, "RPG");
  assert.equal(out.claims.src, "gas");
});

test("3. Rechaza token adulterado, secreto distinto, expirado o sin secreto (fail-closed)", () => {
  const parts = gasToken.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  claims.tel = "5491199998888";
  const tamperedPayload = `v1.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${parts[2]}`;
  const out = runPhp(`
    require ${JSON.stringify(path.join(ROOT, "api/send-confirmation-auth.php"))};
    $cfg = ['webhook_secret' => ${JSON.stringify(TEST_SECRET)}];
    echo json_encode([
      'tampered' => kinesica_confirmation_verify_token(${JSON.stringify(tamperedPayload)}, $cfg),
      'wrong_secret' => kinesica_confirmation_verify_token(${JSON.stringify(gasToken)}, ['webhook_secret' => 'otro_secreto']),
      'expired' => kinesica_confirmation_verify_token(${JSON.stringify(gasToken)}, $cfg, time() + 7200),
      'no_secret' => kinesica_confirmation_verify_token(${JSON.stringify(gasToken)}, []),
      'empty' => kinesica_confirmation_verify_token('', $cfg),
    ]);
  `, { KINESICA_CONFIRM_SECRET: "", KINESICA_GAS_API_SECRET: "", KINESICA_BACKUP_SECRET: "" });
  assert.equal(out.tampered.ok, false);
  assert.equal(out.tampered.reason, "CONFIRM_TOKEN_INVALID");
  assert.equal(out.wrong_secret.ok, false);
  assert.equal(out.expired.ok, false);
  assert.equal(out.expired.reason, "CONFIRM_TOKEN_EXPIRED");
  assert.equal(out.no_secret.ok, false);
  assert.equal(out.no_secret.reason, "CONFIRM_SECRET_MISSING");
  assert.equal(out.empty.reason, "CONFIRM_TOKEN_REQUIRED");
});

test("4. Anti-replay por eventId permite 1 WA enviado y frena duplicados en reintento", () => {
  const out = runPhp(`
    require ${JSON.stringify(path.join(ROOT, "api/send-confirmation-auth.php"))};
    $c1 = kinesica_confirmation_wa_claim('evt_replay_1');
    kinesica_confirmation_wa_mark_sent('evt_replay_1');
    $c2 = kinesica_confirmation_wa_claim('evt_replay_1');
    $f1 = kinesica_confirmation_wa_claim('evt_fail_cap');
    $f2 = kinesica_confirmation_wa_claim('evt_fail_cap');
    $f3 = kinesica_confirmation_wa_claim('evt_fail_cap');
    echo json_encode(compact('c1','c2','f1','f2','f3'));
  `);
  assert.equal(out.c1.allowed, true);
  assert.equal(out.c2.allowed, false);
  assert.equal(out.c2.already_sent, true);
  assert.equal(out.f1.allowed, true);
  assert.equal(out.f2.allowed, true);
  assert.equal(out.f3.allowed, false);
  assert.equal(out.f3.reason, "WA_EVENT_LIMIT");
});

test("5. send-confirmation.php bloquea envío anónimo solo-teléfono y descarta dirección del cliente", () => {
  const sandbox = path.join(tmpDir, "webroot");
  fs.mkdirSync(path.join(sandbox, "api"), { recursive: true });
  fs.mkdirSync(path.join(sandbox, "admin/api"), { recursive: true });
  for (const f of [
    "send-confirmation.php", "send-confirmation-auth.php", "send-confirmation-patient.php",
    "send-confirmation-transport.php", "send-confirmation-whatsapp.php",
    "confirmation-mail-lib.php", "confirmation-mail-templates.php",
  ]) {
    fs.copyFileSync(path.join(ROOT, "api", f), path.join(sandbox, "api", f));
  }
  fs.writeFileSync(path.join(sandbox, "admin/api/config.php"), `<?php return ['webhook_secret' => ${JSON.stringify(TEST_SECRET)}];\n`);

  const runEndpoint = (postObj) => {
    const mailOut = path.join(tmpDir, `mail_${crypto.randomBytes(4).toString("hex")}.eml`);
    const runner = path.join(tmpDir, `ep_${crypto.randomBytes(4).toString("hex")}.php`);
    const testIp = `127.0.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`;
    fs.writeFileSync(runner, `<?php $_SERVER['REQUEST_METHOD']='POST'; $_SERVER['REMOTE_ADDR']=${JSON.stringify(testIp)}; $_POST=json_decode(${JSON.stringify(JSON.stringify(postObj))}, true); include ${JSON.stringify(path.join(sandbox, "api/send-confirmation.php"))};`);
    const proc = spawnSync("php", ["-d", "display_errors=0", "-d", `sendmail_path=cat > ${mailOut}`, runner], {
      env: { ...process.env, RESEND_API_KEY: "", KINESICA_CONFIRM_STATE_DIR: stateDir },
      encoding: "utf8",
    });
    return {
      json: JSON.parse((proc.stdout || "").trim()),
      mail: fs.existsSync(mailOut) ? fs.readFileSync(mailOut, "utf8") : "",
    };
  };

  // Teléfono sin confirmToken -> 403 / rechazado
  const anonPhone = runEndpoint({ paciente: "Víctima", telefono: "5491144445555", fecha: targetWed, hora: "10:00" });
  assert.equal(anonPhone.json.success, false);
  assert.equal(anonPhone.json.whatsapp.ok, false);
  assert.equal(anonPhone.json.whatsapp.error_code, "CONFIRM_TOKEN_REQUIRED");

  // Email + teléfono sin confirmToken + dirección phishing -> mail usa dirección fija del servidor y WA omitido
  const phishMail = runEndpoint({
    email: `test+${crypto.randomBytes(3).toString("hex")}@example.com`,
    paciente: "Ana Test",
    telefono: "5491144445555",
    fecha: targetWed,
    hora: "10:00",
    direccion: "https://phishing.evil/robar",
  });
  assert.equal(phishMail.json.email.ok, true);
  assert.equal(phishMail.json.whatsapp.ok, false);
  assert.equal(phishMail.json.whatsapp.skipped, true);
  assert.equal(phishMail.json.whatsapp.error_code, "CONFIRM_TOKEN_REQUIRED");
  assert.ok(!phishMail.mail.includes("phishing.evil"), "Nunca debe reflejar dirección arbitraria del cliente");
  assert.ok(phishMail.mail.includes(CONTACT.address.streetAddress), "Debe usar dirección fija del servidor");
});

test("6. booking-widget-step3.js reenvía confirmToken y reintenta mail aunque WA haya salido", () => {
  const step3 = fs.readFileSync(path.join(ROOT, "booking/booking-widget-step3.js"), "utf8");
  assert.match(step3, /bookResult\.confirmToken/);
  assert.match(step3, /!data\.email\s*\|\|\s*!data\.email\.ok/);
});

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n🎉 Firma de confirmación: ${n}/${n} verificaciones OK.\n`);
