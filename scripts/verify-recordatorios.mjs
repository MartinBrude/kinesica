#!/usr/bin/env node
/**
 * Verifica API/UI de Recordatorios y corre el test PHP de normalización.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
mustExist("admin/api/lib_recordatorios_view.php");
mustExist("admin/api/lib_recordatorios_n8n.php");
mustExist("admin/modules/recordatorios.js");
mustExist("admin/modules/recordatorios-render.js");
mustExist("admin/modules/recordatorios-filter.js");
mustExist("admin/modules/recordatorios-rules.js");
mustExist("admin/css/recordatorios.css");

const php = fs.readFileSync(path.join(admin, "api/recordatorios.php"), "utf8");
if (
  !php.includes("action === 'ingest'") ||
  !php.includes("lib_recordatorios_view.php") ||
  !php.includes("lib_recordatorios_n8n.php") ||
  !php.includes("'reconcile'")
) {
  console.error("✗ recordatorios.php no cumple contrato ingest/vista/reconcile");
  process.exit(1);
}

const n8n = fs.readFileSync(path.join(admin, "api/lib_recordatorios_n8n.php"), "utf8");
if (
  !n8n.includes("function recordatorios_reconcile") ||
  !n8n.includes("baseline_ts") ||
  !n8n.includes("n8n_recordatorios_workflow_id") ||
  !n8n.includes("Build Sent Reminder Report")
) {
  console.error("✗ lib_recordatorios_n8n.php incompleto (baseline / Build* / workflow id)");
  process.exit(1);
}

const js = fs.readFileSync(path.join(admin, "modules/recordatorios.js"), "utf8");
if (!js.includes("recordatorios-sync") || !js.includes("renderRecordatoriosSync")) {
  console.error("✗ recordatorios.js sin indicador de sync");
  process.exit(1);
}

const r = spawnSync("php", [path.join(root, "scripts/test-recordatorios.php")], {
  encoding: "utf8",
  cwd: root,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) {
  console.error("✗ test-recordatorios.php falló");
  process.exit(r.status || 1);
}

console.log("recordatorios: ok");
