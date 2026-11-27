#!/usr/bin/env node
/**
 * Verifica API/UI de Recordatorios y corre el test PHP de normalización.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readGasSource } from "./gas-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const admin = path.join(root, "admin");

function mustExist(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`✗ falta ${rel}`);
    process.exit(1);
  }
}

mustExist("admin/api/recordatorios.php");
mustExist("admin/api/lib_recordatorios_store.php");
mustExist("admin/api/lib_recordatorios_store_recordatorios_sync_paciente.php");
mustExist("admin/api/lib_recordatorios_view.php");
mustExist("admin/api/lib_recordatorios_n8n.php");
mustExist("admin/modules/recordatorios.js");
mustExist("admin/modules/recordatorios-render.js");
mustExist("admin/modules/recordatorios-filter.js");
mustExist("admin/modules/recordatorios-rules.js");
mustExist("admin/css/recordatorios.css");

const php = fs
  .readdirSync(path.join(admin, "api"))
  .filter((f) => f === "recordatorios.php" || (f.startsWith("recordatorios_") && f.endsWith(".php")))
  .map((f) => fs.readFileSync(path.join(admin, "api", f), "utf8"))
  .join("\n");
if (
  !php.includes("action === 'ingest'") ||
  !php.includes("lib_recordatorios_view.php") ||
  !php.includes("lib_recordatorios_n8n.php") ||
  !php.includes("'reconcile'") ||
  !php.includes("'check_sent'") ||
  !php.includes("recordatorios_check_sent_map") ||
  !php.includes("'check_alive'") ||
  !php.includes("recordatorios_check_alive_map") ||
  !php.includes("save_contact") ||
  !php.includes("recordatorios_persist_directory_contact")
) {
  console.error("✗ recordatorios.php no cumple contrato ingest/check_sent/check_alive/vista/reconcile/save_contact");
  process.exit(1);
}

mustExist("admin/api/lib_recordatorios_calendar_verify.php");
const calVerify = fs.readFileSync(path.join(admin, "api/lib_recordatorios_calendar_verify.php"), "utf8");
if (
  !calVerify.includes("function recordatorios_calendar_event_is_sendable") ||
  !calVerify.includes("check_events") ||
  !calVerify.includes("calendar_unverified")
) {
  console.error("✗ lib_recordatorios_calendar_verify.php incompleto (is_sendable / check_events)");
  process.exit(1);
}
const samedayProc = fs.readFileSync(
  path.join(admin, "api/lib_recordatorios_sameday_recordatorios_sameday_process_appointment.php"),
  "utf8"
);
if (!samedayProc.includes("recordatorios_calendar_event_is_sendable")) {
  console.error("✗ sameday process debe revalidar Calendar antes de enviar");
  process.exit(1);
}
const manualDispatch = fs.readFileSync(
  path.join(admin, "api/recordatorios_dispatch_manual_recordatorios_dispatch_manual.php"),
  "utf8"
);
if (!manualDispatch.includes("recordatorios_calendar_event_is_sendable")) {
  console.error("✗ dispatch manual debe revalidar Calendar antes de enviar");
  process.exit(1);
}
const gasSrc = readGasSource();
if (
  !gasSrc.includes('action === "check_events"') ||
  !gasSrc.includes("function handleCheckEvents") ||
  !gasSrc.includes("function getCalendarEventByIdFlexible") ||
  !gasSrc.includes('"cancelado"')
) {
  console.error("✗ GAS debe exponer check_events, variantes @google.com y filtrar cancelado en list_appointments");
  process.exit(1);
}
if (
  !calVerify.includes("kinesica_calendar_event_id_variants") ||
  !fs
    .readFileSync(path.join(admin, "api/lib_relational_turnos_cancel_turno.php"), "utf8")
    .includes("kinesica_calendar_event_id_variants")
) {
  console.error("✗ verify/cancel deben homologar calendar_event_id con/sin @google.com");
  process.exit(1);
}

mustExist("admin/api/lib_recordatorios_store_recordatorios_was_sent_for_event.php");
const wasSent = fs.readFileSync(
  path.join(admin, "api/lib_recordatorios_store_recordatorios_was_sent_for_event.php"),
  "utf8"
);
if (
  !wasSent.includes("function recordatorios_check_sent_map") ||
  !wasSent.includes("status IN ('sent', 'sent_email')") ||
  !wasSent.includes("IN ($placeholders)")
) {
  console.error("✗ check_sent_map debe consultar sent/sent_email en batch (IN ?)");
  process.exit(1);
}
if (
  !/catch\s*\(Throwable[^\)]*\)\s*\{[\s\S]*?\$out\[\$cal\]\s*=\s*true/.test(wasSent) ||
  !wasSent.includes("foreach ($ids as $cal)")
) {
  console.error("✗ check_sent_map debe fallar cerrado (todos true) ante error de DB");
  process.exit(1);
}
if (!/catch\s*\(Throwable[^\)]*\)\s*\{[\s\S]*?return true/.test(wasSent)) {
  console.error("✗ was_sent_for_event debe fallar cerrado (return true) ante error de DB");
  process.exit(1);
}
const phonesLibPath = path.join(admin, "api/lib_recordatorios_store_recordatorios_check_sent_phones.php");
mustExist("admin/api/lib_recordatorios_store_recordatorios_check_sent_phones.php");
const phonesLib = fs.readFileSync(phonesLibPath, "utf8");
if (
  !phonesLib.includes("function recordatorios_check_sent_phones_map") ||
  !phonesLib.includes("function recordatorios_was_sent_for_phone") ||
  !phonesLib.includes("kinesica_names_compatible")
) {
  console.error("✗ check_sent_phones_map debe existir y respetar nombres (teléfono compartido)");
  process.exit(1);
}
const routesSrc = fs.readFileSync(path.join(admin, "api/recordatorios_routes.php"), "utf8");
if (
  !routesSrc.includes("sent_phones") ||
  !routesSrc.includes("sent_phone_people") ||
  !routesSrc.includes("patient_name") ||
  !routesSrc.includes("nameByEventId")
) {
  console.error("✗ ruta check_sent debe exponer sent_phones/sent_phone_people y aceptar patient_name");
  process.exit(1);
}
const reconcileSrc = fs.readFileSync(
  path.join(admin, "api/lib_recordatorios_n8n_recordatorios_reconcile.php"),
  "utf8"
);
if (
  /\$result\['message'\]\s*=\s*'Error:\s*'\s*\.\s*\$e->getMessage\(\)/.test(reconcileSrc) ||
  !reconcileSrc.includes("Reconciliación interrumpida")
) {
  console.error("✗ reconcile no debe exponer \$e->getMessage() al cliente");
  process.exit(1);
}

// Sanity: el workflow n8n hermano debe llamar check_sent antes de reenviar.
const wfPath = path.join(root, "..", "kinesica-bot", "workflow_recordatorios.json");
if (fs.existsSync(wfPath)) {
  const wf = JSON.parse(fs.readFileSync(wfPath, "utf8"));
  const parseNode = (wf.nodes || []).find((n) => n.name === "Parse Patients & Phones");
  const code = String(parseNode?.parameters?.jsCode || "");
  if (!code.includes("check_sent") || !code.includes("fetchAlreadySentEventIds") || !code.includes("already_sent")) {
    console.error("✗ kinesica-bot Parse Patients debe usar check_sent / already_sent");
    process.exit(1);
  }
  if (
    !code.includes("sent_phones") ||
    !code.includes("sent_phone_people") ||
    !code.includes("patient_name") ||
    !code.includes("phoneAlreadySentForPatient") ||
    !code.includes("items:")
  ) {
    console.error("✗ kinesica-bot Parse Patients debe enviar phones/items+patient_name y usar sent_phones");
    process.exit(1);
  }
  if (!code.includes("check_alive") || !code.includes("fetchDeadEventReasons")) {
    console.error("✗ kinesica-bot Parse Patients debe usar check_alive / fetchDeadEventReasons (TC-50)");
    process.exit(1);
  }
}

const n8n = fs
  .readdirSync(path.join(admin, "api"))
  .filter((f) => f === "lib_recordatorios_n8n.php" || (f.startsWith("lib_recordatorios_n8n_") && f.endsWith(".php")))
  .map((f) => fs.readFileSync(path.join(admin, "api", f), "utf8"))
  .join("\n");
if (
  !n8n.includes("function recordatorios_reconcile") ||
  !n8n.includes("baseline_ts") ||
  !n8n.includes("n8n_recordatorios_workflow_id") ||
  !n8n.includes("Build Sent Reminder Report")
) {
  console.error("✗ lib_recordatorios_n8n.php incompleto (baseline / Build* / workflow id)");
  process.exit(1);
}

const js = fs
  .readdirSync(path.join(admin, "modules"))
  .filter((f) => f === "recordatorios.js" || (f.startsWith("recordatorios-") && f.endsWith(".js")))
  .map((f) => fs.readFileSync(path.join(admin, "modules", f), "utf8"))
  .join("\n");
if (!js.includes("recordatorios-sync") || !js.includes("renderRecordatoriosSync")) {
  console.error("✗ recordatorios.js sin indicador de sync");
  process.exit(1);
}
if (!js.includes("save_contact") || !js.includes('mode: "contact"')) {
  console.error("✗ recordatorios.js sin flujo de carga de contacto");
  process.exit(1);
}

const render = fs
  .readdirSync(path.join(admin, "modules"))
  .filter((f) => f.startsWith("recordatorios-render") && f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(admin, "modules", f), "utf8"))
  .join("\n");
if (!render.includes('data-action="save-contact"') || !render.includes("escapeHtml(item.email)")) {
  console.error("✗ recordatorios-render.js sin botón/escape de contacto");
  process.exit(1);
}

for (const script of ["scripts/test-recordatorios.php", "scripts/test-recordatorios-contact.php"]) {
  const r = spawnSync("php", [path.join(root, script)], {
    encoding: "utf8",
    cwd: root,
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) {
    console.error(`✗ ${script} falló`);
    process.exit(r.status || 1);
  }
}

console.log("recordatorios: ok");
