#!/usr/bin/env node
/**
 * Fail if pt/ pages contain common EN/FR copy leakage (static + pathologies).
 * Run: node scripts/verify-pt-copy.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PT = path.join(ROOT, "pt");

const EN_RE =
  /\b(the |and |with |Your |What is |How long|Treatment |Don't get|I'm a |According to)\b/i;
const FR_RE =
  /\b(Accueil|Contactez-nous|kinésithérapeute|ostéopathie|Rééducation posturale|Questions fréquentes|Page introuvable|traitement des|Thérapie manuelle|méthode définissant|Un petit disque|mâchoire en place|étude et traitement|Informations sur les pathologies)\b/i;

const WHITELIST =
  /English|Français|Español|WhatsApp|Google Maps|Busquet|Barral|Souchard|Kinésica|Palermo|Buenos Aires|Scalabrini|Português|Université Permanente de Thérapie|Léopold Busquet|btn-home/i;

function extractCheckBlocks(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || "";
  let head = html.match(/<head>[\s\S]*?<\/head>/i)?.[0] || "";
  head = head.replace(
    /<script type="application\/ld\+json" id="kinesica-local-schema">[\s\S]*?<\/script>/i,
    "",
  );
  return `${head}\n${main}`;
}

let errors = 0;
const files = fs.readdirSync(PT).filter((f) => f.endsWith(".html"));
for (const name of files) {
  const html = fs.readFileSync(path.join(PT, name), "utf8");
  const check = extractCheckBlocks(html);

  if (/Ônibusquet|Ônibuscamos|Ônibusca /.test(check)) {
    console.error(`[pt/${name}] corrupted Busquet/Busca copy`);
    errors++;
  }

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
  console.error(`\nverify-pt-copy FAILED (${errors} issue(s) in ${files.length} pages)`);
  process.exit(1);
}
console.log(`verify-pt-copy OK (${files.length} pages)`);
