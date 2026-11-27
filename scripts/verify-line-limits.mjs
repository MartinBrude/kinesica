#!/usr/bin/env node
/**
 * Guard arquitectónico: ningún archivo JS de runtime (ni módulos PHP críticos
 * auditados) puede superar las 250 líneas de código.
 *
 * Ejecución: node scripts/verify-line-limits.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LINES = 250;

const JS_DIRS = [
  "booking",
  "booking/gas",
  "admin",
  "admin/modules",
  "js",
];

const PHP_FILES = [
  "api/send-confirmation.php",
  "api/send-confirmation-auth.php",
  "api/send-confirmation-patient.php",
  "api/send-confirmation-transport.php",
  "api/send-confirmation-whatsapp.php",
  "admin/api/booking_admin_book.php",
  "admin/api/calendar_backup_action_book.php",
  "admin/api/lib_whatsapp.php",
  "admin/api/lib_whatsapp_meta.php",
  "admin/api/lib_whatsapp_template.php",
  "admin/api/lib_whatsapp_template_confirmation.php",
  "admin/api/pacientes_helpers_search_key.php",
  "admin/api/pacientes_helpers_phone.php",
  "admin/api/pacientes_helpers_phone_heal.php",
];

function countLines(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const lines = raw.split(/\r?\n/);
  // Ignorar salto final vacío estándar POSIX
  return lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

const violations = [];
let checked = 0;

for (const dirRel of JS_DIRS) {
  const dirAbs = path.join(ROOT, dirRel);
  if (!fs.existsSync(dirAbs)) continue;
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    if (!/\.(js|mjs|cjs|ts)$/.test(ent.name)) continue;
    if (ent.name.endsWith(".min.js")) continue;
    const rel = path.join(dirRel, ent.name);
    const n = countLines(path.join(dirAbs, ent.name));
    checked += 1;
    if (n > MAX_LINES) violations.push(`${rel} (${n} líneas)`);
  }
}

for (const rel of PHP_FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const n = countLines(abs);
  checked += 1;
  if (n > MAX_LINES) violations.push(`${rel} (${n} líneas)`);
}

assert.equal(
  violations.length,
  0,
  `Archivos sobre el límite de ${MAX_LINES} líneas:\n  - ${violations.join("\n  - ")}`
);

console.log(`line-limits (≤${MAX_LINES}): ok (${checked} archivos verificados)`);
