#!/usr/bin/env node
/**
 * Quick i18n wiring checks. Run: node scripts/verify-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { repoPath } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_STEMS = [
  "index",
  "articulos",
  "atm",
  "cadenas",
  "cervicalgia",
  "cv",
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
  for (const lang of ["es", "en", "fr"]) {
    const file = repoPath(lang, stem);
    if (lang === "es" && stem === "index") {
      check(file, (html, f) => {
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes('hreflang="en"')) errors.push(`${f}: missing hreflang en`);
        if (!html.includes("images/fr.svg")) errors.push(`${f}: missing FR flag`);
        if (!html.includes("lang-routes.js")) errors.push(`${f}: missing lang-routes`);
        if (!html.includes("/en/")) errors.push(`${f}: missing /en/ links`);
      });
    } else if (lang === "fr") {
      check(file, (html, f) => {
        if (!html.includes('lang="fr"')) errors.push(`${f}: missing lang=fr`);
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("footer-fr.js")) errors.push(`${f}: missing footer-fr.js`);
        if (!html.includes("whatsapp-float-fr.js"))
          errors.push(`${f}: missing whatsapp-float-fr.js`);
        if (!html.includes("lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
        if (!html.includes("lang-routes.js")) errors.push(`${f}: missing lang-routes.js`);
        if (!html.includes("../css/")) errors.push(`${f}: missing ../ asset paths`);
        if (/Lunes a Viernes|bandera español[^a"]|Squelette FR/i.test(html))
          errors.push(`${f}: leftover ES/EN/skeleton text`);
      });
    } else if (lang === "en") {
      check(file, (html, f) => {
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("images/fr.svg")) errors.push(`${f}: missing FR flag`);
        if (!html.includes("footer-en.js")) errors.push(`${f}: missing footer-en.js`);
        if (!html.includes("../js/")) errors.push(`${f}: missing ../js/ paths`);
        if (!html.includes("lang-routes.js")) errors.push(`${f}: missing lang-routes.js`);
        if (!html.includes("lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
      });
    }
  }
}

check(".htaccess", (html) => {
  if (!html.includes("404-router.html")) errors.push(".htaccess: should use 404-router.html");
  if (!/index_en\\\.html/.test(html)) errors.push(".htaccess: missing legacy EN redirect");
  if (!html.includes("/en/")) errors.push(".htaccess: missing /en/ redirect target");
});

check("404-router.html", (html) => {
  if (!html.includes("lang-preference.js")) errors.push("404-router.html: missing lang-preference");
  if (!html.includes("/en/404.html")) errors.push("404-router.html: missing /en/404.html target");
});

for (const lang of ["en", "fr"]) {
  check(`${lang}/404.html`, (html, f) => {
    if (!html.includes("../css/")) errors.push(`${f}: missing ../css/`);
    if (!html.includes("/en/404.html") && lang === "en")
      errors.push(`${f}: missing cross-lang 404 links`);
  });
}

if (errors.length) {
  console.error("i18n verify failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("i18n verify OK (" + CONTENT_STEMS.length * 3 + " content pages + router)");
