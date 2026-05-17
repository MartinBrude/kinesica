#!/usr/bin/env node
/**
 * Generate fr/*.html from en/*.html (string replacements from translations-fr.json).
 * Run after EN pages exist under en/: node scripts/generate-fr-skeleton.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE, STEMS, absoluteUrl } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EN_PAGES = STEMS.filter((s) => s !== "index").concat(["index"]);

function langSwitcher(stem) {
  const es = stem === "index" ? "/" : `/${stem}.html`;
  const en = stem === "index" ? "/en/" : `/en/${stem}.html`;
  const fr = stem === "index" ? "/fr/" : `/fr/${stem}.html`;
  return `<ul class="lang-switcher">
              <li>
                <a href="${es}"><img src="../images/es.svg" title="Drapeau espagnol" alt="drapeau espagnol" width="24"
                    height="16" /></a>
              </li>
              <li>
                <a href="${en}"><img src="../images/gb.svg" title="Drapeau britannique" alt="drapeau britannique" width="24"
                    height="16" /></a>
              </li>
              <li>
                <a href="${fr}"><img src="../images/fr.svg" title="Drapeau français" alt="drapeau français" width="24"
                    height="16" /></a>
              </li>
            </ul>`;
}

function hreflangBlock(stem) {
  return `  <link rel="canonical" href="${absoluteUrl("fr", stem)}" />
  <link rel="alternate" hreflang="es" href="${absoluteUrl("es", stem)}" />
  <link rel="alternate" hreflang="en" href="${absoluteUrl("en", stem)}" />
  <link rel="alternate" hreflang="fr" href="${absoluteUrl("fr", stem)}" />
  <link rel="alternate" hreflang="x-default" href="${absoluteUrl("es", stem)}" />
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

  out = out.replace(/<html lang="en">/, '<html lang="fr">');
  out = out.replace(/data-footer-lang="en"/g, 'data-footer-lang="fr"');
  out = out.replace(/data-whatsapp-lang="en"/g, 'data-whatsapp-lang="fr"');
  out = out.replace(/footer-en\.js/g, "footer-fr.js");
  out = out.replace(/whatsapp-float-en\.js/g, "whatsapp-float-fr.js");
  out = out.replace(
    /<meta property="og:locale" content="en_US" \/>/,
    '<meta property="og:locale" content="fr_FR" />'
  );

  out = out.replace(
    /<link rel="canonical" href="[^"]+" \/>\s*(?:<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\s*){2,5}/,
    hreflangBlock(stem)
  );

  out = out.replace(/<ul class="lang-switcher">[\s\S]*?<\/ul>/, langSwitcher(stem));

  return out;
}

for (const stem of EN_PAGES) {
  const src = path.join(ROOT, "en", stem === "index" ? "index.html" : `${stem}.html`);
  const dest = path.join(ROOT, "fr", stem === "index" ? "index.html" : `${stem}.html`);
  if (!fs.existsSync(src)) {
    console.error("Missing:", src);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, transformEnToFr(fs.readFileSync(src, "utf8"), stem), "utf8");
  console.log("Wrote", path.relative(ROOT, dest));
}

console.log("Done.");
