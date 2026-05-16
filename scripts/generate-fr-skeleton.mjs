#!/usr/bin/env node
/**
 * Phase 0 — Generate *_fr.html from *_en.html (skeleton).
 * Run: node scripts/generate-fr-skeleton.mjs
 * Does not modify existing ES/EN files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.kinesica.com.ar";
const SKELETON_BANNER = "";

const EN_PAGES = [
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

function langSwitcher(stem) {
  const es = stem === "index" ? "index.html" : `${stem}.html`;
  const en = stem === "index" ? "index_en.html" : `${stem}_en.html`;
  const fr = stem === "index" ? "index_fr.html" : `${stem}_fr.html`;
  return `<ul class="lang-switcher">
              <li>
                <a href="${es}"><img src="images/es.svg" title="Drapeau espagnol" alt="drapeau espagnol" width="24"
                    height="16" /></a>
              </li>
              <li>
                <a href="${en}"><img src="images/gb.svg" title="Drapeau britannique" alt="drapeau britannique" width="24"
                    height="16" /></a>
              </li>
              <li>
                <a href="${fr}"><img src="images/fr.svg" title="Drapeau français" alt="drapeau français" width="24"
                    height="16" /></a>
              </li>
            </ul>`;
}

function hreflangBlock(stem) {
  if (stem === "index") {
    return `  <link rel="canonical" href="${SITE}/index_fr.html" />
  <link rel="alternate" hreflang="es" href="${SITE}/" />
  <link rel="alternate" hreflang="en" href="${SITE}/index_en.html" />
  <link rel="alternate" hreflang="fr" href="${SITE}/index_fr.html" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/" />
`;
  }
  return `  <link rel="canonical" href="${SITE}/${stem}_fr.html" />
  <link rel="alternate" hreflang="es" href="${SITE}/${stem}.html" />
  <link rel="alternate" hreflang="en" href="${SITE}/${stem}_en.html" />
  <link rel="alternate" hreflang="fr" href="${SITE}/${stem}_fr.html" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/${stem}.html" />
`;
}

function applyTranslations(html) {
  const pairs = JSON.parse(
    fs.readFileSync(path.join(ROOT, "scripts", "translations-fr.json"), "utf8")
  );
  pairs.sort((a, b) => b[0].length - a[0].length);
  let out = html;
  for (const [en, fr] of pairs) {
    if (en && out.includes(en)) {
      out = out.split(en).join(fr);
    }
  }
  return out;
}

function transformEnToFr(html, stem) {
  let out = applyTranslations(html);

  out = out.replaceAll("_en.html", "_fr.html");
  out = out.replaceAll("index_en.html", "index_fr.html");
  out = out.replace(/<html lang="en">/, '<html lang="fr">');
  out = out.replace(/data-footer-lang="en"/g, 'data-footer-lang="fr"');
  out = out.replace(/data-whatsapp-lang="en"/g, 'data-whatsapp-lang="fr"');
  out = out.replace(/whatsapp-float-en\.js/g, "whatsapp-float-fr.js");
  out = out.replace(
    /<meta property="og:locale" content="en_US" \/>/,
    '<meta property="og:locale" content="fr_FR" />'
  );
  out = out.replace(
    /<meta property="og:locale:alternate" content="es_AR" \/>/,
    '<meta property="og:locale:alternate" content="es_AR" />\n  <meta property="og:locale:alternate" content="en_US" />'
  );

  out = out.replace(
    /<link rel="canonical" href="[^"]+" \/>\s*(?:<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\s*){2,4}/,
    hreflangBlock(stem)
  );

  out = out.replace(/<ul class="lang-switcher">[\s\S]*?<\/ul>/, langSwitcher(stem));
  out = out.replace(/\/>\s*<title>/, "/>\n  <title>");

  if (!out.startsWith("<!doctype")) {
    out = "<!doctype html>\n" + out;
  }
  if (SKELETON_BANNER) {
    out = out.replace(/<!doctype html>\n/i, `<!doctype html>\n${SKELETON_BANNER}`);
  }

  return out;
}

for (const stem of EN_PAGES) {
  const src = path.join(ROOT, `${stem}_en.html`);
  const dest = path.join(ROOT, `${stem}_fr.html`);
  const html = fs.readFileSync(src, "utf8");
  fs.writeFileSync(dest, transformEnToFr(html, stem), "utf8");
  console.log("Wrote", path.basename(dest));
}

console.log("Done. Also create 404_en.html / 404_fr.html manually or via separate script.");
