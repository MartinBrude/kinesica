#!/usr/bin/env node
/**
 * Contratos del motor de match de pacientes + suite PHP de caracterización.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(root, "admin/api");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const r = spawnSync("php", [path.join(root, "scripts/test-pacientes-security-helpers.php")], {
  encoding: "utf8",
  cwd: root,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
assert.equal(r.status, 0, "test-pacientes-security-helpers.php debe pasar");

const matchEngine = path.join(api, "pacientes_helpers_match.php");
const matchSteps = path.join(api, "pacientes_helpers_match_steps.php");
assert.ok(fs.existsSync(matchEngine), "existe pacientes_helpers_match.php");
assert.ok(fs.existsSync(matchSteps), "existe pacientes_helpers_match_steps.php");

const engineSrc = read("admin/api/pacientes_helpers_match.php");
assert.match(engineSrc, /function kinesica_match_patient/, "motor kinesica_match_patient");
assert.match(engineSrc, /'strict'/, "policy strict");
assert.match(engineSrc, /'campana'/, "policy campana");
assert.match(engineSrc, /'email_suffix'/, "policy email_suffix");

const findSrc = read("admin/api/pacientes_helpers_existing_patient_match.php");
assert.match(findSrc, /kinesica_match_patient/, "find_existing delega al motor");
assert.ok(
  !/function find_existing_patient_match[\s\S]{0,80}SELECT \* FROM pacientes WHERE telefono/.test(findSrc),
  "find_existing no reimplementa SELECT tel"
);

const campanaSrc = read("admin/api/campana_turnos_campana_match_paciente.php");
assert.match(campanaSrc, /kinesica_match_patient/, "campana_match delega al motor");
assert.ok(!campanaSrc.includes("telefono LIKE :tel_end"), "campana sin LIKE suffix propio");

const emailSrc = read("admin/api/pacientes_helpers_email_by_phone.php");
assert.ok(!emailSrc.includes("telefono LIKE :tel_end"), "email_by_phone sin LIKE suffix propio");
assert.match(emailSrc, /kinesica_match_by_phone_suffix_unique|kinesica_match_patient/, "email usa helper compartido");

const stepsSrc = read("admin/api/pacientes_helpers_match_steps.php");
assert.match(stepsSrc, /function kinesica_match_by_phone_suffix_unique/, "suffix helper único");
assert.match(stepsSrc, /telefono LIKE/, "suffix helper tiene LIKE");

const likeFiles = fs
  .readdirSync(api)
  .filter((f) => f.startsWith("pacientes_") || f.startsWith("campana_"))
  .filter((f) => f.endsWith(".php"));
const likeHits = [];
for (const f of likeFiles) {
  const src = fs.readFileSync(path.join(api, f), "utf8");
  if (/telefono\s+LIKE\s+:tel_end/.test(src) && !f.includes("match_steps")) {
    likeHits.push(f);
  }
}
assert.deepEqual(likeHits, [], `LIKE suffix solo en match_steps, no en: ${likeHits.join(", ")}`);

const helpers = read("admin/api/pacientes_helpers.php");
assert.match(helpers, /pacientes_helpers_match\.php/, "helpers carga motor");
assert.match(helpers, /pacientes_helpers_match_steps\.php/, "helpers carga steps");

console.log("verify-pacientes-match: ok");
