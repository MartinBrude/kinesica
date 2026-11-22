#!/usr/bin/env node
/**
 * Contratos anti-code-smell del admin API:
 * - no filtrar $e->getMessage() a JSON de cliente en rutas sensibles
 * - check_sent / reconcile fail-closed / mensaje genérico
 * - auth pacientes sin install_token
 * - WhatsApp sin Phone Number ID hardcodeado
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(root, "admin/api");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertNoClientGetMessage(rel, patterns) {
  const src = read(rel);
  for (const re of patterns) {
    assert.ok(!re.test(src), `${rel} no debe exponer getMessage al cliente (${re})`);
  }
}

assertNoClientGetMessage("admin/api/instagram_cola.php", [
  /json_out\s*\(\s*500\s*,\s*\[[^\]]*\$e->getMessage\(\)/,
]);
assert.ok(
  read("admin/api/instagram_cola.php").includes("Error al procesar la cola de Instagram"),
  "instagram_cola 500 genérico"
);

assertNoClientGetMessage("admin/api/servicios.php", [
  /\$hostinger\['error'\]\s*=\s*\$e->getMessage\(\)/,
]);
assert.ok(
  read("admin/api/servicios.php").includes("No se pudo conectar a la base de datos"),
  "servicios error de DB genérico"
);

assertNoClientGetMessage("admin/api/webhook_meta.php", [
  /'error'\s*=>\s*\$e->getMessage\(\)/,
]);
assert.ok(read("admin/api/webhook_meta.php").includes("'insert_failed'"), "webhook_meta debug sin stack");

assertNoClientGetMessage("admin/api/lib_recordatorios_n8n_recordatorios_reconcile.php", [
  /\$result\['message'\]\s*=\s*'Error:\s*'\s*\.\s*\$e->getMessage\(\)/,
]);
assertNoClientGetMessage("admin/api/lib_interacciones_n8n.php", [
  /\$result\['message'\]\s*=\s*'Error:\s*'\s*\.\s*\$e->getMessage\(\)/,
]);

assertNoClientGetMessage("admin/api/lib_instagram_image_text.php", [
  /'error'\s*=>\s*\$e->getMessage\(\)/,
]);

const wasSent = read("admin/api/lib_recordatorios_store_recordatorios_was_sent_for_event.php");
assert.match(wasSent, /\$out\[\$cal\]\s*=\s*true/, "check_sent_map fail-closed");
assert.match(wasSent, /return true/, "was_sent fail-closed");

const auth = read("admin/api/pacientes_authenticate.php");
assert.ok(!/\$config\[['\"]install_token['\"]\]/.test(auth), "sin fallback install_token");

const wa = read("admin/api/lib_whatsapp.php");
assert.ok(!wa.includes("1340013275870491"), "sin Phone Number ID hardcodeado");
assert.match(wa, /Falta WHATSAPP_PHONE_NUMBER_ID/);

const role = read("admin/api/lib_auth_require_auth.php");
assert.match(role, /ensure_users_role_column/, "ensure_users_role_column presente");
assert.match(
  role,
  /catch\s*\(Throwable\s+\$e\)\s*\{[\s\S]*?error_log[\s\S]*?return;/,
  "role schema: log + no marker en fallo"
);

const mig17 = path.join(api, "migrations/017_scrub_manage_code_plaintext.php");
assert.ok(fs.existsSync(mig17), "existe migración 017 scrub manage_code");
assert.match(read("admin/api/migrations/017_scrub_manage_code_plaintext.php"), /manage_code\s*=\s*NULL/);

const campana = read("admin/api/campana_turnos_campana_upsert_flag.php");
assert.match(campana, /kinesica_pacientes_alive_sql/);
assert.match(campana, /kinesica_pacientes_require_alive/);
assert.match(campana, /kinesica_pacientes_find_soft_deleted_by_phone/);
assert.match(campana, /deleted_at\s*=\s*NULL/);

const routesPost = read("admin/api/pacientes_routes_post.php");
assert.match(routesPost, /kinesica_pacientes_release_soft_deleted_phone/);
assert.match(
  routesPost,
  /UPDATE pacientes SET telefono = :tel WHERE id = :id AND \(\{\$alive\}\)/
);

const aliveHelpers = read("admin/api/pacientes_helpers_alive.php");
assert.match(aliveHelpers, /function kinesica_pacientes_release_soft_deleted_phone/);
assert.match(aliveHelpers, /sin-tel-deleted-/);
assert.match(aliveHelpers, /\?int \$exceptId/);

const upsert = read("admin/api/pacientes_ops_upsert.php");
assert.match(upsert, /kinesica_pacientes_release_soft_deleted_phone/);

const sendConf = read("api/send-confirmation.php") + "\n" + read("api/send-confirmation-patient.php");
assert.match(sendConf, /kinesica_pacientes_release_soft_deleted_phone/);
assert.ok(!sendConf.includes("$normalizePhone("), "send-confirmation no llama $normalizePhone indefinido");

const recordPersist = read("admin/api/recordatorios_lib_recordatorios_persist_directory_contact.php");
assert.match(recordPersist, /kinesica_pacientes_release_soft_deleted_phone/);

console.log("admin-api-hygiene: ok");
