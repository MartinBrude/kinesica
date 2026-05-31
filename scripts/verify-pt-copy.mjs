#!/usr/bin/env node
/**
 * Fail if pt/ static pages still contain common EN/FR leakage.
 * Run: node scripts/verify-pt-copy.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PT = path.join(ROOT, "pt");
const STATIC = new Set([
  "index.html",
  "404.html",
  "articulos.html",
  "cv.html",
  "acupuntura.html",
  "atm.html",
  "cadenas.html",
  "manipulaciones.html",
  "neurodinamia.html",
  "osteopatia.html",
  "posturologia-clinica.html",
  "rpg.html",
]);

const EN_RE =
  /\b(the |and |with |Your |What is |How long|Treatment |Don't get|I'm a |According to)\b/i;
const FR_RE =
  /\b(Accueil|Contactez-nous|kinésithérapeute|ostéopathie|Rééducation posturale|Questions fréquentes|Page introuvable)\b/i;

const WHITELIST = /English|Français|Español|WhatsApp|Google Maps|Busquet|Barral|Souchard|Kinésica|Palermo|Buenos Aires|Scalabrini|Português/i;

let errors = 0;
for (const name of fs.readdirSync(PT)) {
  if (!name.endsWith(".html")) continue;
  if (PATHOLOGY_STEMS.some((s) => name === `${s}.html`)) continue;
  if (!STATIC.has(name)) continue;
  const html = fs.readFileSync(path.join(PT, name), "utf8");
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const head = html.match(/<head>[\s\S]*?<\/head>/i)?.[0] || "";
  const check = `${head}\n${main}`;
  for (const re of [EN_RE, FR_RE]) {
    const hit = check.match(re);
    if (hit && !WHITELIST.test(hit[0])) {
      console.error(`[pt/${name}] suspicious: ${hit[0].trim()}`);
      errors++;
      break;
    }
  }
}
if (errors) {
  console.error(`\nverify-pt-copy FAILED (${errors} file(s))`);
  process.exit(1);
}
console.log("verify-pt-copy OK");
