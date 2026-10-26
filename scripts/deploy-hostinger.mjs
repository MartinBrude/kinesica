#!/usr/bin/env node
/**
 * Deploy seguro a kinesica.com.ar vía Hostinger API (hosting_deploy).
 *
 * El deploy completo REEMPLAZA public_html. Los archivos gitignored
 * (config.php, mail.php, whatsapp.php, data/*) solo sobreviven si existen
 * en la máquina local al empaquetar.
 *
 * Uso:
 *   HOSTINGER_API_TOKEN=… node scripts/deploy-hostinger.mjs
 *
 * O con el MCP/agent: preferí este script a un hosting_deploy crudo.
 */
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "kinesica.com.ar";

const REQUIRED_LOCAL_SECRETS = [
  "admin/api/config.php",
  "admin/api/mail.php",
];

const OPTIONAL_LOCAL_SECRETS = [
  "admin/api/whatsapp.php",
  "admin/api/bot_token.sha256",
];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function checkSecrets() {
  console.log("▶ Verificando secretos locales (evita borrar config.php remoto)…");
  for (const rel of REQUIRED_LOCAL_SECRETS) {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) {
      fail(
        `Falta ${rel}.\n` +
          `  Sin ese archivo, hosting_deploy lo borra en el servidor y cae el admin.\n` +
          `  Copiá el de producción a esa ruta (está en .gitignore) y reintentá.`
      );
    }
    const size = statSync(abs).size;
    if (size < 80) {
      fail(`${rel} parece vacío o incompleto (${size} bytes).`);
    }
    // No desplegar la plantilla de ejemplo por error
    const text = readFileSync(abs, "utf8");
    if (text.includes("CAMBIAR") && rel.endsWith("config.php")) {
      fail(`${rel} todavía tiene placeholders CAMBIAR — usá el de producción.`);
    }
    console.log(`   ✓ ${rel} (${size} bytes)`);
  }
  for (const rel of OPTIONAL_LOCAL_SECRETS) {
    const abs = resolve(ROOT, rel);
    if (existsSync(abs)) {
      console.log(`   · ${rel} (opcional, se incluirá)`);
    } else {
      console.log(`   · ${rel} ausente (ok si no aplica)`);
    }
  }
}

async function deployViaApi() {
  const token = process.env.HOSTINGER_API_TOKEN || process.env.HOSTINGER_TOKEN || "";
  if (!token) {
    fail(
      "Definí HOSTINGER_API_TOKEN para desplegar por API.\n" +
        "  Alternativa: en Cursor usá el MCP hosting_deploy SOLO después de pasar este check:\n" +
        "  node scripts/deploy-hostinger.mjs --check-only"
    );
  }

  // La API pública de Hostinger para deploy-from-path es la del MCP local;
  // desde CI/scripts suele usarse FTP selectivo. Acá solo validamos y avisamos.
  fail(
    "Este script valida secretos. El upload lo hace el agente Cursor con hosting_deploy\n" +
      "  (path=" +
      ROOT +
      ", domain=" +
      DOMAIN +
      ") o FTP selectivo.\n" +
      "  Corré: node scripts/deploy-hostinger.mjs --check-only && luego el deploy MCP."
  );
}

const checkOnly = process.argv.includes("--check-only");
checkSecrets();
if (checkOnly) {
  console.log("✅ Check OK — podés desplegar con hosting_deploy / FTP.");
  process.exit(0);
}
await deployViaApi();
