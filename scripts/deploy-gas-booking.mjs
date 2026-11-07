#!/usr/bin/env node
/**
 * Deploy del backend de turnos a Google Apps Script vía clasp.
 *
 * Uso:
 *   npm run gas:login          # una sola vez (abre el browser)
 *   npm run gas:setup          # crea .clasp.json si falta
 *   npm run gas:push           # sube código (HEAD, sin publicar)
 *   npm run gas:deploy         # push + actualiza la web app (misma URL /exec)
 *   npm run gas:deployments    # lista implementaciones
 *
 * Variables opcionales:
 *   GAS_BOOKING_SCRIPT_ID      — override del scriptId
 *   GAS_BOOKING_DEPLOYMENT_ID  — override del deployment (default = URL pública)
 *   GAS_DEPLOY_DESCRIPTION     — descripción de la versión
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gasDir = path.join(root, "booking", "gas");
const sourceFile = path.join(root, "booking", "google-apps-script.js");
const codeFile = path.join(gasDir, "Code.js");
const claspJson = path.join(gasDir, ".clasp.json");
const claspExample = path.join(gasDir, ".clasp.json.example");

/** Deployment ID de la web app pública (bookingApiUrl). NO crear uno nuevo. */
const DEFAULT_DEPLOYMENT_ID =
  "AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ";

const PLACEHOLDER = "PEGAR_SCRIPT_ID_DEL_PROYECTO_BOOKING";

function die(msg, code = 1) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(code);
}

function runClasp(args, { allowFail = false } = {}) {
  const result = spawnSync("npx", ["--yes", "@google/clasp", ...args], {
    cwd: gasDir,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (result.error) die(`No se pudo ejecutar clasp: ${result.error.message}`);
  if (!allowFail && result.status !== 0) {
    die(`clasp ${args[0]} falló (exit ${result.status})`);
  }
  return result.status ?? 1;
}

function syncCode() {
  if (!fs.existsSync(sourceFile)) die(`No existe ${sourceFile}`);
  fs.mkdirSync(gasDir, { recursive: true });
  fs.copyFileSync(sourceFile, codeFile);
  console.log(`✓ Sync ${path.relative(root, sourceFile)} → booking/gas/Code.js`);
}

function readClaspConfig() {
  if (!fs.existsSync(claspJson)) return null;
  try {
    return JSON.parse(fs.readFileSync(claspJson, "utf8"));
  } catch (e) {
    die(`.clasp.json inválido: ${e.message}`);
  }
}

function ensureClaspConfig() {
  const fromEnv = String(process.env.GAS_BOOKING_SCRIPT_ID || "").trim();
  let cfg = readClaspConfig();

  if (!cfg) {
    if (!fs.existsSync(claspExample)) die(`Falta ${claspExample}`);
    fs.copyFileSync(claspExample, claspJson);
    cfg = readClaspConfig();
    console.log("✓ Creado booking/gas/.clasp.json desde el ejemplo");
  }

  if (fromEnv) {
    cfg.scriptId = fromEnv;
    fs.writeFileSync(claspJson, `${JSON.stringify(cfg, null, 2)}\n`);
  }

  const scriptId = String(cfg?.scriptId || "").trim();
  if (!scriptId || scriptId === PLACEHOLDER) {
    die(
      [
        "Falta el scriptId del proyecto Apps Script de la turnera.",
        "",
        "1. Abrí https://script.google.com/home/projects/1oDT31aCTKOB35n1kS-iKzVHUn0ILDz8ZlRPwLEyvnnMsOTyZ5AYVebIm/edit",
        "2. Configuración del proyecto (engranaje) → copiá «ID del secuencia de comandos»",
        "3. Pegalo en booking/gas/.clasp.json → scriptId",
        "   (o exportá GAS_BOOKING_SCRIPT_ID=...)",
        "",
        "Importante: NO uses el proyecto del webhook de Sheets (Clara); es otro scriptId.",
      ].join("\n")
    );
  }

  cfg.rootDir = ".";
  fs.writeFileSync(claspJson, `${JSON.stringify(cfg, null, 2)}\n`);
  return cfg;
}

function deploymentId() {
  return (
    String(process.env.GAS_BOOKING_DEPLOYMENT_ID || "").trim() || DEFAULT_DEPLOYMENT_ID
  );
}

function cmdSetup() {
  syncCode();
  if (!fs.existsSync(claspJson) && fs.existsSync(claspExample)) {
    fs.copyFileSync(claspExample, claspJson);
    console.log("✓ Creado booking/gas/.clasp.json — pegá el scriptId y volvé a correr gas:deploy");
    return;
  }
  ensureClaspConfig();
  console.log("✓ Config lista. Corré: npm run gas:login && npm run gas:deploy");
}

function cmdLogin() {
  runClasp(["login"]);
}

function cmdPush() {
  syncCode();
  ensureClaspConfig();
  runClasp(["push", "--force"]);
}

function cmdDeployments() {
  ensureClaspConfig();
  runClasp(["list-deployments"]);
}

function cmdDeploy() {
  syncCode();
  ensureClaspConfig();
  const id = deploymentId();
  const desc =
    String(process.env.GAS_DEPLOY_DESCRIPTION || "").trim() ||
    `booking ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

  console.log(`→ clasp push (force)`);
  runClasp(["push", "--force"]);

  console.log(`→ update-deployment ${id}`);
  console.log(`  (mantiene la URL /exec pública; NO crea una implementación nueva)`);
  // clasp 3.x: update-deployment <id>  |  alias: redeploy
  // Algunas versiones aceptan -d description
  const status = runClasp(["update-deployment", id, "-d", desc], { allowFail: true });
  if (status !== 0) {
    console.log("\nReintento con sintaxis create-deployment -i …");
    runClasp(["create-deployment", "-i", id, "-d", desc]);
  }

  console.log(`\n✓ Deploy listo. URL pública:`);
  console.log(`  https://script.google.com/macros/s/${id}/exec\n`);
}

const cmd = process.argv[2] || "deploy";
const handlers = {
  setup: cmdSetup,
  login: cmdLogin,
  push: cmdPush,
  deploy: cmdDeploy,
  deployments: cmdDeployments,
  "list-deployments": cmdDeployments,
};

if (!handlers[cmd]) {
  die(`Comando desconocido: ${cmd}\nUsá: setup | login | push | deploy | deployments`);
}
handlers[cmd]();
