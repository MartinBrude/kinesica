#!/usr/bin/env node
/**
 * Quick i18n wiring checks. Run: node scripts/verify-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { repoPath, STEMS } from "./i18n-urls.mjs";
import { LANG_CODES, SUBDIR_PREFIXES } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];

function hasAsset(html, baseName) {
  const stem = baseName.replace(/\.js$/, "");
  return html.includes(`${stem}.js`) || html.includes(`${stem}.min.js`);
}

function check(file, fn) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    errors.push(`Missing file: ${file}`);
    return;
  }
  fn(fs.readFileSync(p, "utf8"), file);
}

for (const stem of STEMS) {
  for (const lang of LANG_CODES) {
    const file = repoPath(lang, stem);
    if (lang === "es" && stem === "index") {
      check(file, (html, f) => {
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes('hreflang="en"')) errors.push(`${f}: missing hreflang en`);
        if (!html.includes('hreflang="pt"')) errors.push(`${f}: missing hreflang pt`);
        if (!html.includes("lang-picker")) errors.push(`${f}: missing lang-picker`);
        if (!hasAsset(html, "lang-routes.js")) errors.push(`${f}: missing lang-routes`);
        if (!html.includes("/en/")) errors.push(`${f}: missing /en/ links`);
      });
    } else if (lang === "fr") {
      check(file, (html, f) => {
        if (stem === "404") {
          if (!html.includes('lang="fr"')) errors.push(`${f}: missing lang=fr`);
          if (!html.includes("../css/")) errors.push(`${f}: missing ../ asset paths`);
          return;
        }
        if (!html.includes('lang="fr"')) errors.push(`${f}: missing lang=fr`);
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!hasAsset(html, "footer-fr.js")) errors.push(`${f}: missing footer-fr.js`);
        if (!hasAsset(html, "whatsapp-float-fr.js"))
          errors.push(`${f}: missing whatsapp-float-fr.js`);
        if (!hasAsset(html, "lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
        if (!hasAsset(html, "lang-routes.js")) errors.push(`${f}: missing lang-routes.js`);
        if (!html.includes("../css/")) errors.push(`${f}: missing ../ asset paths`);
        if (/Lunes a Viernes|bandera español[^a"]|Squelette FR/i.test(html))
          errors.push(`${f}: leftover ES/EN/skeleton text`);
      });
    } else if (lang === "pt") {
      check(file, (html, f) => {
        if (stem === "404") {
          if (!html.includes("../css/")) errors.push(`${f}: missing ../ asset paths`);
          return;
        }
        if (!html.includes('lang="pt"')) errors.push(`${f}: missing lang=pt`);
        if (!html.includes("lang-picker")) errors.push(`${f}: missing lang-picker`);
        if (!hasAsset(html, "footer-pt.js")) errors.push(`${f}: missing footer-pt.js`);
        if (!hasAsset(html, "whatsapp-float-pt.js"))
          errors.push(`${f}: missing whatsapp-float-pt.js`);
        if (!hasAsset(html, "lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
        if (!hasAsset(html, "lang-routes.js")) errors.push(`${f}: missing lang-routes.js`);
        if (!html.includes("../css/")) errors.push(`${f}: missing ../ asset paths`);
      });
    } else if (lang === "en") {
      check(file, (html, f) => {
        if (stem === "404") {
          if (!html.includes("../css/")) errors.push(`${f}: missing ../css/ paths`);
          return;
        }
        if (!html.includes('hreflang="fr"')) errors.push(`${f}: missing hreflang fr`);
        if (!html.includes("lang-picker")) errors.push(`${f}: missing lang-picker`);
        if (!hasAsset(html, "footer-en.js")) errors.push(`${f}: missing footer-en.js`);
        if (!html.includes("../js/")) errors.push(`${f}: missing ../js/ paths`);
        if (!hasAsset(html, "lang-routes.js")) errors.push(`${f}: missing lang-routes.js`);
        if (!hasAsset(html, "lang-preference.js")) errors.push(`${f}: missing lang-preference.js`);
      });
    }
  }
}

check("llms.txt", (text) => {
  if (!text.startsWith("# Kinésica")) errors.push("llms.txt: missing H1 title");
  if (!text.includes("## Optional")) errors.push("llms.txt: missing Optional section");
  if (!text.includes("## Português")) errors.push("llms.txt: missing Português section");
  if (!text.includes("## Methods & techniques (English)"))
    errors.push("llms.txt: missing EN methods section");
  if (!text.includes("llms-full.txt"))
    errors.push("llms.txt: should link to llms-full.txt");
  if (!text.includes("https://www.kinesica.com.ar/"))
    errors.push("llms.txt: should link to canonical site URLs");
});

check("llms-full.txt", (text) => {
  if (!text.startsWith("# Kinésica (documentación extendida)"))
    errors.push("llms-full.txt: missing H1 title");
  if (!text.includes("llms.txt")) errors.push("llms-full.txt: should link to llms.txt");
  if (!text.includes("## Patologías y dolencias"))
    errors.push("llms-full.txt: missing ES pathologies section");
  if (!text.includes("## Methods & techniques (English)"))
    errors.push("llms-full.txt: missing EN methods section");
});

check(".htaccess", (html) => {
  if (!html.includes("404-router.html")) errors.push(".htaccess: should use 404-router.html");
  if (!/index_en\\\.html/.test(html)) errors.push(".htaccess: missing legacy EN redirect");
  if (!html.includes("/en/")) errors.push(".htaccess: missing /en/ redirect target");
  if (!html.includes("ExpiresActive On")) errors.push(".htaccess: missing image Expires headers");
  if (!html.includes("must-revalidate")) errors.push(".htaccess: missing CSS/JS must-revalidate");
});

check("404-router.html", (html) => {
  if (!hasAsset(html, "lang-preference.js")) errors.push("404-router.html: missing lang-preference");
  if (!html.includes("/en/404.html")) errors.push("404-router.html: missing /en/404.html target");
});

for (const prefix of SUBDIR_PREFIXES) {
  check(`${prefix}/404.html`, (html, f) => {
    if (!html.includes("../css/")) errors.push(`${f}: missing ../css/`);
    if (!html.includes("/en/404.html") && prefix === "en")
      errors.push(`${f}: missing cross-lang 404 links`);
  });
}

if (errors.length) {
  console.error("i18n verify failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(
  "i18n verify OK (" + STEMS.length * LANG_CODES.length + " content pages + router)",
);
