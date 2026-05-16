#!/usr/bin/env node
/**
 * Quick i18n wiring checks. Run: node scripts/verify-i18n.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CONTENT_STEMS = [
  "index",
  "articulos",
  "atm",
  "cadenas",
  "cervicalgia",
  "lumbalgia",
  "manipulaciones",
  "neurodinamia",
  "osteopatia",
  "rpg",
];

const errors = [];

function check(file, fn) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    errors.push(`Missing file: ${file}`);
    return;
  }
  fn(fs.readFileSync(p, "utf8"), file);
}

for (const stem of CONTENT_STEMS) {
  for (const lang of ["", "_en", "_fr"]) {
    const file = stem === "index" && !lang ? "index.html" : `${stem}${lang}.html`;
    if (stem === "index" && !lang) {
      check("index.html", (html, f) => {
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("images/fr.svg")) errors.push(`${f}: missing FR flag`);
        if (!html.includes("lang-routes.js")) errors.push(`${f}: missing lang-routes`);
      });
    } else if (lang === "_fr") {
      check(file, (html, f) => {
        if (!html.includes('lang="fr"')) errors.push(`${f}: missing lang=fr`);
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("footer-fr.js")) errors.push(`${f}: missing footer-fr.js`);
        if (!html.includes("whatsapp-float-fr.js")) errors.push(`${f}: missing whatsapp-float-fr.js`);
        if (!html.includes("lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
        if (/10am - 8pm|Lunes a Viernes|Squelette FR/i.test(html))
          errors.push(`${f}: leftover ES/EN/skeleton text`);
        if (/content="Kinesiology/i.test(html)) errors.push(`${f}: English keywords`);
      });
    } else if (lang === "_en") {
      check(file, (html, f) => {
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("images/fr.svg")) errors.push(`${f}: missing FR flag`);
        if (!html.includes("footer-en.js")) errors.push(`${f}: missing footer-en.js`);
      });
    }
  }
}

check(".htaccess", (html) => {
  if (!html.includes("404-router.html")) errors.push(".htaccess: should use 404-router.html");
});

check("404-router.html", (html) => {
  if (!html.includes("lang-preference.js")) errors.push("404-router.html: missing lang-preference");
});

if (errors.length) {
  console.error("i18n verify failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("i18n verify OK (" + CONTENT_STEMS.length * 3 + " content pages + router)");
